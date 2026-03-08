// ─── Upstash Redis client ─────────────────────────────────────────────────────
// Falls back to a no-op in-memory stub when credentials are absent so the
// server still starts in development without Redis.

import { Redis } from '@upstash/redis'

class MemoryRedis {
  private store: Map<string, { value: string; expiresAt: number | null }> = new Map()

  private clean(key: string): { value: string; expiresAt: number | null } | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry
  }

  async get(key: string): Promise<string | null> {
    return this.clean(key)?.value ?? null
  }

  async set(
    key: string,
    value: string,
    opts?: { nx?: boolean; ex?: number },
  ): Promise<'OK' | null> {
    if (opts?.nx && this.store.has(key)) {
      const e = this.clean(key)
      if (e) return null
    }
    this.store.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    })
    return 'OK'
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0
  }

  async incrby(key: string, delta: number): Promise<number> {
    const entry = this.clean(key)
    const cur = entry ? Number(entry.value) : 0
    const next = cur + delta
    this.store.set(key, {
      value: String(next),
      expiresAt: entry?.expiresAt ?? null,
    })
    return next
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key)
    if (!entry) return 0
    entry.expiresAt = Date.now() + seconds * 1000
    return 1
  }

  async ttl(key: string): Promise<number> {
    const entry = this.clean(key)
    if (!entry) return -2
    if (entry.expiresAt === null) return -1
    return Math.ceil((entry.expiresAt - Date.now()) / 1000)
  }
}

export type RedisLike = Pick<Redis, 'get' | 'set' | 'del' | 'incrby' | 'expire' | 'ttl'>

let _redis: RedisLike

const url   = process.env.UPSTASH_REDIS_URL
const token = process.env.UPSTASH_REDIS_TOKEN

if (url && token) {
  _redis = new Redis({ url, token }) as unknown as RedisLike
  console.log('[redis] Connected to Upstash Redis')
} else {
  console.warn('[redis] UPSTASH_REDIS_URL/TOKEN not set — using in-memory fallback (dev only)')
  _redis = new MemoryRedis() as unknown as RedisLike
}

export const redis = _redis

// ─── Key helpers ──────────────────────────────────────────────────────────────

/** Key that tracks whether an IP already has an active session */
export function keyActiveSession(ip: string): string {
  return `fa:sess:${ip}`
}

/** Key that tracks total session seconds used today for an IP */
export function keyDailySeconds(ip: string): string {
  const d = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC
  return `fa:day:${ip}:${d}`
}

/** Key that marks an IP as over daily quota */
export function keyDailyBlocked(ip: string): string {
  const d = new Date().toISOString().slice(0, 10)
  return `fa:dayblocked:${ip}:${d}`
}

// ─── Per-IP session gate ──────────────────────────────────────────────────────

// Environment values are provided in milliseconds (MS). Enforce a sensible
// minimum in MS (60s) before converting to seconds to avoid accidentally
// producing tiny fractional second TTLs when users supply seconds by mistake.
const SESSION_TTL_S  = Math.max(60_000, Number(process.env.SESSION_TTL_MS ?? 30 * 60_000)) / 1000
const DAILY_LIMIT_S  = Math.max(60_000, Number(process.env.DAILY_LIMIT_MS ?? 60 * 60_000)) / 1000

/** 25-hour TTL so the daily key always outlives the UTC day */
const DAY_TTL_S = 25 * 60 * 60

/**
 * Attempt to claim a session slot for `ip`.
 * Returns an error string if denied, or null if the slot was granted.
 */
export async function claimSession(
  ip: string,
  sessionId: string,
): Promise<string | null> {
  // 1. Check daily quota
  const dayKey    = keyDailySeconds(ip)
  const usedRaw   = await redis.get(dayKey)
  const usedSec   = Number(usedRaw ?? 0)

  if (usedSec >= DAILY_LIMIT_S) {
    const hLeft = Math.ceil((DAILY_LIMIT_S - usedSec + DAILY_LIMIT_S) / 3600)
    return `Daily session limit reached (${Math.floor(DAILY_LIMIT_S / 60)} min/day). Try again tomorrow or in ~${hLeft}h.`
  }

  // 2. Try to set the active-session key (NX so it fails if already held)
  const claimed = await redis.set(
    keyActiveSession(ip),
    `${sessionId}:${Date.now()}`,
    { nx: true, ex: Math.ceil(SESSION_TTL_S) },
  )

  if (claimed === null) {
    const remaining = await redis.ttl(keyActiveSession(ip))
    const mins = Math.max(1, Math.ceil(remaining / 60))
    return `You already have an active session (expires in ~${mins} min). Only 1 session per IP is allowed.`
  }

  return null
}

/**
 * Release the session slot for `ip` and record how long it ran.
 * `startedAt` should be the ms timestamp from Date.now() at session start.
 * Only charges the daily counter if the active-session key still belongs to
 * this sessionId (guards against races/TTL expiry of the Redis key).
 */
export async function releaseSession(ip: string, sessionId: string, startedAtMs: number): Promise<void> {
  // Clamp runtime to a sane max to guard against clock mis-sets.
  const raw = Math.ceil((Date.now() - startedAtMs) / 1000)
  const dur = Math.max(0, Math.min(raw, 24 * 60 * 60))
  const dayKey = keyDailySeconds(ip)

  const active = await redis.get(keyActiveSession(ip))
  // Only release and charge if this exact session still owns the key.
  if (active && active.startsWith(`${sessionId}:`)) {
    await redis.del(keyActiveSession(ip))
    if (dur > 0) {
      await redis.incrby(dayKey, dur)
      await redis.expire(dayKey, DAY_TTL_S)
    }
  }
}

/**
 * Remove the active-session claim for `ip` if it belongs to `sessionId`.
 * This is used when a session creation fails after we've set the NX key
 * but before the session actually started; we must free the slot without
 * charging the user's daily quota.
 */
export async function unclaimSession(ip: string, sessionId: string): Promise<void> {
  const active = await redis.get(keyActiveSession(ip))
  if (active && active.startsWith(`${sessionId}:`)) {
    await redis.del(keyActiveSession(ip))
  }
}

/**
 * Return the remaining daily quota in seconds (rough estimate).
 */
export async function dailyRemainingSeconds(ip: string): Promise<number> {
  const raw = await redis.get(keyDailySeconds(ip))
  const used = Number(raw ?? 0)
  return Math.max(0, DAILY_LIMIT_S - used)
}
