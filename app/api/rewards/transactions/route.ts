import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { mapErrorToResponse, ForbiddenError } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";

export async function OPTIONS(request: Request) {
    return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

export async function GET(request: Request) {
    const pre = handleCorsPreflight(request);
    if (pre) return pre;
    try {
        const claims = await requireAuth();
        requireRole(claims, "SUPERADMIN", "ADMIN");

        const where: any = {};
        if (claims.role === "ADMIN") {
            where.user = { locationId: claims.locationId };
        }

        const transactions = await prisma.rewardRedemption.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        avatar: true,
                        location: { select: { desa: true } },
                    },
                },
                reward: {
                    select: { name: true },
                },
            },
            orderBy: { redeemedAt: "desc" },
        });

        const formattedTxs = transactions.map(tx => ({
            id: tx.id,
            rewardId: tx.rewardId,
            rewardName: tx.reward.name,
            userId: tx.userId,
            userName: tx.user.name,
            userAvatar: tx.user.avatar,
            desaName: tx.user.location?.desa,
            pointsUsed: tx.pointsSpent,
            status: tx.status,
            createdAt: tx.redeemedAt.toISOString(),
        }))

        return withCors(ok(formattedTxs, "Redemption transactions retrieved"), request);
    } catch (e) {
        return withCors(mapErrorToResponse(e), request);
    }
}