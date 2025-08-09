import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole, enforceLocationScope } from "@/lib/auth"
import { assertRoleLocationCombination } from "@/lib/security"
import { updateUserSchema } from "@/lib/validators"
import bcrypt from "bcryptjs"
import { writeAudit } from "@/lib/audit"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const user = await prisma.user.findUnique({ where: { id: params.id } })
    if (!user) return withCors(ok(null, "User not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, user.locationId)
    const dto = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
      points: user.points,
      avatar: user.avatar,
      rw: user.rw,
      rt: user.rt,
    }
    return withCors(ok(dto, "User"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")
    const target = await prisma.user.findUnique({ where: { id: params.id } })
    if (!target) return withCors(ok(null, "User not found"), request)

    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, target.locationId)

    const json = await request.json()
    const update = updateUserSchema.parse(json)

    if (update.role !== undefined || update.locationId !== undefined) {
      const role = (update.role ?? target.role) as any
      const loc = (update.locationId ?? target.locationId) as any
      assertRoleLocationCombination(role, loc)
      if (claims.role === "ADMIN") {
        if (!claims.locationId) throw new ForbiddenError("Location scope required")
        if (role === "SUPERADMIN") throw new ForbiddenError("ADMIN cannot promote to SUPERADMIN")
        if (loc !== claims.locationId) throw new ForbiddenError("ADMIN cannot reassign outside their location")
      }
    }

    const data: any = { ...update }
    if (update.password) {
      data.password = await bcrypt.hash(update.password, 10)
      delete data.password
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
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
      },
    })

    await writeAudit({
      action: "USER_UPDATE",
      user: claims,
      locationId: updated.locationId ?? null,
      details: { updatedUserId: updated.id },
    })

    return withCors(ok(updated, "User updated"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN")

    const target = await prisma.user.findUnique({ where: { id: params.id } })
    if (!target) return withCors(ok(null, "User not found"), request)

    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, target.locationId)

    if (target.role === "SUPERADMIN") {
      const count = await prisma.user.count({ where: { role: "SUPERADMIN", id: { not: target.id } } })
      if (count === 0) throw new ForbiddenError("Cannot delete the last SUPERADMIN")
    }

    const deleted = await prisma.user.delete({ where: { id: params.id } })

    await writeAudit({
      action: "USER_DELETE",
      user: claims,
      locationId: deleted.locationId ?? null,
      details: { deletedUserId: deleted.id },
    })

    return withCors(ok({ id: deleted.id }, "User deleted"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
