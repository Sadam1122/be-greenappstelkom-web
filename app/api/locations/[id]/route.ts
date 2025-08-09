import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { upsertLocationSchema } from "@/lib/validators"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN")
    const json = await request.json()
    const data = upsertLocationSchema.partial().parse(json)
    const updated = await prisma.location.update({ where: { id: params.id }, data })
    return withCors(ok(updated, "Location updated"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN")
    const deleted = await prisma.location.delete({ where: { id: params.id } })
    return withCors(ok(deleted, "Location deleted"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
