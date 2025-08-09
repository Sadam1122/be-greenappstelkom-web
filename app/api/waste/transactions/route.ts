import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth } from "@/lib/auth"
import { createTransactionSchema, paginationQuery } from "@/lib/validators"
import { writeAudit } from "@/lib/audit"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const url = new URL(request.url)
    const sp = Object.fromEntries(url.searchParams.entries())
    const { page = 1, pageSize = 20 } = paginationQuery.parse(sp)
    const where: any = {}
    if (claims.role !== "SUPERADMIN") where.locationId = claims.locationId!
    if (sp.status) where.status = sp.status as any
    if (sp.type) where.type = sp.type as any
    if (sp.userId) where.userId = sp.userId
    if (sp.from || sp.to) {
      where.createdAt = {}
      if (sp.from) (where.createdAt as any).gte = new Date(sp.from)
      if (sp.to) (where.createdAt as any).lte = new Date(sp.to)
    }
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { wasteCategory: true, user: { select: { id: true, name: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.transaction.count({ where }),
    ])
    return withCors(ok(items, "Transactions", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const json = await request.json()
    const data = createTransactionSchema.parse(json)
    // Determine owner NASABAH userId
    let ownerUserId = data.userId
    if (claims.role === "NASABAH") {
      ownerUserId = claims.sub
    } else if (claims.role === "ADMIN" || claims.role === "PETUGAS") {
      if (!ownerUserId) throw new ForbiddenError("userId is required when creating on behalf")
    }
    const locationId = claims.role === "SUPERADMIN" ? (json.locationId as string | undefined) : claims.locationId!

    const tx = await prisma.transaction.create({
      data: {
        userId: ownerUserId!,
        wasteCategoryId: data.wasteCategoryId,
        type: data.type,
        status: "PENDING",
        locationDetail: data.locationDetail,
        scheduledDate: new Date(data.scheduledDate),
        photos: data.photos ?? [],
        locationId: locationId!,
      },
      include: { wasteCategory: true },
    })

    await writeAudit({
      action: "TRANSACTION_CREATE",
      user: claims,
      locationId: tx.locationId,
      details: { transactionId: tx.id, userId: ownerUserId, type: tx.type },
    })

    return withCors(created(tx, "Transaction created"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
