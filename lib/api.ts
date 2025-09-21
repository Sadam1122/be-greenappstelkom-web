// File: beai/lib/api.ts

/**
 * Fungsi fetch yang disederhanakan untuk API internal.
 * Secara otomatis menangani error dan mengembalikan properti `data`.
 */
export async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T }> {
  // Langsung gunakan path relatif, browser akan menangani domain secara otomatis
  const response = await fetch(url, options); 
  
  const json = await response.json();

  if (!response.ok) {
    console.error(`[apiFetch] Gagal request ke ${url}, Status: ${response.status}`);
    console.error(`[apiFetch] Response Body:`, json);
    throw new Error(json.message || "Terjadi kesalahan pada server.");
  }

  return json;
}

/**
 * Membangun URL dengan query parameters.
 * TIDAK PERLU LAGI karena apiFetch sudah menangani path relatif.
 * Cukup bangun string URL secara manual di dalam komponen.
 */
export function buildUrl(pathname: string, params?: Record<string, any>): string {
    const url = new URL(pathname, "http://localhost"); // Base URL tidak penting, hanya untuk konstruksi
    if (params) {
        for (const key in params) {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, String(params[key]));
            }
        }
    }
    return `${url.pathname}${url.search}`; // Mengembalikan path + query
}