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
            include: { user: true },
        });

        if (!redemption) {
            return err("Redemption not found", undefined, 404);
        }
         if (redemption.status !== 'PENDING') {
            throw new ForbiddenError('This request has already been processed.');
        }
        if (claims.role === 'ADMIN' && redemption.user.locationId !== claims.locationId) {
            throw new ForbiddenError('You can only reject requests for your location.');
        }

        const result = await prisma.rewardRedemption.update({
            where: { id: params.id },
            data: { status: 'REJECTED' },
        });

        return withCors(ok(result, "Redemption rejected"), request);
    } catch (e) {
        return withCors(mapErrorToResponse(e), request);
    }
}