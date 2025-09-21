import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/response";
import { mapErrorToResponse, ForbiddenError } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth } from "@/lib/auth";

// Menangani permintaan preflight OPTIONS untuk CORS
export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

// Handler untuk mengambil riwayat penukaran milik pengguna yang sedang login
export async function GET(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;

  try {
    const claims = await requireAuth();
    // Endpoint ini hanya untuk nasabah
    if (claims.role !== "NASABAH") {
      throw new ForbiddenError("Hanya nasabah yang dapat melihat riwayat penukaran.");
    }

    const history = await prisma.rewardRedemption.findMany({
      where: {
        userId: claims.sub, // Mengambil data hanya untuk pengguna yang login
      },
      include: {
        reward: { // Mengambil detail nama hadiah
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        redeemedAt: "desc", // Diurutkan dari yang terbaru
      },
      take: 50, // Batasi jumlah data untuk performa
    });

    return withCors(ok(history, "Riwayat penukaran berhasil diambil"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}