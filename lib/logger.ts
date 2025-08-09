export function getRequestId(req: Request) {
  return req.headers.get("x-request-id") || crypto.randomUUID()
}

export function logJSON(level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) {
  // Simple structured logging (use pino/winston in production)
  console[level](
    JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...extra,
    }),
  )
}
