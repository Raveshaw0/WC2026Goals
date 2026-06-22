import "server-only";

// Shared service-role REST client for the WC26 Supabase project. Server-only;
// the service role key bypasses RLS and never reaches the browser. Used by the
// analytics store and the auth (OTP / throttle) store.

function env(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function dbConfigured(): boolean {
  return env() !== null;
}

export async function sb(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<Response | null> {
  const e = env();
  if (!e) return null;
  const { prefer, headers, ...rest } = init;
  try {
    return await fetch(`${e.url}/rest/v1${path}`, {
      ...rest,
      headers: {
        apikey: e.key,
        Authorization: `Bearer ${e.key}`,
        "Content-Type": "application/json",
        ...(prefer ? { Prefer: prefer } : {}),
        ...(headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return null;
  }
}
