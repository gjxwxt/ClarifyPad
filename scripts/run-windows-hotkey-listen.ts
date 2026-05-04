import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { parseWindowsHotkey } from "../packages/platform-windows/src/hotkey.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const shortcut = process.argv[2]?.trim() || "Ctrl+Shift+Space";
  const timeoutMs = parseTimeoutMs(process.argv[3]);
  const parsed = parseWindowsHotkey(shortcut);

  if (!parsed) {
    throw new Error(`Invalid hotkey shortcut: ${shortcut}`);
  }

  const command = `
Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class HotkeyProbeNative {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public int X;
    public int Y;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public UIntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public POINT pt;
  }

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

  [DllImport("user32.dll", SetLastError=true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

  [DllImport("user32.dll")]
  public static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);
}
"@

$wmHotkey = 0x0312
$pmRemove = 0x0001
$hotkeyId = 862031
$registered = [HotkeyProbeNative]::RegisterHotKey([IntPtr]::Zero, $hotkeyId, ${parsed.modifiers}, ${parsed.virtualKey})
if (-not $registered) {
  @{
    status = "register_failed"
    shortcut = "${escapeForPowerShell(shortcut)}"
  } | ConvertTo-Json -Compress
  exit 0
}

$status = "timeout"
$deadline = (Get-Date).AddMilliseconds(${timeoutMs})
try {
  while ((Get-Date) -lt $deadline) {
    $msg = New-Object HotkeyProbeNative+MSG
    if ([HotkeyProbeNative]::PeekMessage([ref]$msg, [IntPtr]::Zero, $wmHotkey, $wmHotkey, $pmRemove)) {
      if ([int]$msg.wParam -eq $hotkeyId) {
        $status = "captured"
        break
      }
    }

    Start-Sleep -Milliseconds 30
  }
} finally {
  [void][HotkeyProbeNative]::UnregisterHotKey([IntPtr]::Zero, $hotkeyId)
}

@{
  status = $status
  shortcut = "${escapeForPowerShell(shortcut)}"
  timeoutMs = ${timeoutMs}
} | ConvertTo-Json -Compress
`;

  const { stdout } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();\n${command}`
    ],
    {
      windowsHide: false,
      maxBuffer: 1024 * 1024
    }
  );

  console.log(JSON.stringify(JSON.parse(stdout.trim()), null, 2));
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10000;
  }

  return Math.min(parsed, 120000);
}

function escapeForPowerShell(value: string): string {
  return value.replace(/"/g, '\\"');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
