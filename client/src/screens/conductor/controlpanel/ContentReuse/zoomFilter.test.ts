import { describe, expect, it } from "vitest";
import { pageFriendlyZoomFilter } from "./zoomFilter";

describe("pageFriendlyZoomFilter", () => {
  it("leaves plain wheel scrolling to the page and zooms with Ctrl or ⌘", () => {
    expect(pageFriendlyZoomFilter({ type: "wheel" })).toBe(false);
    expect(pageFriendlyZoomFilter({ type: "wheel", ctrlKey: true })).toBe(true);
    expect(pageFriendlyZoomFilter({ type: "wheel", metaKey: true })).toBe(true);
  });

  it("leaves one-finger swipes to the page and handles two-finger gestures", () => {
    expect(pageFriendlyZoomFilter({ type: "touchstart", touches: { length: 1 } })).toBe(false);
    expect(pageFriendlyZoomFilter({ type: "touchmove", touches: { length: 2 } })).toBe(true);
  });

  it("pans with the main mouse button only", () => {
    expect(pageFriendlyZoomFilter({ type: "mousedown", button: 0 })).toBe(true);
    expect(pageFriendlyZoomFilter({ type: "mousedown", button: 2 })).toBe(false);
    expect(pageFriendlyZoomFilter({ type: "dblclick", button: 0 })).toBe(true);
  });
});
