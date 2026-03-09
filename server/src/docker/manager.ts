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
  ip: string
  pty: PtyProcess | null
  startedAt: number
  ttlTimeout: NodeJS.Timeout
  idleTimeout: NodeJS.Timeout
  warningTimeout: NodeJS.Timeout | null
  emitter: EventEmitter
}

// ─── Config ───────────────────────────────────────────────────────────────────

// Hard global cap on concurrent containers — default 3 on a 1 vCPU / 2 GB host
const MAX_SESSIONS       = Math.max(1, Number(process.env.MAX_SESSIONS       ?? 3))
// Max containers a single IP may hold at once — default 1 per IP
const MAX_PER_IP         = Math.max(1, Number(process.env.MAX_SESSIONS_PER_IP ?? 1))
// Hard wall-clock session lifetime (default 15 min)
const SESSION_TTL_MS     = Math.max(60_000, Number(process.env.SESSION_TTL_MS  ?? 15 * 60_000))
// Kill session after this many ms of stdin silence (default 5 min)
const IDLE_TTL_MS        = Math.max(30_000, Number(process.env.IDLE_TTL_MS     ?? 5 * 60_000))
// How long before TTL expiry to send a warning (default 2 min)
const WARNING_BEFORE_MS  = Math.min(SESSION_TTL_MS - 10_000, 2 * 60_000)

// ─── Session registry ─────────────────────────────────────────────────────────

const sessions      = new Map<string, TerminalSession>()
const sessionsByIp  = new Map<string, Set<string>>()  // ip → set of sessionIds

export function sessionCount(): number { return sessions.size }

export function getSessionCountForIp(ip: string): number {
  return sessionsByIp.get(ip)?.size ?? 0
}

// ─── Docker helpers ───────────────────────────────────────────────────────────

/** Silently kill + remove a container by name */
function destroyContainer(name: string): void {
  try {
    execSync(`docker rm -f ${name}`, { stdio: 'ignore', timeout: 10_000 })
  } catch { /* best-effort */ }
}

/** Check whether Docker daemon is reachable */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5_000 })
    return true
  } catch {
    return false
  }
}

/**
 * Periodically clean up any running containers that match our naming pattern
 * but are not tracked in the active sessions map. This prevents accumulation
 * of orphaned containers due to crashes or bugs.
 */
function cleanupStaleContainers(): void {
  try {
    const raw = execSync(
      'docker ps --filter "name=fairarena-" --format "{{.Names}}"',
      { encoding: 'utf8', timeout: 10_000 },
    ).trim()
    if (!raw) return
    const runningNames = raw.split('\n').map((n) => n.trim()).filter(Boolean)
    for (const name of runningNames) {
      // Extract sessionId from name: fairarena-{sessionId}
      const sessionId = name.replace('fairarena-', '')
      if (!sessions.has(sessionId)) {
        console.log(`[manager] cleaning stale container: ${name}`)
        destroyContainer(name)
      }
    }
  } catch { /* docker might not be available or command failed */ }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleContainers, 5 * 60 * 1000).unref()

/**
 * Destroy every live session – used during graceful shutdown.
 */
export function destroyAllSessions(): void {
  for (const id of [...sessions.keys()]) {
    destroySession(id)
  }
}

// ─── idle / expiry timers ─────────────────────────────────────────────────────

function makeIdleTimeout(sessionId: string): NodeJS.Timeout {
  return setTimeout(() => {
    const s = sessions.get(sessionId)
    if (!s) return
    s.emitter.emit('data', '\r\n\x1b[33m[FairArena] Session closed due to inactivity.\x1b[0m\r\n')
    destroySession(sessionId)
  }, IDLE_TTL_MS)
}

// ─── Session lifecycle ────────────────────────────────────────────────────────

export async function createSession(
  sessionId: string,
  osId: string,
  ip: string,
): Promise<TerminalSession> {

  // ── Global cap ────────────────────────────────────────────────────────────
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error('Server is at capacity. Please try again in a few minutes.')
  }

  // ── Per-IP cap ────────────────────────────────────────────────────────────
  const ipSessions = sessionsByIp.get(ip) ?? new Set<string>()
  if (ipSessions.size >= MAX_PER_IP) {
    throw new Error(
      `You already have ${MAX_PER_IP} active session(s). Close an existing terminal to start a new one.`,
    )
  }

  const osCfg = getOsImage(osId)
  if (!osCfg) throw new Error(`Unknown OS: ${osId}`)

  const containerName = `fairarena-${sessionId}`
  const emitter       = new EventEmitter()
  emitter.setMaxListeners(20)

  // Hard TTL – always fires
  const ttlTimeout = setTimeout(() => {
    const s = sessions.get(sessionId)
    if (!s) return
    s.emitter.emit('data', '\r\n\x1b[31m[FairArena] Maximum session time reached. Goodbye.\x1b[0m\r\n')
    destroySession(sessionId)
  }, SESSION_TTL_MS)

  // Expiry warning
  const warningTimeout =
    WARNING_BEFORE_MS > 0
      ? setTimeout(() => {
          const s = sessions.get(sessionId)
          if (!s) return
          const minsLeft = Math.round(WARNING_BEFORE_MS / 60_000)
          s.emitter.emit(
            'data',
            `\r\n\x1b[33m[FairArena] ⚠  Session will expire in ${minsLeft} minute(s).\x1b[0m\r\n`,
          )
          s.emitter.emit('expiry-warning', { remainingMs: WARNING_BEFORE_MS })
        }, SESSION_TTL_MS - WARNING_BEFORE_MS)
      : null

  const idleTimeout = makeIdleTimeout(sessionId)

  const session: TerminalSession = {
    sessionId,
    osId,
    containerName,
    ip,
    pty: null,
    startedAt: Date.now(),
    ttlTimeout,
    idleTimeout,
    warningTimeout,
    emitter,
  }

  sessions.set(sessionId, session)
  ipSessions.add(sessionId)
  sessionsByIp.set(ip, ipSessions)

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

  clearTimeout(session.ttlTimeout)
  clearTimeout(session.idleTimeout)
  if (session.warningTimeout) clearTimeout(session.warningTimeout)

  session.pty?.kill()
  destroyContainer(session.containerName)
  session.emitter.removeAllListeners()
  sessions.delete(sessionId)

  // Remove from per-IP registry
  const ipSet = sessionsByIp.get(session.ip)
  if (ipSet) {
    ipSet.delete(sessionId)
    if (ipSet.size === 0) sessionsByIp.delete(session.ip)
  }
}

