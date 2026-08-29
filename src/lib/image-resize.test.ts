import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resizeImage } from "./image-resize";

type FakeCanvas = {
  width: number;
  height: number;
  getContext: () => { drawImage: ReturnType<typeof vi.fn> };
  toBlob: (cb: (b: Blob) => void, type: string, quality?: number) => void;
};

let lastCanvas: FakeCanvas;

function stubImage(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close: vi.fn() })),
  );
}

beforeEach(() => {
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
    if (tag !== "canvas") throw new Error(`unexpected createElement(${tag})`);
    lastCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob: (cb, type) => cb(new Blob(["x"], { type })),
    };
    return lastCanvas as unknown as HTMLElement;
  }) as typeof document.createElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const imageFile = (name = "photo.jpg", type = "image/jpeg") =>
  new File(["binary"], name, { type });

describe("resizeImage", () => {
  it("scales a wide image so its longest edge is maxEdge and outputs webp", async () => {
    stubImage(3200, 1600);
    const out = await resizeImage(imageFile(), 1600);

    expect(lastCanvas.width).toBe(1600);
    expect(lastCanvas.height).toBe(800);
    expect(out.type).toBe("image/webp");
    expect(out.name).toBe("photo.webp");
  });

  it("returns a within-bounds file unchanged", async () => {
    stubImage(800, 600);
    const file = imageFile();
    const out = await resizeImage(file, 1600);
    expect(out).toBe(file);
  });

  it("rejects a non-image file", async () => {
    await expect(
      resizeImage(new File(["x"], "notes.txt", { type: "text/plain" })),
    ).rejects.toThrow("Not an image");
  });
});
