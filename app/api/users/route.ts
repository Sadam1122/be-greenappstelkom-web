import { prisma } from "@/lib/prisma"
import { ok, created } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { createUserSchema, paginationQuery } from "@/lib/validators"
import { assertRoleLocationCombination } from "@/lib/security"
import bcrypt from "bcryptjs"
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
    const { page = 1, pageSize = 20, search } = paginationQuery.parse(Object.fromEntries(url.searchParams.entries()))

    const where: any = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }
    if (claims.role !== "SUPERADMIN") {
      if (!claims.locationId) throw new ForbiddenError("Location scope required")
      where.locationId = claims.locationId
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          locationId: true,
          points: true,
          avatar: true,
          rw: true,
          rt: true,
          createdAt: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ])

    return withCors(ok(items, "Users", { page, pageSize, total }), request)
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
    const data = createUserSchema.parse(json)

    assertRoleLocationCombination(data.role, data.locationId ?? null)

    if (claims.role === "ADMIN") {
      if (!claims.locationId) throw new ForbiddenError("Location scope required")
      if (data.role === "SUPERADMIN") throw new ForbiddenError("ADMIN cannot create SUPERADMIN")
      if (data.locationId !== claims.locationId) throw new ForbiddenError("ADMIN can only create within their location")
    }

    const hashed = await bcrypt.hash(data.password, 10)

    const createdUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        role: data.role,
        locationId: data.role === "SUPERADMIN" ? null : (data.locationId as string),
        avatar: data.avatar,
        rw: data.rw,
        rt: data.rt,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        locationId: true,
        points: true,
        avatar: true,
        rw: true,
        rt: true,
        createdAt: true,
      },
    })

    await writeAudit({
      action: "USER_CREATE",
      user: claims,
      locationId: createdUser.locationId ?? null,
      details: { createdUserId: createdUser.id, role: createdUser.role },
    })

    return withCors(created(createdUser, "User created"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
