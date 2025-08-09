import "server-only"
import { cookies } from "next/headers"
import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { AuthError, ForbiddenError } from "./error"
import { parseDurationToSeconds } from "./time"

export type AuthClaims = {
  sub: string
  role: "SUPERADMIN" | "ADMIN" | "PETUGAS" | "NASABAH"
  locationId: string | null
  iat: number
  exp: number
  jti: string
}

function getSecretKey() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters")
  }
  return new TextEncoder().encode(secret)
}

function getExpiresInSeconds() {
  const expIn = process.env.JWT_EXPIRES_IN || "7d"
  return parseDurationToSeconds(expIn)
}

export async function signAuthJWT(claims: Omit<AuthClaims, "iat" | "exp" | "jti">) {
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + getExpiresInSeconds()
  const jti = crypto.randomUUID()
  const payload: AuthClaims = { ...claims, iat, exp, jti }
  const token = await new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .setJti(jti)
    .setSubject(claims.sub)
    .sign(getSecretKey())
  return { token, payload }
}

export async function verifyAuthJWT(token: string) {
  const { payload } = await jwtVerify<AuthClaims>(token, getSecretKey())
  return payload
}

export async function setAuthCookie(token: string) {
  const maxAge = getExpiresInSeconds()
  ;(await cookies()).set("token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge,
  })
}

export async function clearAuthCookie() {
  (await cookies()).set("token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  })
}

export async function getAuthContext() {
  const token = (await cookies()).get("token")?.value
  if (!token) throw new AuthError("Missing token")
  const claims = await verifyAuthJWT(token)
  return claims
}

export async function requireAuth() {
  return getAuthContext()
}

export function requireRole<T extends AuthClaims["role"]>(claims: AuthClaims, ...allowed: T[]) {
  if (!allowed.includes(claims.role as T)) {
    throw new ForbiddenError("Insufficient role")
  }
  return true
}

export function enforceLocationScope(claims: AuthClaims, resourceLocationId: string | null | undefined) {
  if (claims.role === "SUPERADMIN") return true
  if (!claims.locationId || !resourceLocationId) throw new ForbiddenError("Location scope required")
  if (claims.locationId !== resourceLocationId) throw new ForbiddenError("Cross-location access denied")
  return true
}
