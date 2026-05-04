import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  ActiveApp,
  FocusContext,
  InsertRequest,
  InsertResult,
  PermissionState,
  PlatformBridge,
  PlatformCapabilities,
  Rect
} from "../../shared/src/index.js";

const execFileAsync = promisify(execFile);

type MacOSBridgeOptions = {
  blacklistedAppIds?: string[];
};

export class MacOSAppleScriptBridge implements PlatformBridge {
  private readonly blacklisted: Set<string>;

  constructor(private readonly options: MacOSBridgeOptions = {}) {
    this.blacklisted = new Set(
      (this.options.blacklistedAppIds ?? []).map((value) => value.toLowerCase())
    );
  }

  async registerGlobalHotkey(_shortcut: string): Promise<boolean> {
    return false;
  }

  async getActiveApp(): Promise<ActiveApp> {
    this.assertDarwin();
    const stdout = await this.runAppleScript(`
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set appBundleId to bundle identifier of frontApp
  return appName & "||" & appBundleId
end tell
`);

    const [appName, appId] = stdout.trim().split("||");
    return {
      appName: appName || "Unknown",
      appId: appId || appName || "unknown"
    };
  }

  async activateApp(app: ActiveApp): Promise<boolean> {
    this.assertDarwin();
    const target = app.appId || app.appName;
    if (!target) {
      return false;
    }

    await this.runAppleScript(`tell application id "${escapeForAppleScript(target)}" to activate`);
    return true;
  }

  async getFocusContext(): Promise<FocusContext> {
    this.assertDarwin();
    return {
      hasFocusedInput: false,
      fallbackReason: "mac_focus_probe_not_implemented"
    };
  }

  async showFloatingPanel(_anchor?: Rect): Promise<void> {
    return;
  }

  async insertText(_request: InsertRequest): Promise<InsertResult> {
    this.assertDarwin();
    return {
      success: false,
      method: "copied_only",
      manualPasteRequired: true,
      errorCode: "mac_insert_not_implemented"
    };
  }

  async copyText(text: string): Promise<boolean> {
    this.assertDarwin();
    await this.runAppleScript(`set the clipboard to "${escapeForAppleScript(text)}"`);
    return true;
  }

  async isAppBlacklisted(appId: string): Promise<boolean> {
    return this.blacklisted.has(appId.toLowerCase());
  }

  async getPermissionStatus(): Promise<PermissionState> {
    if (process.platform !== "darwin") {
      return "unknown";
    }

    return "unknown";
  }

  async getPlatformCapabilities(): Promise<PlatformCapabilities> {
    return {
      canReadActiveApp: process.platform === "darwin",
      canDetectFocus: false,
      canLocateCaret: false,
      canDirectInsert: false,
      canClipboardPasteFallback: process.platform === "darwin"
    };
  }

  private assertDarwin(): void {
    if (process.platform !== "darwin") {
      throw new Error("platform_macos_unavailable_on_non_darwin");
    }
  }

  private async runAppleScript(script: string): Promise<string> {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      maxBuffer: 1024 * 1024
    });
    return stdout.trim();
  }
}

function escapeForAppleScript(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
