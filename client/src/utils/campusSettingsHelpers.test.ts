import { describe, expect, it } from "vitest";
import { readableTextColor } from "./campusSettingsHelpers";

describe("readableTextColor", () => {
  it.each([
    ["#ffffff", "#000000"],
    ["#000000", "#ffffff"],
    ["#ccecfd", "#000000"],
    ["#0e5e95", "#ffffff"],
    ["#ffff00", "#000000"],
    ["#757575", "#ffffff"],
    ["#767676", "#000000"],
  ])("background %s gets %s text", (bg, expected) => {
    expect(readableTextColor(bg)).toBe(expected);
  });
});
