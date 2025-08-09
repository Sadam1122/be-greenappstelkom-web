// CORS for public Route Handlers (BFF pattern). Route Handlers are public endpoints in Next.js [^2].
export function buildCorsHeaders(request: Request) {
  const requestOrigin = request.headers.get("origin") ?? ""
  const allowedOrigin = process.env.FRONTEND_URL || requestOrigin

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Request-ID, X-CSRF-Token, X-Requested-With, Accept, Set-Cookie",
    Vary: "Origin",
  } as HeadersInit
}

export function handleCorsPreflight(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request) })
  }
  return null
}

export function withCors(resp: Response, request: Request) {
  const h = new Headers(resp.headers)
  const cors = buildCorsHeaders(request)
  Object.entries(cors).forEach(([k, v]) => h.set(k, v as string))
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h })
}
