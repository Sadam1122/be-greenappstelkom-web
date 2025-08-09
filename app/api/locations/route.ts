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
    const parsed = paginationQuery.safeParse(Object.fromEntries(url.searchParams.entries()))
    const { page = 1, pageSize = 20, search } = parsed.success ? parsed.data : {}
    const where: any = {}
    if (search) {
      where.OR = [
        { desa: { contains: search, mode: "insensitive" } },
        { kecamatan: { contains: search, mode: "insensitive" } },
        { kabupaten: { contains: search, mode: "insensitive" } },
      ]
    }

    if (claims.role === "SUPERADMIN") {
      const [items, total] = await Promise.all([
        prisma.location.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: "desc" },
        } as any),
        prisma.location.count({ where }),
      ])
      return withCors(ok(items, "Locations", { page, pageSize, total }), request)
    }
    if (!claims.locationId) throw new ForbiddenError("Location scope required")
    const loc = await prisma.location.findUnique({ where: { id: claims.locationId } })
    return withCors(ok([loc].filter(Boolean), "Locations", { page: 1, pageSize: 1, total: loc ? 1 : 0 }), request)
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
