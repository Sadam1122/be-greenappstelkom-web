import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/response";
import { mapErrorToResponse, ForbiddenError } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";

export async function OPTIONS(request: Request) {
    return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const pre = handleCorsPreflight(request);
    if (pre) return pre;
    try {
        const claims = await requireAuth();
        requireRole(claims, "SUPERADMIN", "ADMIN");

        const redemption = await prisma.rewardRedemption.findUnique({
            where: { id: params.id },
            include: { reward: true, user: true },
        });

        if (!redemption) {
            return err("Redemption not found", undefined, 404);
        }
        if (redemption.status !== 'PENDING') {
            throw new ForbiddenError('This request has already been processed.');
        }
        if (claims.role === 'ADMIN' && redemption.user.locationId !== claims.locationId) {
            throw new ForbiddenError('You can only approve requests for your location.');
        }

        // Use a transaction to ensure atomicity
        const result = await prisma.$transaction(async (db) => {
            // 1. Decrement user points
            await db.user.update({
                where: { id: redemption.userId },
                data: { points: { decrement: redemption.pointsSpent } },
            });

            // 2. Decrement reward stock
            await db.reward.update({
                where: { id: redemption.rewardId },
                data: { stock: { decrement: 1 } },
            });

            // 3. Update redemption status to APPROVED
            return db.rewardRedemption.update({
                where: { id: params.id },
                data: { status: 'APPROVED' },
            });
        });

        return withCors(ok(result, "Redemption approved successfully"), request);
    } catch (e) {
        return withCors(mapErrorToResponse(e), request);
    }
}