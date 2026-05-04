import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { waitForWindowsHotkeyCapture } from "../packages/platform-windows/src/hotkey-listener.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";
import { showProbePanel } from "../packages/platform-windows/src/panel.js";
import { TechnicalProbeService } from "../packages/shared/src/index.js";
import { JsonlProbeTelemetry } from "../packages/storage/src/index.js";

type ScriptOptions = {
  shortcut: string;
  listenTimeoutMs: number;
  once: boolean;
};

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const telemetryPath = resolve("artifacts", "probe-events.jsonl");
  await mkdir(resolve("artifacts"), { recursive: true });

  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });
  const telemetry = new JsonlProbeTelemetry(telemetryPath);
  const service = new TechnicalProbeService(bridge, telemetry);

  console.log(
    JSON.stringify(
      {
        phase: "hotkey_panel_listener_started",
        shortcut: options.shortcut,
        listenTimeoutMs: options.listenTimeoutMs,
        once: options.once
      },
      null,
      2
    )
  );

  while (true) {
    const hotkeyResult = await waitForWindowsHotkeyCapture(
      options.shortcut,
      options.listenTimeoutMs
    );

    if (hotkeyResult.status === "register_failed") {
      console.log(
        JSON.stringify(
          {
            phase: "hotkey",
            result: hotkeyResult
          },
          null,
          2
        )
      );
      process.exitCode = 1;
      return;
    }

    if (hotkeyResult.status === "timeout") {
      if (options.once) {
        console.log(
          JSON.stringify(
            {
              phase: "hotkey",
              result: hotkeyResult
            },
            null,
            2
          )
        );
        return;
      }
      continue;
    }

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
      if (options.once) {
        return;
      }
      continue;
    }

    const panelResult = await showProbePanel(startResult.activeApp, {
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
      if (options.once) {
        return;
      }
      continue;
    }

    await bridge.activateApp(startResult.activeApp);
    await delay(250);

    const confirmResult = await service.confirm(startResult.activeApp, panelResult.rawInput);
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

    if (options.once) {
      return;
    }
  }
}

function parseOptions(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {
    shortcut: "Ctrl+Shift+Space",
    listenTimeoutMs: 60000,
    once: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--shortcut") {
      const next = argv[i + 1];
      if (next) {
        options.shortcut = next;
        i += 1;
      }
      continue;
    }

    if (value === "--listen-ms") {
      const next = argv[i + 1];
      if (next) {
        const parsed = Number.parseInt(next, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          options.listenTimeoutMs = Math.min(parsed, 120000);
        }
        i += 1;
      }
      continue;
    }

    if (value === "--once") {
      options.once = true;
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
