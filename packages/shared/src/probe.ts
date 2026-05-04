import type {
  ActiveApp,
  FocusContext,
  InsertRequest,
  InsertResult,
  PlatformBridge,
  Rect
} from "./platform.js";

export type ProbeTelemetryEvent =
  | "probe_started"
  | "probe_blocked"
  | "probe_completed"
  | "probe_failed";

export type ProbeTelemetryPayload = {
  appName?: string;
  appId?: string;
  method?: InsertResult["method"];
  manualPasteRequired?: boolean;
  errorCode?: string;
  fallbackReason?: string;
};

export interface ProbeTelemetry {
  record(event: ProbeTelemetryEvent, payload: ProbeTelemetryPayload): Promise<void>;
}

export type ProbeStartResult =
  | {
      status: "blocked";
      reason: "app_blacklisted" | "password_field";
      activeApp: ActiveApp;
    }
  | {
      status: "ready";
      activeApp: ActiveApp;
      focusContext: FocusContext;
      anchorRect?: Rect;
    };

export type ProbeExecutionResult =
  | {
      status: "completed";
      activeApp: ActiveApp;
      output: string;
      insertResult: InsertResult;
    }
  | {
      status: "manual_paste_required";
      activeApp: ActiveApp;
      output: string;
      insertResult: InsertResult;
    }
  | {
      status: "failed";
      activeApp: ActiveApp;
      output: string;
      insertResult: InsertResult;
    };

export class TechnicalProbeService {
  constructor(
    private readonly bridge: PlatformBridge,
    private readonly telemetry: ProbeTelemetry
  ) {}

  async start(): Promise<ProbeStartResult> {
    const activeApp = await this.bridge.getActiveApp();
    await this.telemetry.record("probe_started", {
      appName: activeApp.appName,
      appId: activeApp.appId
    });

    const isBlacklisted = await this.bridge.isAppBlacklisted(activeApp.appId);
    if (isBlacklisted) {
      await this.telemetry.record("probe_blocked", {
        appName: activeApp.appName,
        appId: activeApp.appId
      });

      return {
        status: "blocked",
        reason: "app_blacklisted",
        activeApp
      };
    }

    const focusContext = await this.bridge.getFocusContext();
    if (focusContext.isPasswordField) {
      await this.telemetry.record("probe_blocked", {
        appName: activeApp.appName,
        appId: activeApp.appId,
        fallbackReason: "password_field"
      });

      return {
        status: "blocked",
        reason: "password_field",
        activeApp
      };
    }

    const anchorRect = focusContext.caretRect ?? focusContext.focusedElementRect;
    await this.bridge.showFloatingPanel(anchorRect);

    return {
      status: "ready",
      activeApp,
      focusContext,
      anchorRect
    };
  }

  async confirm(activeApp: ActiveApp, rawInput: string): Promise<ProbeExecutionResult> {
    const output = createProbeOutput(rawInput);
    const request: InsertRequest = {
      text: output,
      mode: "insert_at_caret"
    };
    const insertResult = await this.bridge.insertText(request);

    const payload = {
      appName: activeApp.appName,
      appId: activeApp.appId,
      method: insertResult.method,
      manualPasteRequired: insertResult.manualPasteRequired,
      errorCode: insertResult.errorCode
    };

    if (!insertResult.success) {
      await this.telemetry.record("probe_failed", payload);
      return {
        status: "failed",
        activeApp,
        output,
        insertResult
      };
    }

    if (insertResult.manualPasteRequired) {
      await this.telemetry.record("probe_completed", payload);
      return {
        status: "manual_paste_required",
        activeApp,
        output,
        insertResult
      };
    }

    await this.telemetry.record("probe_completed", payload);
    return {
      status: "completed",
      activeApp,
      output,
      insertResult
    };
  }
}

export function createProbeOutput(rawInput: string): string {
  const normalized = rawInput.trim();
  if (!normalized) {
    throw new Error("Probe input cannot be empty.");
  }

  return `[整理后] ${normalized}`;
}
