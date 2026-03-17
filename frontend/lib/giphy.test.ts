describe("giphy", () => {
  beforeEach(() => {
    (globalThis as any).fetch = jest.fn();
    process.env.NEXT_PUBLIC_GIPHY_API_KEY = "key";
    jest.resetModules();
  });

  it("construit correctement l'URL trending", async () => {
    const { fetchTrendingGifs } = await import("./giphy");
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], pagination: { total_count: 0, count: 0, offset: 0 } }),
    });
    await fetchTrendingGifs(10, 5);
    const url = (globalThis.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("api.giphy.com");
    expect(url).toContain("trending");
    expect(url).toContain("api_key=key");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("gère erreur HTTP", async () => {
    const { searchGifs } = await import("./giphy");
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Server Error",
      text: async () => "oops",
    });
    await expect(searchGifs("cat")).rejects.toThrow(/GIPHY API error/);
  });

  it("retourne des résultats sur search", async () => {
    const { searchGifs } = await import("./giphy");
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "1",
            title: "t",
            images: {
              fixed_height: { url: "u", width: "1", height: "1" },
              fixed_height_small: { url: "u", width: "1", height: "1" },
              original: { url: "u", width: "1", height: "1" },
            },
          },
        ],
        pagination: { total_count: 1, count: 1, offset: 0 },
      }),
    });
    const res = await searchGifs("dog", 1, 0);
    expect(res.pagination.total_count).toBe(1);
  });
});
