import { beforeEach, describe, expect, it, vi } from "vitest";
import registerChunkErrorRecovery, {
  beginChunkImportRetry,
  endChunkImportRetry,
  isChunkLoadError,
  reloadForNewBuild,
} from "./chunkErrorRecovery";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://x/assets/a.js",
    "Importing a module script failed.",
    "error loading dynamically imported module",
  ])("matches %s", (message) => {
    expect(isChunkLoadError(new Error(message))).toBe(true);
  });

  it("ignores application errors", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(
      false
    );
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe("reloadForNewBuild", () => {
  const reload = vi.fn();

  beforeEach(() => {
    reload.mockClear();
    window.sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it("reloads once and then refuses within the cooldown", () => {
    expect(reloadForNewBuild()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    expect(reloadForNewBuild()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("reloads on a vite:preloadError event", () => {
    registerChunkErrorRecovery();
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("leaves the event un-prevented so Vite still rethrows", () => {
    registerChunkErrorRecovery();
    const event = new Event("vite:preloadError", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("stands down while a lazyWithRetry retry is in flight", () => {
    registerChunkErrorRecovery();

    beginChunkImportRetry();
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    expect(reload).not.toHaveBeenCalled();

    endChunkImportRetry();
    window.dispatchEvent(new Event("vite:preloadError", { cancelable: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
