// ─── Server Resource Monitor ──────────────────────────────────────────────────
// Samples CPU load (system-wide via os.cpus()) and memory usage every 5 s.
// Used to gate new session creation when the host is under pressure.

import os from 'node:os'

export interface ResourceSnapshot {
  cpuPercent: number   // 0-100
  memPercent: number   // 0-100
  memUsedMb: number
  memTotalMb: number
  overloaded: boolean  // true when either metric exceeds OVERLOAD_THRESHOLD
}

// Block new sessions when CPU or memory reaches this threshold (default 50 %)
const OVERLOAD_THRESHOLD = Math.max(
  10,
  Math.min(99, Number(process.env.OVERLOAD_THRESHOLD ?? 50)),
)
// Kill ALL existing sessions when CPU or memory exceeds this harder limit (default 60 %)
const KILL_THRESHOLD = Math.max(
  OVERLOAD_THRESHOLD + 1,
  Math.min(99, Number(process.env.KILL_THRESHOLD ?? 60)),
)

// ─── CPU sampling ─────────────────────────────────────────────────────────────

type CpuTimes = { idle: number; total: number }

function getCpuTimes(): CpuTimes[] {
  return os.cpus().map((cpu) => {
    const t = cpu.times
    const total = t.user + t.nice + t.sys + t.irq + t.idle
    return { idle: t.idle, total }
  })
}

let _prev = getCpuTimes()
let _cpuPercent = 0
let _snapshot: ResourceSnapshot = buildSnapshot(0)

function buildSnapshot(cpu: number): ResourceSnapshot {
  const total   = os.totalmem()
  const free    = os.freemem()
  const used    = total - free
  const memPct  = (used / total) * 100

  return {
    cpuPercent : Math.round(cpu),
    memPercent : Math.round(memPct),
    memUsedMb  : Math.round(used  / 1_048_576),
    memTotalMb : Math.round(total / 1_048_576),
    overloaded : cpu > OVERLOAD_THRESHOLD || memPct > OVERLOAD_THRESHOLD,
  }
}

function sample(): void {
  const curr = getCpuTimes()

  let idleDelta = 0
  let totalDelta = 0
  for (let i = 0; i < curr.length; i++) {
    idleDelta  += curr[i].idle  - (_prev[i]?.idle  ?? 0)
    totalDelta += curr[i].total - (_prev[i]?.total ?? 0)
  }

  _prev = curr
  _cpuPercent = totalDelta === 0 ? 0 : Math.max(0, 100 - (idleDelta / totalDelta) * 100)
  _snapshot = buildSnapshot(_cpuPercent)
}

// Sample immediately + every 5 s
sample()
const _interval = setInterval(sample, 5_000)
_interval.unref() // don't block process exit

// ─── Public API ───────────────────────────────────────────────────────────────

export function getResources(): ResourceSnapshot  { return _snapshot }
export function isOverloaded():  boolean          { return _snapshot.overloaded }
export function isKillOverloaded(): boolean       { return _snapshot.cpuPercent >= KILL_THRESHOLD || _snapshot.memPercent >= KILL_THRESHOLD }
export function overloadThreshold(): number       { return OVERLOAD_THRESHOLD }
export function killThreshold(): number           { return KILL_THRESHOLD }
