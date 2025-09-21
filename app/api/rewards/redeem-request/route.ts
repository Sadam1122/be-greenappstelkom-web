import { prisma } from "@/lib/prisma";
import { created, err } from "@/lib/response";
import { mapErrorToResponse, ForbiddenError } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

const redeemRequestSchema = z.object({
  rewardId: z.string(),
});

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    if (claims.role !== "NASABAH") {
      throw new ForbiddenError("Only customers can request to redeem rewards.");
    }

    const json = await request.json();
    const { rewardId } = redeemRequestSchema.parse(json);

    const [user, reward] = await Promise.all([
      prisma.user.findUnique({ where: { id: claims.sub } }),
      prisma.reward.findUnique({ where: { id: rewardId } }),
    ]);

    if (!user || !reward) {
      throw new ForbiddenError("Invalid user or reward.");
    }
    if (user.points < reward.pointsRequired) {
      throw new ForbiddenError("Insufficient points.");
    }
    if (reward.stock <= 0) {
      throw new ForbiddenError("This reward is out of stock.");
    }

    // Create a pending redemption request
    const redemptionRequest = await prisma.rewardRedemption.create({
      data: {
        userId: user.id,
        rewardId: reward.id,
        pointsSpent: reward.pointsRequired,
        status: "PENDING",
      },
    });

    return withCors(created(redemptionRequest, "Redemption request submitted and is pending approval."), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}