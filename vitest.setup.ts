import "@testing-library/jest-dom/vitest";

// jsdom has no ResizeObserver; components that observe layout need a stub.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
