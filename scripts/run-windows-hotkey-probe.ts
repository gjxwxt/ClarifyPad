import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const shortcut = process.argv.slice(2).join(" ").trim() || "Ctrl+Shift+Space";
  const bridge = new WindowsPowerShellBridge();
  const success = await bridge.registerGlobalHotkey(shortcut);

  console.log(
    JSON.stringify(
      {
        phase: "hotkey_probe",
        shortcut,
        success
      },
      null,
      2
    )
  );

  if (!success) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
