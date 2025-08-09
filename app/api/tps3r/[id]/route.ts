import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole, enforceLocationScope } from "@/lib/auth"
import { upsertTPS3RSchema } from "@/lib/validators"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const existing = await prisma.tps3r.findUnique({ where: { id: params.id } })
    if (!existing) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, existing.locationId)
    const json = await request.json()
    const data = upsertTPS3RSchema.partial().parse(json)
    const updated = await prisma.tps3r.update({ where: { id: params.id }, data })
    return withCors(ok(updated, "TPS3R updated"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const existing = await prisma.tps3r.findUnique({ where: { id: params.id } })
    if (!existing) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, existing.locationId)
    const deleted = await prisma.tps3r.delete({ where: { id: params.id } })
    return withCors(ok(deleted, "TPS3R deleted"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
