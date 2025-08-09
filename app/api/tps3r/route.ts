import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertTPS3RSchema } from "@/lib/validators"

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
    if (search) where.name = { contains: search, mode: "insensitive" }

    const [items, total] = await Promise.all([
      prisma.tps3r.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { lastUpdated: "desc" } }),
      prisma.tps3r.count({ where }),
    ])
    return withCors(ok(items, "TPS3R", { page, pageSize, total }), request)
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
    const data = upsertTPS3RSchema.parse(json)
    const locationId = claims.role === "SUPERADMIN" ? (json.locationId as string | undefined) : claims.locationId!
    const createdEntity = await prisma.tps3r.create({ data: { ...data, locationId: locationId! } })
    return withCors(created(createdEntity, "TPS3R created"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
