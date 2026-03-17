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
    const error = new Error(text || `HTTP ${res.status}`) as any;
    try {
      const json = JSON.parse(text);
      if (json.error) {
        error.error = json.error;
        
        if (json.error === "User not found" && typeof window !== "undefined") {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          const isJsdom = typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
          if (!isJsdom) {
            try {
              window.location.href = "/login";
            } catch {
            }
          }
        }
      }
      error.data = json;
    } catch (e) {
    }
    throw error;
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}
