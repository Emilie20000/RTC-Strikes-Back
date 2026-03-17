const originalFetch = globalThis.fetch;

describe("api", () => {
  const loadApi = async () => {
    const mod = await import("./http");
    return mod.api;
  };

  beforeEach(() => {
    (globalThis as any).fetch = jest.fn();
    jest.resetModules();
    Object.defineProperty(window, "localStorage", {
      value: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value;
        },
        removeItem(key: string) {
          delete this.store[key];
        },
        clear() {
          this.store = {};
        },
      },
      configurable: true,
    });
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080";
  });

  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
    (window as any).localStorage?.clear?.();
  });

  it("lève une erreur si BASE manquant", async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    const api = await loadApi();
    await expect(api("/test")).rejects.toThrow("NEXT_PUBLIC_API_BASE_URL manquant");
  });

  it("inclut le header Authorization si token présent", async () => {
    const api = await loadApi();
    window.localStorage.setItem("token", "abc");
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const res = await api<{ ok: boolean }>("/path", { method: "GET" });
    expect(res.ok).toBe(true);
    const call = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe("http://localhost:8080/path");
    expect(call[1].headers.Authorization).toBe("Bearer abc");
  });

  it("retourne objet vide sur 204", async () => {
    const api = await loadApi();
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => ({}),
    });
    const res = await api("/no-content");
    expect(res).toEqual({});
  });

  it("gère erreur JSON et nettoyage User not found", async () => {
    const api = await loadApi();
    window.localStorage.setItem("token", "t");
    window.localStorage.setItem("user", "u");
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "User not found" }),
    });
    await expect(api("/secure")).rejects.toBeInstanceOf(Error);
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("user")).toBeNull();
  });
});
