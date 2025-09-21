// File: beai/app/api/rewards/[id]/route.ts

import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { mapErrorToResponse } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole, enforceLocationScope } from "@/lib/auth";
import { upsertRewardSchema } from "@/lib/validators";
import { ZodError } from "zod";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN", "ADMIN");

    const { id } = params;
    const json = await request.json();

    const validatedData = upsertRewardSchema.partial().parse(json);

    const existingReward = await prisma.reward.findUnique({ where: { id } });
    if (!existingReward) {
      return withCors(ok(null, "Reward not found"), request);
    }

    if (claims.role !== "SUPERADMIN") {
      enforceLocationScope(claims, existingReward.locationId);
    }

    const updatedReward = await prisma.reward.update({
      where: { id },
      data: validatedData,
    });

    return withCors(ok(updatedReward, "Reward updated successfully"), request);
  } catch (e) {
    if (e instanceof ZodError) {
      console.error("ZOD VALIDATION ERROR DETAILS:", JSON.stringify(e.flatten(), null, 2));
    }
    return withCors(mapErrorToResponse(e), request);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN", "ADMIN");
    const existing = await prisma.reward.findUnique({ where: { id: params.id } });
    if (!existing) return withCors(ok(null, "Not found"), request);
    if (claims.role !== "SUPERADMIN") enforceLocationScope(claims, existing.locationId);
    const deleted = await prisma.reward.delete({ where: { id: params.id } });
    return withCors(ok(deleted, "Reward deleted"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}