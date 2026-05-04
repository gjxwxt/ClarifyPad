import { describe, expect, it } from "vitest";

import { parseWindowsHotkey } from "../packages/platform-windows/src/hotkey.js";

describe("parseWindowsHotkey", () => {
  it("parses modifier + letter shortcuts", () => {
    expect(parseWindowsHotkey("Ctrl+Shift+K")).toEqual({
      modifiers: 0x0002 | 0x0004,
      virtualKey: 0x4b
    });
  });

  it("parses function key shortcuts", () => {
    expect(parseWindowsHotkey("Alt+F12")).toEqual({
      modifiers: 0x0001,
      virtualKey: 0x7b
    });
  });

  it("rejects invalid shortcuts", () => {
    expect(parseWindowsHotkey("Ctrl+Shift")).toBeNull();
    expect(parseWindowsHotkey("Ctrl+K+J")).toBeNull();
    expect(parseWindowsHotkey("Ctrl+InvalidKey")).toBeNull();
  });
});
