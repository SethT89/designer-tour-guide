import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mapCtor = vi.fn();
const addControl = vi.fn();
const remove = vi.fn();

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    addControl = addControl;
    remove = remove;
    on = vi.fn();
  },
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
}));

beforeEach(() => {
  mapCtor.mockClear();
  addControl.mockClear();
  remove.mockClear();
});

import { BaseMap } from "./BaseMap";

describe("BaseMap", () => {
  it("renders a map container", () => {
    const { container } = render(<BaseMap />);
    expect(container.querySelector("[data-testid='base-map']")).not.toBeNull();
  });

  it("initialises MapLibre with the Dallas config", () => {
    render(<BaseMap />);
    expect(mapCtor).toHaveBeenCalledTimes(1);
    const opts = mapCtor.mock.calls[0][0] as {
      center: [number, number];
      zoom: number;
      style: string;
    };
    expect(opts.center).toEqual([-96.797, 32.7767]);
    expect(opts.zoom).toBe(11);
    expect(opts.style).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("tears down the map on unmount", () => {
    const { unmount } = render(<BaseMap />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