export function writeToSession(sessionId: string, data: string): void {
  const session = sessions.get(sessionId)
  if (!session) return

  // Reset idle timer on every stdin event
  clearTimeout(session.idleTimeout)
  session.idleTimeout = makeIdleTimeout(sessionId)

  session.pty?.write(data)
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
  const ptyModule = await import('node-pty')
  const nodePty   = ptyModule.default ?? ptyModule

  const isWindows = os.platform() === 'win32'

  /**
   * Hardened sandbox flags:
   *  - drop ALL Linux capabilities, no new privileges (cannot escape to root)
   *  - memory, CPU, PID, and ulimit caps (cannot starve the host)
   *  - read-only root FS with selective rw tmpfs for /tmp, /home, /run, /var
   *  - external-only DNS so containers cannot resolve private RFC-1918 names
   *  - no process.env leakage — only the bare minimum env is passed in
   */
  const dockerArgs = [
    'run',
    '--rm',
    '-it',
    `--name=${containerName}`,
    `--hostname=fairarena`,

    // Resource limits
    '--memory=256m',
    '--memory-swap=256m',
    '--cpus=0.5',
    '--pids-limit=64',
    '--ulimit', 'nproc=64:64',
    '--ulimit', 'nofile=256:256',
    '--ulimit', 'fsize=20971520:20971520', // 20 MB max file write

    // Privilege hardening
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges:true',
    '--read-only',

    // Writable scratch space only
    '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m',
    // Provide a writable home for an unprivileged UID (mode=1777 ensures
    // world-writable tmpfs so the numeric UID can write its home without
    // modifying the image's read-only root filesystem).
    '--tmpfs=/home/sandbox:rw,nosuid,noexec,mode=1777,size=64m',
    '--tmpfs=/run:rw,nosuid,nodev,noexec,size=8m',
    '--tmpfs=/var:rw,nosuid,nodev,noexec,size=128m',

    // Network isolation: external DNS only, no internal resolution
    '--network=bridge',
    '--dns=1.1.1.1',
    '--dns=8.8.8.8',
    '--dns-opt=timeout:2',
    '--dns-opt=attempts:2',

    // Minimal, clean env — never forward process.env
    '-e', 'TERM=xterm-256color',
    '-e', 'LANG=C.UTF-8',
    '-e', 'LC_ALL=C.UTF-8',
    // Force HOME into writable tmpfs. Set a simple PS1; the shell will be
    // started as numeric UID 1000 so users won't get a root prompt.
    '-e', 'HOME=/home/sandbox',
    '-e', 'PS1=\\[\\033[01;32m\\]\\u@fairarena\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ ',

    // Run the process as a non-root numeric UID to avoid granting root
    // privileges even when the image lacks a pre-created unprivileged user.
    '--user=1000:1000',

    image,
    // Use an explicit full path for the shell command to avoid relying on
    // the image's PATH resolution from the CLI. Map common sh/bash tokens
    // to their usual absolute locations.
    (() => {
      const shellMap: Record<string, string> = {
        bash: '/bin/bash', sh: '/bin/sh', zsh: '/bin/zsh',
        fish: '/usr/bin/fish', dash: '/bin/dash',
      }
      return shell.startsWith('/') ? shell : (shellMap[shell] ?? `/bin/${shell}`)
    })(),
  ]

  const spawnFile = isWindows ? 'docker.exe' : 'docker'

  // Only pass the minimum env that docker CLI itself needs; strip everything else
  const hostEnv: Record<string, string> = { PATH: process.env.PATH ?? '/usr/bin:/bin' }
  if (isWindows && process.env.SYSTEMROOT) hostEnv.SYSTEMROOT = process.env.SYSTEMROOT

  const ptyProcess = nodePty.spawn(spawnFile, dockerArgs, {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: os.tmpdir(),   // not the server's working directory
    env: hostEnv,
  })

  const dataHandlers: Set<(data: string) => void> = new Set()
  const exitHandlers: Set<(info: { exitCode: number }) => void> = new Set()

  ptyProcess.onData((data) => dataHandlers.forEach((h) => h(data)))
  ptyProcess.onExit((info) => exitHandlers.forEach((h) => h(info)))

  return {
    write:   (data)       => ptyProcess.write(data),
    resize:  (cols, rows) => ptyProcess.resize(cols, rows),
    kill:    ()           => { try { ptyProcess.kill() } catch { /* already dead */ } },
    onData:  (cb)         => dataHandlers.add(cb),
    onExit:  (cb)         => exitHandlers.add(cb),
  }
}
