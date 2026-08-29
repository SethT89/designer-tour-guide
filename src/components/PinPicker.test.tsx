import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mapCtor = vi.fn();
const markerCtor = vi.fn();
const on = vi.fn();
const setLngLat = vi.fn().mockReturnThis();
const addTo = vi.fn().mockReturnThis();
const getLngLat = vi.fn().mockReturnValue({ lat: 1, lng: 2 });

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    remove = vi.fn();
    easeTo = vi.fn();
  },
  Marker: class {
    constructor(opts: unknown) {
      markerCtor(opts);
    }
    setLngLat = setLngLat;
    addTo = addTo;
    on = on;
    getLngLat = getLngLat;
  },
  setWorkerUrl: vi.fn(),
}));

import { PinPicker } from "./PinPicker";

beforeEach(() => {
  [mapCtor, markerCtor, on, setLngLat, addTo].forEach((m) => m.mockClear());
});

describe("PinPicker", () => {
  it("renders a container and a draggable marker wired to dragend", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PinPicker value={{ lat: 32.78, lng: -96.8 }} onChange={onChange} />,
    );
    expect(
      container.querySelector("[data-testid='pin-picker']"),
    ).not.toBeNull();
    expect(markerCtor).toHaveBeenCalledWith({ draggable: true });

    const dragend = on.mock.calls.find((c) => c[0] === "dragend")?.[1] as
      | (() => void)
      | undefined;
    expect(dragend).toBeTypeOf("function");
    dragend!();
    expect(onChange).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it("falls back to the configured centre when value is null", () => {
    render(<PinPicker value={null} onChange={vi.fn()} />);
    const opts = mapCtor.mock.calls[0][0] as { center: [number, number] };
    expect(opts.center).toEqual([-96.797, 32.7767]);
  });

  it("does not make the marker draggable in read-only mode", () => {
    render(
      <PinPicker value={{ lat: 1, lng: 1 }} onChange={vi.fn()} readOnly />,
    );
    expect(markerCtor).toHaveBeenCalledWith({ draggable: false });
  });
});
