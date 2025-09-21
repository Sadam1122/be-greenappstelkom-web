// File: beai/app/api/rewards/route.ts

import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertRewardSchema } from "@/lib/validators"

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
      prisma.reward.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.reward.count({ where }),
    ])
    return withCors(ok(items, "Rewards", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN", "ADMIN");
    const json = await request.json();
    
    // Zod now correctly parses optional fields
    const validatedData = upsertRewardSchema.parse(json); 
    
    const locationId = claims.role === "SUPERADMIN" ? (json.locationId as string | undefined) : claims.locationId!;
    
    // **THE FIX:** Build the data object safely, excluding undefined fields.
    const dataToCreate = {
      name: validatedData.name,
      pointsRequired: validatedData.pointsRequired,
      stock: validatedData.stock,
      locationId: locationId!,
      description: validatedData.description ?? "",
      imageUrl: validatedData.imageUrl ?? "",
    };
    
    const createdReward = await prisma.reward.create({
      data: dataToCreate
    });
    
    return withCors(created(createdReward, "Reward created"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}