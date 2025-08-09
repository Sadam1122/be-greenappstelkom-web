type Bucket = { tokens: number; last: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key) ?? { tokens: limit, last: now }
  const refill = Math.floor((now - b.last) / windowMs) * limit
  b.tokens = Math.min(limit, b.tokens + (refill > 0 ? refill : 0))
  b.last = now
  if (b.tokens > 0) {
    b.tokens -= 1
    buckets.set(key, b)
    return { allowed: true, remaining: b.tokens }
  }
  return { allowed: false, remaining: 0 }
}

export function ipKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || ""
  const ip = fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown"
  return `ip:${ip}`
}
