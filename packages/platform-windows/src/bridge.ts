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

type WindowsBridgeOptions = {
  blacklistedAppIds?: string[];
};

export class WindowsPowerShellBridge implements PlatformBridge {
  private readonly blacklisted: Set<string>;

  constructor(private readonly options: WindowsBridgeOptions = {}) {
    this.blacklisted = new Set(
      (this.options.blacklistedAppIds ?? []).map((value) => value.toLowerCase())
    );
  }

  async registerGlobalHotkey(_shortcut: string): Promise<boolean> {
    return false;
  }

  async getActiveApp(): Promise<ActiveApp> {
    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class ForegroundWindowReader {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();

  [DllImport("user32.dll", SetLastError=true)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

  [DllImport("user32.dll")]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@

$hwnd = [ForegroundWindowReader]::GetForegroundWindow()
$builder = New-Object System.Text.StringBuilder 512
[void][ForegroundWindowReader]::GetWindowText($hwnd, $builder, $builder.Capacity)
$processId = 0
[void][ForegroundWindowReader]::GetWindowThreadProcessId($hwnd, [ref]$processId)
$process = Get-Process -Id $processId
@{
  appName = $process.ProcessName
  appId = $process.ProcessName
  windowTitle = $builder.ToString()
} | ConvertTo-Json -Compress
`;

    return this.runJson<ActiveApp>(script);
  }

  async getFocusContext(): Promise<FocusContext> {
    return {
      hasFocusedInput: false,
      fallbackReason: "windows_focus_probe_not_implemented_yet"
    };
  }

  async showFloatingPanel(_anchor?: Rect): Promise<void> {
    return;
  }

  async insertText(request: InsertRequest): Promise<InsertResult> {
    const escapedText = toPowerShellSingleQuoted(request.text);
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$originalClipboard = ""
try {
  $originalClipboard = Get-Clipboard -Raw
} catch {
  $originalClipboard = ""
}

try {
  Set-Clipboard -Value '${escapedText}'
  Start-Sleep -Milliseconds 120
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 120
  if ($null -ne $originalClipboard) {
    Set-Clipboard -Value $originalClipboard
  }
  @{
    success = $true
    method = "clipboard_paste"
    manualPasteRequired = $false
  } | ConvertTo-Json -Compress
} catch {
  @{
    success = $false
    method = "copied_only"
    manualPasteRequired = $true
    errorCode = "windows_clipboard_paste_failed"
  } | ConvertTo-Json -Compress
}
`;

    return this.runJson<InsertResult>(script);
  }

  async copyText(text: string): Promise<boolean> {
    const escapedText = toPowerShellSingleQuoted(text);
    const script = `Set-Clipboard -Value '${escapedText}'`;

    try {
      await this.runScript(script);
      return true;
    } catch {
      return false;
    }
  }

  async isAppBlacklisted(appId: string): Promise<boolean> {
    return this.blacklisted.has(appId.toLowerCase());
  }

  async getPermissionStatus(): Promise<PermissionState> {
    return "not_required";
  }

  async getPlatformCapabilities(): Promise<PlatformCapabilities> {
    return {
      canReadActiveApp: true,
      canDetectFocus: false,
      canLocateCaret: false,
      canDirectInsert: false,
      canClipboardPasteFallback: true
    };
  }

  private async runJson<T>(script: string): Promise<T> {
    const stdout = await this.runScript(script);
    return JSON.parse(stdout) as T;
  }

  private async runScript(script: string): Promise<string> {
    const utf8Script = `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();\n${script}`;
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", utf8Script],
      {
        windowsHide: true,
        maxBuffer: 1024 * 1024
      }
    );

    return stdout.trim();
  }
}

function toPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}
