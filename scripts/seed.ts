import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

async function main() {
  // Seed a sample location
  const loc = await prisma.location.upsert({
    where: { unique_location: { desa: "Desa Contoh", kecamatan: "Kecamatan A", kabupaten: "Kabupaten B" } } as any,
    update: {},
    create: { desa: "Desa Contoh", kecamatan: "Kecamatan A", kabupaten: "Kabupaten B" },
  })

  const superEmail = "superadmin@example.com"
  const existing = await prisma.user.findUnique({ where: { email: superEmail } })
  if (!existing) {
    const password = await bcrypt.hash("ChangeMe123!", 10)
    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: superEmail,
        password,
        role: "SUPERADMIN",
        locationId: null,
      },
    })
    console.log("Created SUPERADMIN user:", superEmail)
  } else {
    console.log("SUPERADMIN already exists:", superEmail)
  }

  // Sample admin
  const adminEmail = "admin@example.com"
  if (!(await prisma.user.findUnique({ where: { email: adminEmail } }))) {
    const password = await bcrypt.hash("ChangeMe123!", 10)
    await prisma.user.create({
      data: {
        name: "Admin Desa",
        email: adminEmail,
        password,
        role: "ADMIN",
        locationId: loc.id,
      },
    })
    console.log("Created ADMIN user:", adminEmail)
  }

  console.log("Seed complete.")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
