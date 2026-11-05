import '@testing-library/jest-dom';

// jsdom has no ResizeObserver, which Headless UI's floating panels (the Davis
// Combobox, Listbox and Menu) call when they open.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
