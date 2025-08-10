import { prisma } from "@/lib/prisma";
import { ok, created } from "@/lib/response";
import { mapErrorToResponse } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";
import { upsertTPS3RSchema, paginationQuery } from "@/lib/validators";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

// GET - Menampilkan daftar TPS3R (DIBUAT PUBLIK)
export async function GET(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    // HAPUS 'await requireAuth()' untuk membuat endpoint ini bisa diakses publik.
    // Logika filter berdasarkan peran juga dihapus karena tidak relevan lagi untuk GET.
    
    const tps3rList = await prisma.tps3r.findMany({
      include: {
        location: { select: { desa: true } }, // Sertakan nama desa
      },
      orderBy: { name: 'asc' },
    });

    return withCors(ok(tps3rList, "TPS3R list retrieved"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}

// POST - Membuat TPS3R baru (TETAP MEMERLUKAN LOGIN)
export async function POST(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN", "ADMIN");

    const json = await request.json();
    const validatedData = upsertTPS3RSchema.parse(json);

    let locationId: string;

    if (claims.role === 'SUPERADMIN') {
      if (!json.locationId) {
        throw new Error("Location ID is required for SUPERADMIN.");
      }
      locationId = json.locationId;
    } else {
      locationId = claims.locationId!;
    }
    
    const tps3r = await prisma.tps3r.create({
      data: {
        ...validatedData,
        locationId: locationId,
      },
    });

    return withCors(created(tps3r, "TPS3R created"), request);
  } catch (e) {
    return withCors(mapErrorToResponse(e), request);
  }
}
