import { EventEmitter } from 'node:events'
import { execSync } from 'node:child_process'
import os from 'node:os'
import { getOsImage } from './images.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type PtyProcess = {
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  kill: () => void
  onData: (cb: (data: string) => void) => void
  onExit: (cb: (exitCode: { exitCode: number }) => void) => void
}

export type TerminalSession = {
  sessionId: string
  osId: string
  containerName: string
  pty: PtyProcess | null
  startedAt: number
  timeout: NodeJS.Timeout
  emitter: EventEmitter
}

// ─── Session registry ─────────────────────────────────────────────────────────

const MAX_SESSIONS = 20
const SESSION_TTL_MS = 30 * 60 * 1000 // 30 minutes

const sessions = new Map<string, TerminalSession>()

export function sessionCount(): number {
  return sessions.size
}

// ─── Docker helpers ───────────────────────────────────────────────────────────

/** Silently kill + remove a container by name */
function destroyContainer(name: string): void {
  try {
    execSync(`docker rm -f ${name}`, { stdio: 'ignore' })
  } catch {
    // best-effort
  }
}

/** Check whether Docker daemon is reachable */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function createSession(
  sessionId: string,
  osId: string,
): Promise<TerminalSession> {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error('Server is at capacity. Please try again in a few minutes.')
  }

  const osCfg = getOsImage(osId)
  if (!osCfg) {
    throw new Error(`Unknown OS: ${osId}`)
  }

  const containerName = `fairarena-${sessionId}`

  // TTY auto-kill timeout
  const timeout = setTimeout(() => {
    destroySession(sessionId)
  }, SESSION_TTL_MS)

  const emitter = new EventEmitter()

  const session: TerminalSession = {
    sessionId,
    osId,
    containerName,
    pty: null,
    startedAt: Date.now(),
    timeout,
    emitter,
  }

  sessions.set(sessionId, session)

  // Spawn PTY asynchronously
  try {
    const pty = await spawnDockerPty(containerName, osCfg.image, osCfg.shell)

    session.pty = pty

    pty.onData((data) => emitter.emit('data', data))
    pty.onExit(({ exitCode }) => {
      emitter.emit('exit', exitCode)
      destroySession(sessionId)
    })

    emitter.emit('ready')
  } catch (err) {
    destroySession(sessionId)
    throw err
  }

  return session
}

export function getSession(sessionId: string): TerminalSession | undefined {
  return sessions.get(sessionId)
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId)
  if (!session) return

  clearTimeout(session.timeout)
  session.pty?.kill()
  destroyContainer(session.containerName)
  session.emitter.removeAllListeners()
  sessions.delete(sessionId)
}

export function writeToSession(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  session?.pty?.write(data)
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId)
  session?.pty?.resize(cols, rows)
}

export function getSessionExpiryMs(sessionId: string): number {
  const session = sessions.get(sessionId)
  if (!session) return 0
  return SESSION_TTL_MS - (Date.now() - session.startedAt)
}

// ─── PTY spawner ──────────────────────────────────────────────────────────────

async function spawnDockerPty(
  containerName: string,
  image: string,
  shell: string,
): Promise<PtyProcess> {
  // Dynamic import of node-pty (native module)
  const ptyModule = await import('node-pty')
  const nodePty = ptyModule.default ?? ptyModule

  const isWindows = os.platform() === 'win32'

  /** Docker run flags for a hardened sandbox */
  const dockerArgs = [
    'run',
    '--rm',
    '-it',
    `--name=${containerName}`,
    '--memory=256m',
    '--memory-swap=256m',
    '--cpus=0.5',
    '--pids-limit=64',
    '--cap-drop=ALL',
    '--cap-add=NET_BIND_SERVICE',
    '--security-opt=no-new-privileges:true',
    '--network=bridge',
    '--tmpfs=/tmp:rw,nosuid,nodev,size=64m',
    '-e',
    'TERM=xterm-256color',
    '-e',
    'HOME=/root',
    '-e',
    'PS1=\\[\\033[01;32m\\]\\u@fairarena\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',
    image,
    shell,
  ]

  const spawnFile = isWindows ? 'docker.exe' : 'docker'

  const ptyProcess = nodePty.spawn(spawnFile, dockerArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  })

  // Adapter that matches our PtyProcess interface
  const dataHandlers: Array<(data: string) => void> = []
  const exitHandlers: Array<(info: { exitCode: number }) => void> = []

  ptyProcess.onData((data) => dataHandlers.forEach((h) => h(data)))
  ptyProcess.onExit((info) => exitHandlers.forEach((h) => h(info)))

  return {
    write: (data) => ptyProcess.write(data),
    resize: (cols, rows) => ptyProcess.resize(cols, rows),
    kill: () => {
      try {
        ptyProcess.kill()
      } catch {
        // already dead
      }
    },
    onData: (cb) => dataHandlers.push(cb),
    onExit: (cb) => exitHandlers.push(cb),
  }
}
