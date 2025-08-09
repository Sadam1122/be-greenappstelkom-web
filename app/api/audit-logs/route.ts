import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery } from "@/lib/validators"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const url = new URL(request.url)
    const sp = Object.fromEntries(url.searchParams.entries())
    const { page = 1, pageSize = 20, search } = paginationQuery.parse(sp)

    const where: any = {}
    if (search) {
      where.OR = [{ action: { contains: search, mode: "insensitive" } }]
    }
    // Scope by locationId embedded in JSON details for ADMIN
    if (claims.role !== "SUPERADMIN" && claims.locationId) {
      where.details = { path: ["locationId"], equals: claims.locationId }
    }

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ])
    return withCors(ok(items, "Audit logs", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
