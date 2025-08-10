import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth, requireRole } from "@/lib/auth"
import { paginationQuery } from "@/lib/validators"

// Menangani permintaan preflight OPTIONS untuk CORS
export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

// Handler utama untuk GET request
export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  
  try {
    const claims = await requireAuth()
    // Hanya izinkan role yang berhak mengakses data nasabah
    requireRole(claims, "SUPERADMIN", "ADMIN", "PETUGAS")

    const url = new URL(request.url)
    const { page = 1, pageSize = 20, search } = paginationQuery.parse(Object.fromEntries(url.searchParams.entries()))

    const where: any = {
      // Pastikan hanya mengambil pengguna dengan role NASABAH
      role: 'NASABAH'
    }

    // Filter pencarian berdasarkan nama atau email
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ]
    }

    // Terapkan filter lokasi secara otomatis untuk ADMIN dan PETUGAS
    if (claims.role !== "SUPERADMIN") {
      if (!claims.locationId) {
        throw new ForbiddenError("Anda tidak terhubung dengan lokasi manapun.")
      }
      where.locationId = claims.locationId
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          locationId: true,
          rw: true,
          rt: true,
          createdAt: true,
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: "asc" },
      }),
      prisma.user.count({ where }),
    ])

    return withCors(ok(items, "Customers fetched successfully", { page, pageSize, total }), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}