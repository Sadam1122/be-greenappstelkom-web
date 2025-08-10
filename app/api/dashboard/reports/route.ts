import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { z } from "zod"

const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  locationId: z.string().optional(),
})

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
    const query = reportQuerySchema.parse(Object.fromEntries(url.searchParams.entries()))

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (query.startDate) dateFilter.gte = new Date(query.startDate)
    if (query.endDate) dateFilter.lte = new Date(query.endDate)

    let locationFilter: string | undefined = undefined
    if (claims.role === "ADMIN") {
      if (!claims.locationId) throw new ForbiddenError("Admin harus terhubung dengan lokasi.")
      locationFilter = claims.locationId
    } else if (claims.role === "SUPERADMIN" && query.locationId) {
      locationFilter = query.locationId
    }

    const whereClause: any = {
      createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      locationId: locationFilter,
    }

    const keyMetricsPromise = prisma.$transaction([
      prisma.user.count({ where: { locationId: locationFilter, role: 'NASABAH' } }),
      prisma.transaction.count({ where: { ...whereClause, status: 'COMPLETED' } }),
      prisma.transaction.aggregate({ where: { ...whereClause, status: 'COMPLETED' }, _sum: { actualWeight: true } }),
      prisma.financialEntry.aggregate({ where: { ...whereClause, type: 'INCOME' }, _sum: { amount: true } }),
      prisma.financialEntry.aggregate({ where: { ...whereClause, type: 'EXPENSE' }, _sum: { amount: true } }),
    ])

    const wasteDistributionPromise = prisma.transaction.groupBy({
      by: ['wasteCategoryId'],
      where: { ...whereClause, status: 'COMPLETED', actualWeight: { not: null } },
      _sum: { actualWeight: true },
      take: 5,
      orderBy: { _sum: { actualWeight: 'desc' } }
    })
    
    const [keyMetrics, wasteDistributionData] = await Promise.all([keyMetricsPromise, wasteDistributionPromise])
    
    const [totalUsers, totalTransactions, totalWeight, totalIncome, totalExpense] = keyMetrics;

    const categoryIds = wasteDistributionData.map(item => item.wasteCategoryId);
    const categories = await prisma.wasteCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true }
    });
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    const wasteDistribution = wasteDistributionData.map(item => ({
      name: categoryMap.get(item.wasteCategoryId)?.name || "Lainnya",
      value: item._sum.actualWeight || 0,
      color: categoryMap.get(item.wasteCategoryId)?.color || "#8884d8",
    }));

    const netBalance = (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0);

    const report = {
      keyMetrics: {
        totalUsers,
        totalTransactions,
        totalWeightKg: totalWeight._sum.actualWeight || 0,
        totalIncome: totalIncome._sum.amount || 0,
        totalExpense: totalExpense._sum.amount || 0,
        netBalance,
      },
      wasteDistribution,
    }

    return withCors(ok(report, "Report generated successfully"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}