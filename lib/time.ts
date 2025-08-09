export function parseDurationToSeconds(input: string): number {
  // supports "7d", "12h", "30m", "45s"
  const m = input.match(/^(\d+)\s*([smhd])$/i)
  if (!m) throw new Error("Invalid duration format")
  const n = Number.parseInt(m[1], 10)
  const unit = m[2].toLowerCase()
  const mult = unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400
  return n * mult
}
