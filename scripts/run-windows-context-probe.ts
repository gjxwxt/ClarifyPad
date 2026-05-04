import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });

  const activeApp = await bridge.getActiveApp();
  const focusContext = await bridge.getFocusContext();
  const capabilities = await bridge.getPlatformCapabilities();

  console.log(
    JSON.stringify(
      {
        activeApp,
        focusContext,
        capabilities
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
