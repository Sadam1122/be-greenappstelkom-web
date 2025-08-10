import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertFinancialEntrySchema } from "@/lib/validators"

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
    if (sp.from || sp.to) {
      where.date = {}
      if (sp.from) (where.date as any).gte = new Date(sp.from)
      if (sp.to) (where.date as any).lte = new Date(sp.to)
    }
    const [items, total] = await Promise.all([
      prisma.financialEntry.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { date: "desc" } }),
      prisma.financialEntry.count({ where }),
    ])
    return withCors(ok(items, "Financial entries", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function POST(request: Request) {
  try {
    const claims = await requireAuth();
    const json = await request.json();
    const validatedData = upsertFinancialEntrySchema.parse(json);

    const dataToCreate: any = {
      ...validatedData,
      createdByUserId: claims.sub,
      locationId: claims.locationId,
    };
    
    // Pastikan hanya INCOME dari SUPERADMIN yang bisa punya partnerId
    if (validatedData.type === 'EXPENSE' || claims.role !== 'SUPERADMIN') {
        delete dataToCreate.partnerId;
    }

    const financialEntry = await prisma.financialEntry.create({
      data: dataToCreate,
    });
    return withCors(created(financialEntry), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}