import { waitForWindowsHotkeyCapture } from "../packages/platform-windows/src/hotkey-listener.js";

async function main(): Promise<void> {
  const shortcut = process.argv[2]?.trim() || "Ctrl+Shift+Space";
  const timeoutMs = parseTimeoutMs(process.argv[3]);
  const result = await waitForWindowsHotkeyCapture(shortcut, timeoutMs);
  console.log(JSON.stringify(result, null, 2));
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10000;
  }

  return Math.min(parsed, 120000);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
