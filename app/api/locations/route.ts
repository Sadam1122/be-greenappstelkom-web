import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertLocationSchema } from "@/lib/validators"

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
    if (search) {
      where.OR = [
        { desa: { contains: search, mode: "insensitive" } },
        { kecamatan: { contains: search, mode: "insensitive" } },
        { kabupaten: { contains: search, mode: "insensitive" } },
      ]
    }

    // SUPERADMIN bisa melihat semua lokasi
    if (claims.role === "SUPERADMIN") {
      const [items, total] = await prisma.$transaction([
        prisma.location.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { desa: "asc" },
        }),
        prisma.location.count({ where }),
      ])
      return withCors(ok(items, "Locations", { page, pageSize, total }), request)
    }
    
    // Role lain hanya bisa melihat lokasi mereka sendiri
    if (!claims.locationId) throw new ForbiddenError("Anda tidak terhubung dengan lokasi manapun.")
    const loc = await prisma.location.findUnique({ where: { id: claims.locationId } })
    const items = loc ? [loc] : []
    return withCors(ok(items, "Locations", { page: 1, pageSize: 1, total: items.length }), request)

  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN")

    const json = await request.json()
    const data = upsertLocationSchema.parse(json)

    const createdLoc = await prisma.location.create({ data })
    return withCors(created(createdLoc, "Location created"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
