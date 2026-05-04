import { describe, expect, it } from "vitest";

import { MacOSAppleScriptBridge } from "../packages/platform-macos/src/index.js";

describe("MacOSAppleScriptBridge", () => {
  it("throws clear error on non-darwin hosts", async () => {
    if (process.platform === "darwin") {
      return;
    }

    const bridge = new MacOSAppleScriptBridge();
    await expect(bridge.getActiveApp()).rejects.toThrowError(
      "platform_macos_unavailable_on_non_darwin"
    );
  });
});
