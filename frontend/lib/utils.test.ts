import { cn } from "./utils";

describe("cn", () => {
  it("fusionne correctement les classes", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false && "b", "c")).toBe("a c");
    expect(cn("a", ["b", "c"])).toBe("a b c");
  });
});
