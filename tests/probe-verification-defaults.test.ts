import { describe, expect, it } from "vitest";

import { deriveVerificationDefaults } from "../packages/storage/src/probe-verification-defaults.js";

describe("deriveVerificationDefaults", () => {
  it("maps completed probe result to pass", () => {
    const defaults = deriveVerificationDefaults({
      status: "completed",
      activeApp: {
        appName: "Chrome",
        appId: "chrome"
      },
      output: "abc",
      insertResult: {
        success: true,
        method: "clipboard_paste",
        manualPasteRequired: false
      }
    });

    expect(defaults).toEqual({
      result: "pass",
      insertMethod: "clipboard_paste"
    });
  });

  it("maps manual_paste_required to manual_paste", () => {
    const defaults = deriveVerificationDefaults({
      status: "manual_paste_required",
      activeApp: {
        appName: "Slack",
        appId: "slack"
      },
      output: "abc",
      insertResult: {
        success: true,
        method: "copied_only",
        manualPasteRequired: true
      }
    });

    expect(defaults).toEqual({
      result: "manual_paste",
      insertMethod: "copied_only"
    });
  });

  it("maps failed probe result to fail", () => {
    const defaults = deriveVerificationDefaults({
      status: "failed",
      activeApp: {
        appName: "Feishu",
        appId: "feishu"
      },
      output: "abc",
      insertResult: {
        success: false,
        method: "copied_only",
        manualPasteRequired: true,
        errorCode: "windows_clipboard_set_failed"
      }
    });

    expect(defaults).toEqual({
      result: "fail",
      insertMethod: "copied_only"
    });
  });
});
