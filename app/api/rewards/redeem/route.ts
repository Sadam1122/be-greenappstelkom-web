import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth } from "@/lib/auth"
import { redeemRewardSchema } from "@/lib/validators"
import { writeAudit } from "@/lib/audit"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const claims = await requireAuth()
    if (claims.role !== "NASABAH") throw new ForbiddenError("Only NASABAH can redeem rewards")
    const json = await request.json()
    const { rewardId } = redeemRewardSchema.parse(json)

    const [user, reward] = await Promise.all([
      prisma.user.findUnique({ where: { id: claims.sub } }),
      prisma.reward.findUnique({ where: { id: rewardId } }),
    ])
    if (!user || !reward) throw new ForbiddenError("Invalid user or reward")
    // enforce same location by comparing user and reward
    if (user.locationId !== reward.locationId) throw new ForbiddenError("Cross-location redemption is not allowed")

    if (user.points < reward.pointsRequired) throw new ForbiddenError("Insufficient points")
    if (reward.stock <= 0) throw new ForbiddenError("Out of stock")

    const redemption = await prisma.$transaction(async (db) => {
      await db.user.update({ where: { id: user.id }, data: { points: { decrement: reward.pointsRequired } } })
      await db.reward.update({ where: { id: reward.id }, data: { stock: { decrement: 1 } } })
      const red = await db.rewardRedemption.create({
        data: { userId: user.id, rewardId: reward.id, pointsSpent: reward.pointsRequired },
      })
      return red
    })

    await writeAudit({
      action: "REWARD_REDEEM",
      user: claims,
      locationId: reward.locationId,
      details: { rewardId, redemptionId: redemption.id, pointsSpent: reward.pointsRequired },
    })

    return withCors(ok(redemption, "Reward redeemed"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
