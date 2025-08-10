import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { mapErrorToResponse } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
// Impor disesuaikan dengan auth.ts yang baru
import { requireAuth, requireRole } from "@/lib/auth";
import { upsertTPS3RSchema } from "@/lib/validators";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

// PUT - Mengedit TPS3R
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    // Panggil requireRole dengan argumen terpisah
    requireRole(claims, "SUPERADMIN", "ADMIN");

    const json = await request.json();
    const validatedData = upsertTPS3RSchema.partial().parse(json);

    const tps3r = await prisma.tps3r.update({
      where: { id: params.id },
      data: validatedData,
    });

    return withCors(ok(tps3r, "TPS3R updated"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}

// DELETE - Menghapus TPS3R
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    // Panggil requireRole dengan argumen terpisah
    requireRole(claims, "SUPERADMIN", "ADMIN");

    await prisma.tps3r.delete({
      where: { id: params.id },
    });

    return withCors(ok({ id: params.id }, "TPS3R deleted"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}
