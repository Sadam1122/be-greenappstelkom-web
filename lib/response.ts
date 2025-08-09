export type SuccessPayload<T> = {
  status: "success"
  message: string
  data: T
  meta?: Record<string, unknown>
}

export type ErrorPayload = {
  status: "error"
  message: string
  details?: unknown
}

export function ok<T>(data: T, message = "OK", meta?: Record<string, unknown>, init?: ResponseInit) {
  const body: SuccessPayload<T> = { status: "success", message, data, meta }
  return Response.json(body, { status: init?.status ?? 200, headers: init?.headers })
}

export function created<T>(data: T, message = "Created") {
  return ok<T>(data, message, undefined, { status: 201 })
}

export function err(message: string, details?: unknown, status = 500, headers?: HeadersInit) {
  const body: ErrorPayload = { status: "error", message, details }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  })
}
