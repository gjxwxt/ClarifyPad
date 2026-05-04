import { describe, expect, it } from "vitest";

import type {
  ActiveApp,
  FocusContext,
  InsertRequest,
  InsertResult,
  PermissionState,
  PlatformBridge,
  PlatformCapabilities,
  Rect
} from "../packages/shared/src/index.js";
import {
  TechnicalProbeService,
  createProbeOutput,
  type ProbeTelemetry,
  type ProbeTelemetryEvent,
  type ProbeTelemetryPayload
} from "../packages/shared/src/index.js";

class FakeBridge implements PlatformBridge {
  public readonly insertRequests: InsertRequest[] = [];
  public readonly shownAnchors: Array<Rect | undefined> = [];

  constructor(
    private readonly app: ActiveApp,
    private readonly focusContext: FocusContext,
    private readonly insertResult: InsertResult,
    private readonly blacklisted = false
  ) {}

  async registerGlobalHotkey(): Promise<boolean> {
    return true;
  }

  async getActiveApp(): Promise<ActiveApp> {
    return this.app;
  }

  async activateApp(): Promise<boolean> {
    return true;
  }

  async getFocusContext(): Promise<FocusContext> {
    return this.focusContext;
  }

  async showFloatingPanel(anchor?: Rect): Promise<void> {
    this.shownAnchors.push(anchor);
  }

  async insertText(request: InsertRequest): Promise<InsertResult> {
    this.insertRequests.push(request);
    return this.insertResult;
  }

  async copyText(): Promise<boolean> {
    return true;
  }

  async isAppBlacklisted(): Promise<boolean> {
    return this.blacklisted;
  }

  async getPermissionStatus(): Promise<PermissionState> {
    return "granted";
  }

  async getPlatformCapabilities(): Promise<PlatformCapabilities> {
    return {
      canReadActiveApp: true,
      canDetectFocus: true,
      canLocateCaret: true,
      canDirectInsert: true,
      canClipboardPasteFallback: true
    };
  }
}

class FakeTelemetry implements ProbeTelemetry {
  public readonly events: Array<{
    event: ProbeTelemetryEvent;
    payload: ProbeTelemetryPayload;
  }> = [];

  async record(event: ProbeTelemetryEvent, payload: ProbeTelemetryPayload): Promise<void> {
    this.events.push({ event, payload });
  }
}

describe("createProbeOutput", () => {
  it("adds the probe prefix to trimmed text", () => {
    expect(createProbeOutput("  这个需求让研发尽快做  ")).toBe(
      "[整理后] 这个需求让研发尽快做"
    );
  });

  it("rejects empty input", () => {
    expect(() => createProbeOutput("   ")).toThrowError("Probe input cannot be empty.");
  });
});

describe("TechnicalProbeService", () => {
  it("blocks probe startup for blacklisted apps", async () => {
    const bridge = new FakeBridge(
      { appName: "1Password", appId: "1password" },
      { hasFocusedInput: true },
      {
        success: true,
        method: "direct",
        manualPasteRequired: false
      },
      true
    );
    const telemetry = new FakeTelemetry();
    const service = new TechnicalProbeService(bridge, telemetry);

    const result = await service.start();

    expect(result).toEqual({
      status: "blocked",
      reason: "app_blacklisted",
      activeApp: { appName: "1Password", appId: "1password" }
    });
    expect(bridge.shownAnchors).toEqual([]);
    expect(telemetry.events.map((item) => item.event)).toEqual([
      "probe_started",
      "probe_blocked"
    ]);
  });

  it("blocks probe startup for password fields", async () => {
    const bridge = new FakeBridge(
      { appName: "Chrome", appId: "chrome" },
      { hasFocusedInput: true, isPasswordField: true },
      {
        success: true,
        method: "direct",
        manualPasteRequired: false
      }
    );
    const telemetry = new FakeTelemetry();
    const service = new TechnicalProbeService(bridge, telemetry);

    const result = await service.start();

    expect(result).toEqual({
      status: "blocked",
      reason: "password_field",
      activeApp: { appName: "Chrome", appId: "chrome" }
    });
    expect(bridge.shownAnchors).toEqual([]);
    expect(telemetry.events).toEqual([
      {
        event: "probe_started",
        payload: {
          appName: "Chrome",
          appId: "chrome"
        }
      },
      {
        event: "probe_blocked",
        payload: {
          appName: "Chrome",
          appId: "chrome",
          fallbackReason: "password_field"
        }
      }
    ]);
  });

  it("anchors the floating panel to the caret rect when available", async () => {
    const caretRect = { x: 10, y: 20, width: 30, height: 40 };
    const bridge = new FakeBridge(
      { appName: "Feishu", appId: "feishu" },
      { hasFocusedInput: true, caretRect, focusedElementRect: { x: 1, y: 2, width: 3, height: 4 } },
      {
        success: true,
        method: "direct",
        manualPasteRequired: false
      }
    );
    const service = new TechnicalProbeService(bridge, new FakeTelemetry());

    const result = await service.start();

    expect(result).toMatchObject({
      status: "ready",
      activeApp: { appName: "Feishu", appId: "feishu" },
      anchorRect: caretRect
    });
    expect(bridge.shownAnchors).toEqual([caretRect]);
  });

  it("records a successful insert with clipboard fallback semantics", async () => {
    const bridge = new FakeBridge(
      { appName: "Chrome", appId: "chrome" },
      { hasFocusedInput: true, fallbackReason: "caret_unavailable" },
      {
        success: true,
        method: "clipboard_paste",
        manualPasteRequired: false
      }
    );
    const telemetry = new FakeTelemetry();
    const service = new TechnicalProbeService(bridge, telemetry);

    const result = await service.confirm(
      { appName: "Chrome", appId: "chrome" },
      "这个需求让研发尽快做"
    );

    expect(bridge.insertRequests).toEqual([
      {
        text: "[整理后] 这个需求让研发尽快做",
        mode: "insert_at_caret"
      }
    ]);
    expect(result).toMatchObject({
      status: "completed",
      output: "[整理后] 这个需求让研发尽快做",
      insertResult: {
        success: true,
        method: "clipboard_paste",
        manualPasteRequired: false
      }
    });
    expect(telemetry.events).toEqual([
      {
        event: "probe_completed",
        payload: {
          appName: "Chrome",
          appId: "chrome",
          method: "clipboard_paste",
          manualPasteRequired: false,
          errorCode: undefined
        }
      }
    ]);
  });

  it("returns manual paste required when copied_only succeeds", async () => {
    const bridge = new FakeBridge(
      { appName: "Slack", appId: "slack" },
      { hasFocusedInput: false, fallbackReason: "focus_unknown" },
      {
        success: true,
        method: "copied_only",
        manualPasteRequired: true
      }
    );
    const telemetry = new FakeTelemetry();
    const service = new TechnicalProbeService(bridge, telemetry);

    const result = await service.confirm(
      { appName: "Slack", appId: "slack" },
      "麻烦帮我同步一下这个需求"
    );

    expect(result.status).toBe("manual_paste_required");
    expect(telemetry.events[0]).toEqual({
      event: "probe_completed",
      payload: {
        appName: "Slack",
        appId: "slack",
        method: "copied_only",
        manualPasteRequired: true,
        errorCode: undefined
      }
    });
  });
});
