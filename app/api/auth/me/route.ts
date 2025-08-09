import { prisma } from "@/lib/prisma"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { ok } from "@/lib/response"
import { requireAuth } from "@/lib/auth"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locationId: true,
        points: true,
        avatar: true,
        rw: true,
        rt: true,
      },
    })
    return withCors(ok(user, "Current user"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
