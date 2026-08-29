import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { PlaceFeatureCollection } from "@/lib/geojson";

const addSource = vi.fn();
const addLayer = vi.fn();
const on = vi.fn();
const addControl = vi.fn();
const remove = vi.fn();
const mapCtor = vi.fn();
const getSource = vi.fn();

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    on = on;
    addControl = addControl;
    addSource = addSource;
    addLayer = addLayer;
    remove = remove;
    getSource = getSource;
    getCanvas = () => ({ style: {} });
    getZoom = () => 11;
    easeTo = vi.fn();
  },
  NavigationControl: class {},
  setWorkerUrl: vi.fn(),
}));

import { MapView } from "./MapView";

const fc: PlaceFeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-96.8, 32.8] },
      properties: { id: "1", name: "X", slug: "x", category: "shop" },
    },
  ],
};

beforeEach(() => {
  [addSource, addLayer, on, addControl, remove, mapCtor, getSource].forEach((m) =>
    m.mockReset(),
  );
});

describe("MapView", () => {
  it("renders a map container", () => {
    const { container } = render(<MapView data={fc} onSelect={() => {}} />);
    expect(container.querySelector("[data-testid='base-map']")).not.toBeNull();
  });

  it("centres on Dallas", () => {
    render(<MapView data={fc} onSelect={() => {}} />);
    const opts = mapCtor.mock.calls[0][0] as { center: [number, number] };
    expect(opts.center).toEqual([-96.797, 32.7767]);
  });

  it("adds a clustered source on load", () => {
    render(<MapView data={fc} onSelect={() => {}} />);
    const load = on.mock.calls.find((c) => c[0] === "load")?.[1] as () => void;
    expect(load).toBeTypeOf("function");
    load();
    expect(addSource).toHaveBeenCalledWith(
      "places",
      expect.objectContaining({ type: "geojson", cluster: true }),
    );
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "place" }),
    );
  });

  it("removes the map on unmount", () => {
    const { unmount } = render(<MapView data={fc} onSelect={() => {}} />);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
