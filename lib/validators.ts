import { z } from "zod"

// Common
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().trim().optional(),
  orderBy: z.string().optional(),
  orderDir: z.enum(["asc", "desc"]).optional(),
})

// Auth
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// Locations
export const upsertLocationSchema = z.object({
  desa: z.string().min(2).max(100).trim(),
  kecamatan: z.string().min(2).max(100).trim(),
  kabupaten: z.string().min(2).max(100).trim(),
})

// Users
export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["SUPERADMIN", "ADMIN", "PETUGAS", "NASABAH"]).default("NASABAH"),
  avatar: z.string().url().optional(),
  locationId: z.string().nullable().optional(),
  rw: z.string().optional(),
  rt: z.string().optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "PETUGAS", "NASABAH"]).optional(),
  locationId: z.string().nullable().optional(),
  avatar: z.string().url().optional(),
  rw: z.string().optional(),
  rt: z.string().optional(),
})

// Waste Categories
export const upsertWasteCategorySchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  color: z.string().optional(),
  pointsPerKg: z.coerce.number().int().min(0),
})

// Transactions
export const createTransactionSchema = z.object({
  userId: z.string().optional(), // Admin/Petugas can create for user; Nasabah omit
  wasteCategoryId: z.string(),
  type: z.enum(["PICKUP", "DROPOFF"]),
  locationDetail: z.string().min(3),
  scheduledDate: z.coerce.date(),
  photos: z.array(z.string().url()).optional(),
})

export const processTransactionSchema = z.object({
  actualWeight: z.coerce.number().positive(),
  notes: z.string().optional(),
})

// Rewards
export const upsertRewardSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().min(1),
  pointsRequired: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0),
  icon: z.string().url().optional(),
})

export const redeemRewardSchema = z.object({
  rewardId: z.string(),
})

// TPS3R, Partners, Financial
export const upsertTPS3RSchema = z.object({
  name: z.string().min(2).max(100),
  status: z.string().min(1),
  capacity: z.coerce.number().min(0),
  currentLoad: z.coerce.number().min(0),
  manager: z.string().min(2).max(100),
})

export const upsertPartnerSchema = z.object({
  userId: z.string(),
  companyName: z.string().min(2),
  type: z.enum(["GOVERNMENT", "INSTITUTION", "COLLECTOR", "OTHER"]),
  address: z.string().optional(),
  phone: z.string().optional(),
})

export const upsertFinancialEntrySchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.coerce.number().min(0),
  description: z.string().min(1),
  date: z.coerce.date(),
  relatedTransactionId: z.string().optional(),
})
