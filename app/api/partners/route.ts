import { prisma } from "@/lib/prisma";
import { ok, created } from "@/lib/response";
import { mapErrorToResponse } from "@/lib/error";
import { withCors, handleCorsPreflight } from "@/lib/cors";
import { requireAuth, requireRole } from "@/lib/auth";
// Ubah impor di sini
import { paginationQuery, createPartnerSchema } from "@/lib/validators";
import { writeAudit } from "@/lib/audit";

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 });
}

// GET handler (Dibuat Publik)
export async function GET(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    // HAPUS baris 'await requireAuth()' untuk membuat endpoint ini publik
    const url = new URL(request.url);
    const { page = 1, pageSize = 20, search } = paginationQuery.parse(Object.fromEntries(url.searchParams.entries()));

    const where: any = {};
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.partner.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          location: { select: { desa: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.partner.count({ where }),
    ]);

    return withCors(ok(items, "Partners retrieved", { page, pageSize, total }), request);
  } catch (e) {
    console.error("GET /api/partners Error:", e);
    return withCors(mapErrorToResponse(e), request);
  }
}


// POST - Untuk membuat kaitan partner baru (TETAP MEMERLUKAN LOGIN)
export async function POST(request: Request) {
  const pre = handleCorsPreflight(request);
  if (pre) return pre;
  try {
    const claims = await requireAuth();
    requireRole(claims, "SUPERADMIN");

    const json = await request.json();
    // Gunakan skema yang benar di sini
    const validatedData = createPartnerSchema.parse(json);

    // validatedData sudah berisi userId dari frontend, jadi bisa langsung digunakan
    const partner = await prisma.partner.create({
      data: validatedData,
    });

    await writeAudit({
      action: "PARTNER_CREATE",
      user: claims,
      locationId: partner.locationId,
      details: { partnerId: partner.id, name: partner.companyName },
    });

    return withCors(created(partner, "Partner created"), request);
  } catch (e) {
    console.error("POST /api/partners Error:", e);
    return withCors(mapErrorToResponse(e), request);
  }
}
