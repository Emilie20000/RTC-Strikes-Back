describe("socket", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("computeSocketUrl gère le cas 127.0.0.1", async () => {
    jest.doMock("socket.io-client", () => ({ io: jest.fn() }));
    const { computeSocketUrl } = await import("./socket");
    expect(computeSocketUrl("127.0.0.1", undefined)).toBe("http://127.0.0.1:8080");
  });

  it("socket utilise NEXT_PUBLIC_API_BASE_URL par défaut", async () => {
    const io = jest.fn();
    jest.doMock("socket.io-client", () => ({ io }));
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://example:8080";

    await import("./socket");
    expect(io.mock.calls[0][0]).toBe("http://example:8080");
  });
});
