import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";
import { showProbePanel } from "../packages/platform-windows/src/panel.js";
import { TechnicalProbeService } from "../packages/shared/src/index.js";
import { JsonlProbeTelemetry } from "../packages/storage/src/index.js";

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const telemetryPath = resolve("artifacts", "probe-events.jsonl");
  await mkdir(resolve("artifacts"), { recursive: true });

  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });
  const telemetry = new JsonlProbeTelemetry(telemetryPath);
  const service = new TechnicalProbeService(bridge, telemetry);

  const startResult = await service.start();
  console.log(
    JSON.stringify(
      {
        phase: "start",
        telemetryPath,
        result: startResult
      },
      null,
      2
    )
  );

  if (startResult.status !== "ready") {
    return;
  }

  const panelResult = await showProbePanel(startResult.activeApp, {
    prefillText: options.prefillText,
    autoConfirmDelayMs: options.autoConfirmDelayMs,
    anchorRect: startResult.anchorRect
  });
  if (panelResult.action === "cancel") {
    console.log(
      JSON.stringify(
        {
          phase: "panel",
          result: panelResult
        },
        null,
        2
      )
    );
    return;
  }

  await bridge.activateApp(startResult.activeApp);
  await delay(250);

  const confirmResult = await service.confirm(
    startResult.activeApp,
    panelResult.rawInput
  );

  console.log(
    JSON.stringify(
      {
        phase: "confirm",
        telemetryPath,
        result: confirmResult
      },
      null,
      2
    )
  );
}

type ScriptOptions = {
  prefillText?: string;
  autoConfirmDelayMs?: number;
};

function parseOptions(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--prefill") {
      const next = argv[i + 1];
      if (next) {
        options.prefillText = next;
        i += 1;
      }
      continue;
    }

    if (value === "--auto-confirm-ms") {
      const next = argv[i + 1];
      if (next) {
        const parsed = Number.parseInt(next, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
          options.autoConfirmDelayMs = parsed;
        }
        i += 1;
      }
    }
  }

  return options;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
