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
import { parseWindowsHotkey } from "./hotkey.js";

const execFileAsync = promisify(execFile);

type WindowsBridgeOptions = {
  blacklistedAppIds?: string[];
  preserveClipboardOnPaste?: boolean;
};

export class WindowsPowerShellBridge implements PlatformBridge {
  private readonly blacklisted: Set<string>;
  private readonly preserveClipboardOnPaste: boolean;

  constructor(private readonly options: WindowsBridgeOptions = {}) {
    this.blacklisted = new Set(
      (this.options.blacklistedAppIds ?? []).map((value) => value.toLowerCase())
    );
    this.preserveClipboardOnPaste = options.preserveClipboardOnPaste ?? true;
  }

  async registerGlobalHotkey(shortcut: string): Promise<boolean> {
    const parsed = parseWindowsHotkey(shortcut);
    if (!parsed) {
      return false;
    }

    const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class HotkeyApi {
  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
"@

$hotkeyId = 1193046
$registered = [HotkeyApi]::RegisterHotKey([IntPtr]::Zero, $hotkeyId, ${parsed.modifiers}, ${parsed.virtualKey})
if ($registered) {
  [void][HotkeyApi]::UnregisterHotKey([IntPtr]::Zero, $hotkeyId)
  "true"
} else {
  "false"
}
`;

    const stdout = await this.runScript(script);
    return stdout.trim().toLowerCase() === "true";
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
  processId = [int]$processId
  windowTitle = $builder.ToString()
} | ConvertTo-Json -Compress
`;

    return this.runJson<ActiveApp>(script);
  }

  async activateApp(app: ActiveApp): Promise<boolean> {
    if (!app.processId) {
      return false;
    }

    const script = `
$wshell = New-Object -ComObject WScript.Shell
if ($wshell.AppActivate(${app.processId})) {
  "true"
} else {
  "false"
}
`;

    const stdout = await this.runScript(script);
    return stdout.trim().toLowerCase() === "true";
  }

  async getFocusContext(): Promise<FocusContext> {
    const script = `
Add-Type -AssemblyName UIAutomationClient
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $focused) {
  @{
    hasFocusedInput = $false
    fallbackReason = "no_focused_element"
  } | ConvertTo-Json -Compress
  exit 0
}

$controlType = $focused.Current.ControlType.ProgrammaticName
$supportsValuePattern = $false
$supportsTextPattern = $false
$valuePattern = $null
$textPattern = $null
$caretRect = $null

if ($focused.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$valuePattern)) {
  $supportsValuePattern = $true
}

if ($focused.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$textPattern)) {
  $supportsTextPattern = $true
  try {
    $selectionRanges = $textPattern.GetSelection()
    if ($null -ne $selectionRanges -and $selectionRanges.Length -gt 0) {
      $rectangles = $selectionRanges[0].GetBoundingRectangles()
      if ($null -ne $rectangles -and $rectangles.Length -ge 4) {
        $caretRect = @{
          x = [Math]::Round($rectangles[0])
          y = [Math]::Round($rectangles[1])
          width = [Math]::Round($rectangles[2])
          height = [Math]::Round($rectangles[3])
        }
      }
    }
  } catch {
    $caretRect = $null
  }
}

$rect = $focused.Current.BoundingRectangle
$isLikelyTextInput =
  $controlType -eq "ControlType.Edit" -or
  $controlType -eq "ControlType.Document" -or
  $supportsValuePattern -or
  $supportsTextPattern

$elementRect = $null
if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
  $elementRect = @{
    x = [Math]::Round($rect.Left)
    y = [Math]::Round($rect.Top)
    width = [Math]::Round($rect.Width)
    height = [Math]::Round($rect.Height)
  }
}

@{
  hasFocusedInput = $isLikelyTextInput
  isPasswordField = $focused.Current.IsPassword
  caretRect = $caretRect
  focusedElementRect = $elementRect
  fallbackReason = $(
    if (-not $isLikelyTextInput) {
      "focused_element_not_text_input"
    } elseif ($null -eq $caretRect) {
      "caret_unavailable"
    } else {
      $null
    }
  )
} | ConvertTo-Json -Compress -Depth 3
`;

    return this.runJson<FocusContext>(script);
  }

  async showFloatingPanel(_anchor?: Rect): Promise<void> {
    return;
  }

  async insertText(request: InsertRequest): Promise<InsertResult> {
    const escapedText = toPowerShellSingleQuoted(request.text);
    const preserveClipboard = this.preserveClipboardOnPaste;
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$clipboardCaptured = $false
$clipboardSet = $false
$originalClipboard = ""
${preserveClipboard ? `
try {
  $originalClipboard = Get-Clipboard -Raw
  $clipboardCaptured = $true
} catch {
  $originalClipboard = ""
}
` : ""}

try {
  Set-Clipboard -Value '${escapedText}'
  $clipboardSet = $true
  Start-Sleep -Milliseconds 40
  [System.Windows.Forms.SendKeys]::SendWait("^v")
  Start-Sleep -Milliseconds 50
  if (${preserveClipboard ? "$clipboardCaptured -and $null -ne $originalClipboard" : "$false"}) {
    Set-Clipboard -Value $originalClipboard
  }
  @{
    success = $true
    method = "clipboard_paste"
    manualPasteRequired = $false
  } | ConvertTo-Json -Compress
} catch {
  if ($clipboardSet) {
    @{
      success = $true
      method = "copied_only"
      manualPasteRequired = $true
      errorCode = "windows_clipboard_paste_failed"
    } | ConvertTo-Json -Compress
  } else {
    @{
      success = $false
      method = "copied_only"
      manualPasteRequired = $true
      errorCode = "windows_clipboard_set_failed"
    } | ConvertTo-Json -Compress
  }
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
      canDetectFocus: true,
      canLocateCaret: true,
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
