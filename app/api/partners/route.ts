import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertPartnerSchema } from "@/lib/validators"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const url = new URL(request.url)
    const { page = 1, pageSize = 20, search } = paginationQuery.parse(Object.fromEntries(url.searchParams.entries()))
    const where: any = {}
    if (claims.role !== "SUPERADMIN") where.locationId = claims.locationId!
    if (search) where.companyName = { contains: search, mode: "insensitive" }

    const [items, total] = await Promise.all([
      prisma.partner.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: "desc" } }),
      prisma.partner.count({ where }),
    ])
    return withCors(ok(items, "Partners", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const json = await request.json()
    const data = upsertPartnerSchema.parse(json)
    const locationId = claims.role === "SUPERADMIN" ? (json.locationId as string | undefined) : claims.locationId!
    const createdEntity = await prisma.partner.create({ data: { ...data, locationId: locationId! } })
    return withCors(created(createdEntity, "Partner created"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
