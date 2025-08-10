import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth } from "@/lib/auth"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function GET(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  
  try {
    await requireAuth()

    const url = new URL(request.url)
    const locationId = url.searchParams.get("locationId")

    const where: any = {
      role: 'NASABAH' 
    }

    if (locationId) {
      where.locationId = locationId
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: {
        points: "desc",
      },
      take: 100, // Ambil lebih banyak untuk memastikan peringkat akurat
      select: {
        id: true,
        name: true,
        points: true,
        avatar: true,
        locationId: true,
      },
    })

    // --- PERBAIKAN DI SINI: Tambahkan nomor peringkat ---
    const leaderboard = users.map((user, index) => ({
      ...user,
      rank: index + 1, // Menambahkan peringkat berdasarkan urutan
      userId: user.id, // Menambahkan alias agar konsisten dengan frontend
    }))

    return withCors(ok(leaderboard, "Leaderboard fetched successfully"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
