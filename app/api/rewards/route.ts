// File: beai/app/api/rewards/route.ts

import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery, upsertRewardSchema } from "@/lib/validators"
import { ZodError } from "zod"      // <-- IMPORT ZodError

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
  const pre = handleCorsPreflight(request)
  if (pre) return pre

  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")

    const json = await request.json()
    const validatedData = upsertRewardSchema.parse(json)

    const locationIdFromBody =
      typeof json?.locationId === "string" && json.locationId.trim() !== ""
        ? json.locationId.trim()
        : undefined

    let finalLocationId: string | null = null
    if (claims.role === "SUPERADMIN") {
      if (!locationIdFromBody) {
        return withCors(
          new Response(
            JSON.stringify({
              status: "error",
              message: "locationId is required for SUPERADMIN when creating a reward",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          request
        )
      }
      finalLocationId = locationIdFromBody
    } else {
      if (!claims.locationId) {
        return withCors(
          new Response(
            JSON.stringify({
              status: "error",
              message: "Admin user does not have an associated location",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          ),
          request
        )
      }
      finalLocationId = claims.locationId
    }

    const dataToCreate: any = {
      name: validatedData.name,
      pointsRequired: validatedData.pointsRequired,
      stock: validatedData.stock,
      locationId: finalLocationId,
      description: validatedData.description ?? null,
      imageUrl: validatedData.imageUrl ?? null,
    }

    const createdReward = await prisma.reward.create({
      data: dataToCreate,
    })

    return withCors(created(createdReward, "Reward created"), request)
  } catch (e: any) {
    // Pastikan kita bisa deteksi ZodError — import sudah ditambahkan di atas.
    if (e instanceof ZodError) {
      console.error("POST /api/rewards ZOD validation error:", JSON.stringify(e.flatten(), null, 2))
      const body = {
        status: "error",
        message: "Validation error",
        details: e.flatten(),
      }
      return withCors(
        new Response(JSON.stringify(body), { status: 422, headers: { "Content-Type": "application/json" } }),
        request
      )
    }

    console.error("POST /api/rewards ERROR:", e)
    return withCors(mapErrorToResponse(e), request)
  }
}
