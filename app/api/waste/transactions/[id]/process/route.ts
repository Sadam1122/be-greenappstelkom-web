import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole, enforceLocationScope } from "@/lib/auth"
import { processTransactionSchema } from "@/lib/validators"
import { writeAudit } from "@/lib/audit"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    requireRole(claims, "SUPERADMIN", "ADMIN", "PETUGAS")
    const json = await request.json()
    const { actualWeight, notes } = processTransactionSchema.parse(json)

    const txExisting = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { wasteCategory: true },
    })
    if (!txExisting) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, txExisting.locationId)
    if (txExisting.status !== "PENDING") throw new ForbiddenError("Only PENDING transactions can be processed")

    const points = Math.floor(actualWeight * txExisting.wasteCategory.pointsPerKg)

    const result = await prisma.$transaction(async (db) => {
      const completed = await db.transaction.update({
        where: { id: params.id },
        data: {
          status: "COMPLETED",
          actualWeight,
          points,
          notes: notes ?? txExisting.notes,
          processedByUserId: claims.sub,
          completedDate: new Date(),
        },
      })
      await db.user.update({ where: { id: txExisting.userId }, data: { points: { increment: points } } })
      return completed
    })

    await writeAudit({
      action: "TRANSACTION_PROCESS",
      user: claims,
      locationId: result.locationId,
      details: { transactionId: result.id, pointsAwarded: points, actualWeight },
    })

    return withCors(ok(result, "Transaction processed"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
