import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { ok } from "@/lib/response"
import { clearAuthCookie, requireAuth } from "@/lib/auth"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    await requireAuth()
    clearAuthCookie()
    return withCors(ok({}, "Logged out"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
