import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, enforceLocationScope } from "@/lib/auth"
import { writeAudit } from "@/lib/audit"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const tx = await prisma.transaction.findUnique({ where: { id: params.id } })
    if (!tx) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, tx.locationId)
    if (tx.status !== "PENDING") throw new ForbiddenError("Only PENDING transactions can be cancelled")
    const isOwner = tx.userId === claims.sub
    const canCancel = isOwner || claims.role === "SUPERADMIN" || claims.role === "ADMIN"
    if (!canCancel) throw new ForbiddenError("Not allowed to cancel")
    const cancelled = await prisma.transaction.update({ where: { id: params.id }, data: { status: "CANCELLED" } })

    await writeAudit({
      action: "TRANSACTION_CANCEL",
      user: claims,
      locationId: cancelled.locationId,
      details: { transactionId: cancelled.id },
    })

    return withCors(ok(cancelled, "Transaction cancelled"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
