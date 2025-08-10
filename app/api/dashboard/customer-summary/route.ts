import { prisma } from "@/lib/prisma"
import { ok } from "@/lib/response"
import { mapErrorToResponse, ForbiddenError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { requireAuth } from "@/lib/auth"

// Tipe data untuk insight AI
type Insight = {
  title: string
  description: string
  type: "positive" | "suggestion" | "info"
}

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
    if (claims.role !== "NASABAH") {
      throw new ForbiddenError("Hanya Nasabah yang dapat mengakses ringkasan ini.")
    }

    // 1. Ambil data pengguna terbaru, termasuk poin
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { points: true }
    })
    if (!user) throw new ForbiddenError("Pengguna tidak ditemukan.")

    // 2. Agregasi data komposisi sampah dari transaksi yang selesai
    const wasteCompositionData = await prisma.transaction.groupBy({
      by: ["wasteCategoryId"],
      where: {
        userId: claims.sub,
        status: "COMPLETED",
        actualWeight: { not: null },
      },
      _sum: {
        actualWeight: true,
      },
    })

    // Ambil nama kategori sampah
    const categoryIds = wasteCompositionData.map(item => item.wasteCategoryId)
    const categories = await prisma.wasteCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true, color: true }
    })
    const categoryMap = new Map(categories.map(c => [c.id, { name: c.name, color: c.color }]))

    const wasteComposition = wasteCompositionData.map(item => ({
      name: categoryMap.get(item.wasteCategoryId)?.name || "Lainnya",
      value: item._sum.actualWeight || 0,
      color: categoryMap.get(item.wasteCategoryId)?.color || "#8884d8",
    })).filter(item => item.value > 0);

    // 3. Hasilkan Wawasan Cerdas (AI Sederhana)
    const insights: Insight[] = []
    if (wasteComposition.length > 0) {
      const topCategory = [...wasteComposition].sort((a, b) => b.value - a.value)[0]
      insights.push({
        title: "Kontribusi Terbesarmu!",
        description: `Anda paling banyak berkontribusi pada kategori sampah ${topCategory.name}. Kerja bagus dalam menjaga lingkungan!`,
        type: "positive"
      })
    } else {
       insights.push({
        title: "Mulai Perjalanan Hijau Anda",
        description: "Anda belum memiliki transaksi. Buat transaksi pertamamu dan mulai kumpulkan poin!",
        type: "info"
      })
    }
    
    // Perbaikan untuk error TypeScript: Cek jika locationId ada sebelum query
    if (claims.locationId) {
      const nearestReward = await prisma.reward.findFirst({
        where: { 
          pointsRequired: { gt: user.points }, 
          locationId: claims.locationId 
        },
        orderBy: { pointsRequired: 'asc' }
      });

      if (nearestReward) {
        const pointsNeeded = nearestReward.pointsRequired - user.points;
        insights.push({
          title: `Hanya ${pointsNeeded} poin lagi!`,
          description: `Anda semakin dekat untuk bisa menukarkan hadiah "${nearestReward.name}". Terus kumpulkan poin!`,
          type: "suggestion"
        })
      }
    }

    const summary = {
      points: user.points,
      wasteComposition,
      insights
    }

    return withCors(ok(summary, "Customer summary fetched"), request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
