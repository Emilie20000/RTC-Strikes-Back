const BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!BASE) throw new Error("NEXT_PUBLIC_API_BASE_URL manquant");

  // console.log("API Call:", `${BASE}${path}`); // Debug

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP ${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}
