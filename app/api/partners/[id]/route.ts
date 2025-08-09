import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole, enforceLocationScope } from "@/lib/auth"
import { upsertPartnerSchema } from "@/lib/validators"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const existing = await prisma.partner.findUnique({ where: { id: params.id } })
    if (!existing) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, existing.locationId)
    const json = await request.json()
    const data = upsertPartnerSchema.partial().parse(json)
    const updated = await prisma.partner.update({ where: { id: params.id }, data })
    return withCors(ok(updated, "Partner updated"), request)
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
    const existing = await prisma.partner.findUnique({ where: { id: params.id } })
    if (!existing) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, existing.locationId)
    const deleted = await prisma.partner.delete({ where: { id: params.id } })
    return withCors(ok(deleted, "Partner deleted"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
