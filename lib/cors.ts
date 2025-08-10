/**
 * lib/cors.ts
 * * Modul ini menyediakan serangkaian fungsi utilitas untuk menangani
 * Cross-Origin Resource Sharing (CORS) di Next.js App Router.
 * Ini memungkinkan Anda untuk mengelola domain mana yang dapat mengakses API Anda
 * dengan cara yang aman dan dapat dikonfigurasi.
 */

// --- KONFIGURASI WHITELIST ---
// Daftar domain yang diizinkan untuk membuat permintaan ke API Anda.
// Untuk keamanan, hanya origin yang ada di daftar ini yang akan diizinkan.
const ALLOWED_ORIGINS: string[] = [
  'http://localhost:3000',          // Untuk pengembangan lokal
  'https://greenappstelkom.id',     // Domain produksi yang Anda minta
  // Anda bisa menambahkan domain lain dari environment variables
  ...(process.env.FRONTEND_URLS?.split(',') || [])
];

/**
 * Membangun header CORS untuk ditambahkan ke setiap respons.
 * Fungsi ini secara dinamis mengatur header 'Access-Control-Allow-Origin'
 * berdasarkan origin permintaan yang masuk jika ada di dalam whitelist.
 * * @param request - Objek Request yang masuk.
 * @returns Objek HeadersInit dengan header CORS yang sesuai.
 */
export function buildCorsHeaders(request: Request): HeadersInit {
  const requestOrigin = request.headers.get("origin") ?? "";

  // Tentukan origin yang diizinkan. Jika origin request ada di whitelist, gunakan itu.
  // Jika tidak, header 'Access-Control-Allow-Origin' tidak akan diatur atau akan kosong,
  // yang secara efektif akan memblokir permintaan dari origin tersebut.
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Request-ID, X-CSRF-Token, X-Requested-With, Accept, Set-Cookie",
    // Header 'Vary: Origin' memberitahu cache bahwa respons dapat bervariasi berdasarkan origin.
    "Vary": "Origin",
  };
}

/**
 * Menangani permintaan preflight CORS (OPTIONS).
 * Browser mengirim permintaan OPTIONS sebelum permintaan sebenarnya (misalnya, POST, PUT)
 * untuk memeriksa apakah server mengizinkan permintaan tersebut.
 * * @param request - Objek Request yang masuk.
 * @returns Objek Response jika ini adalah preflight request, jika tidak, null.
 */
export function handleCorsPreflight(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    // Untuk preflight, kita hanya perlu mengembalikan header CORS dengan status 204 (No Content).
    const headers = buildCorsHeaders(request);
    return new Response(null, { status: 204, headers });
  }
  return null;
}

/**
 * Sebuah fungsi wrapper untuk menerapkan header CORS ke objek Response yang sudah ada.
 * Gunakan ini untuk membungkus respons akhir dari Route Handler Anda.
 * * @param resp - Objek Response asli dari logika bisnis Anda.
 * @param request - Objek Request yang masuk.
 * @returns Objek Response baru dengan header CORS yang telah ditambahkan.
 */
export function withCors(resp: Response, request: Request): Response {
  // Buat salinan header dari respons asli.
  const responseHeaders = new Headers(resp.headers);
  const corsHeaders = buildCorsHeaders(request);

  // Tambahkan setiap header CORS ke header respons.
  Object.entries(corsHeaders).forEach(([key, value]) => {
    responseHeaders.set(key, value);
  });

  // Kembalikan Response baru dengan body dan status yang sama, tetapi dengan header yang diperbarui.
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers: responseHeaders,
  });
}
