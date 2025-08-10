import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { mapErrorToResponse, ForbiddenError } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";
import { updatePartnerSchema } from "@/lib/validators"; // Gunakan skema update yang baru
import { writeAudit } from "@/lib/audit";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

// PUT - Untuk mengedit partner
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN");

    const json = await request.json();
    // Validasi menggunakan skema update yang memperbolehkan field parsial
    const validatedData = updatePartnerSchema.parse(json);

    // Keamanan tambahan: pastikan userId atau locationId tidak ikut terkirim dalam payload edit
    if ('userId' in validatedData || 'locationId' in validatedData) {
      throw new ForbiddenError("User atau Lokasi dari seorang mitra tidak dapat diubah.");
    }

    const partner = await prisma.partner.update({
      where: { id: params.id },
      data: validatedData,
    });

    await writeAudit({
      action: "PARTNER_UPDATE",
      user: claims,
      locationId: partner.locationId,
      details: { partnerId: partner.id, name: partner.companyName },
    });

    return withCors(ok(partner, "Partner updated"), request);
  } catch (e) {
    console.error("PUT /api/partners/[id] Error:", e);
    return withCors(mapErrorToResponse(e), request);
  }
}

// DELETE - Untuk menghapus partner
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN");

    await prisma.partner.delete({
      where: { id: params.id },
    });

    return withCors(ok({ id: params.id }, "Partner deleted"), request);
  } catch (e) {
    console.error("DELETE /api/partners/[id] Error:", e);
    return withCors(mapErrorToResponse(e), request);
  }
}
