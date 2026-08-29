import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const mapCtor = vi.fn();
const markerCtor = vi.fn();
const mapOn = vi.fn();
const markerOn = vi.fn();
const easeTo = vi.fn();
const setLngLat = vi.fn().mockReturnThis();
const addTo = vi.fn().mockReturnThis();
const getLngLat = vi.fn().mockReturnValue({ lat: 1, lng: 2 });
const contains = vi.fn().mockReturnValue(true);

vi.mock("maplibre-gl", () => ({
  Map: class {
    constructor(opts: unknown) {
      mapCtor(opts);
    }
    remove = vi.fn();
    easeTo = easeTo;
    on = mapOn;
    once = vi.fn();
    resize = vi.fn();
    getCanvas = () => ({ style: {} });
    getBounds = () => ({ contains });
  },
  Marker: class {
    constructor(opts: unknown) {
      markerCtor(opts);
    }
    setLngLat = setLngLat;
    addTo = addTo;
    on = markerOn;
    getLngLat = getLngLat;
  },
  setWorkerUrl: vi.fn(),
}));

import { PinPicker } from "./PinPicker";

beforeEach(() => {
  [mapCtor, markerCtor, mapOn, markerOn, easeTo, setLngLat, addTo].forEach((m) =>
    m.mockClear(),
  );
  contains.mockReturnValue(true);
});

describe("PinPicker", () => {
  it("wires dragend on the marker", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PinPicker value={{ lat: 32.78, lng: -96.8 }} onChange={onChange} />,
    );
    expect(
      container.querySelector("[data-testid='pin-picker']"),
    ).not.toBeNull();
    expect(markerCtor).toHaveBeenCalledWith({ draggable: true });

    const dragend = markerOn.mock.calls.find((c) => c[0] === "dragend")?.[1] as
      | (() => void)
      | undefined;
    dragend!();
    expect(onChange).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it("drops the pin where the map is tapped", () => {
    const onChange = vi.fn();
    render(<PinPicker value={null} onChange={onChange} />);

    const click = mapOn.mock.calls.find((c) => c[0] === "click")?.[1] as
      | ((e: { lngLat: { lat: number; lng: number } }) => void)
      | undefined;
    expect(click).toBeTypeOf("function");
    click!({ lngLat: { lat: 30, lng: -90 } });
    expect(onChange).toHaveBeenCalledWith({ lat: 30, lng: -90 });
  });

  it("recentres only when the new point is off-screen", () => {
    contains.mockReturnValue(true);
    const { rerender } = render(
      <PinPicker value={{ lat: 1, lng: 1 }} onChange={vi.fn()} />,
    );
    easeTo.mockClear();
    rerender(<PinPicker value={{ lat: 2, lng: 2 }} onChange={vi.fn()} />);
    expect(easeTo).not.toHaveBeenCalled();

    contains.mockReturnValue(false);
    rerender(<PinPicker value={{ lat: 50, lng: 50 }} onChange={vi.fn()} />);
    expect(easeTo).toHaveBeenCalled();
  });

  it("falls back to the configured centre when value is null", () => {
    render(<PinPicker value={null} onChange={vi.fn()} />);
    const opts = mapCtor.mock.calls[0][0] as { center: [number, number] };
    expect(opts.center).toEqual([-96.797, 32.7767]);
  });

  it("does not make the marker draggable or add a click handler in read-only mode", () => {
    render(<PinPicker value={{ lat: 1, lng: 1 }} onChange={vi.fn()} readOnly />);
    expect(markerCtor).toHaveBeenCalledWith({ draggable: false });
    expect(mapOn.mock.calls.some((c) => c[0] === "click")).toBe(false);
  });
});
