import { prisma } from "@/lib/prisma"
import { mapErrorToResponse, ValidationError } from "@/lib/error"
import { withCors, handleCorsPreflight } from "@/lib/cors"
import { ok, err } from "@/lib/response"
import { loginSchema } from "@/lib/validators"
import { rateLimit, ipKey } from "@/lib/rate-limiter"
import { logJSON } from "@/lib/logger"
import { signAuthJWT, setAuthCookie } from "@/lib/auth"
import bcrypt from "bcryptjs"

export async function OPTIONS(request: Request) {
  return handleCorsPreflight(request) ?? new Response(null, { status: 204 })
}

export async function POST(request: Request) {
  const pre = handleCorsPreflight(request)
  if (pre) return pre
  try {
    const ip = ipKey(request)
    const rl = rateLimit(`login:${ip}`, 10, 60_000)
    if (!rl.allowed) {
      return withCors(err("Too many requests", undefined, 429), request)
    }

    const json = await request.json()
    const parsed = loginSchema.safeParse(json)
    if (!parsed.success) throw new ValidationError("Invalid credentials payload")

    const { email, password } = parsed.data
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return withCors(err("Invalid email or password", undefined, 401), request)
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) {
      return withCors(err("Invalid email or password", undefined, 401), request)
    }

    const { token } = await signAuthJWT({
      sub: user.id,
      role: user.role,
      locationId: user.locationId ?? null,
    })

    await setAuthCookie(token)

    logJSON("info", "user_login", { userId: user.id, role: user.role })
    const resp = ok(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
        points: user.points,
        avatar: user.avatar,
      },
      "Login successful",
    )
    return withCors(resp, request)
  } catch (e) {
    return withCors(mapErrorToResponse(e), request)
  }
}
