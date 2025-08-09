import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, enforceLocationScope } from "@/lib/auth"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    const tx = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: { wasteCategory: true, user: true, processedByUser: true },
    })
    if (!tx) return withCors(ok(null, "Not found"), request)
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, tx.locationId)
    return withCors(ok(tx, "Transaction"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
