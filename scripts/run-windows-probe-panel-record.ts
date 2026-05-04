import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { showProbePanel } from "../packages/platform-windows/src/panel.js";
import { TechnicalProbeService } from "../packages/shared/src/index.js";
import {
  AppVerificationLog,
  JsonlProbeTelemetry,
  deriveVerificationDefaults,
  type AppVerificationRecord
} from "../packages/storage/src/index.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const artifactsDir = resolve("artifacts");
  const telemetryPath = resolve(artifactsDir, "probe-events.jsonl");
  const verificationPath = resolve(artifactsDir, "app-verification.jsonl");
  await mkdir(artifactsDir, { recursive: true });

  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });
  const telemetry = new JsonlProbeTelemetry(telemetryPath);
  const service = new TechnicalProbeService(bridge, telemetry);
  const verificationLog = new AppVerificationLog(verificationPath);
  const rl = createInterface({ input: stdin, output: stdout });

  try {
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

    const execution = await service.confirm(startResult.activeApp, panelResult.rawInput);
    const defaults = deriveVerificationDefaults(execution);

    console.log(
      JSON.stringify(
        {
          phase: "confirm",
          result: execution,
          verificationDefaults: defaults
        },
        null,
        2
      )
    );

    const resultInput = await rl.question(
      `验证结果（默认 ${defaults.result}，可选 pass/fail/manual_paste，直接回车用默认）: `
    );
    const result = resultInput.trim()
      ? normalizeResult(resultInput)
      : defaults.result;

    const methodInput = await rl.question(
      `插入方式（默认 ${defaults.insertMethod}，可选 direct/clipboard_paste/copied_only/unknown，直接回车用默认）: `
    );
    const method = methodInput.trim()
      ? normalizeMethod(methodInput)
      : defaults.insertMethod;

    const notes = await rl.question("备注（可留空）: ");

    const record: AppVerificationRecord = {
      platform: "windows",
      targetAppName: options.targetAppName ?? execution.activeApp.appName,
      targetAppIdHint: options.targetAppIdHint ?? execution.activeApp.appId,
      targetScenario: options.targetScenario,
      appName: execution.activeApp.appName,
      appId: execution.activeApp.appId,
      processId: execution.activeApp.processId,
      windowTitle: execution.activeApp.windowTitle,
      probeEntry: "panel",
      insertMethod: method,
      result,
      notes: notes.trim() || undefined
    };

    await verificationLog.append(record);

    console.log(
      JSON.stringify(
        {
          phase: "recorded",
          telemetryPath,
          verificationPath,
          record
        },
        null,
        2
      )
    );
  } finally {
    rl.close();
  }
}

type ScriptOptions = {
  targetAppName?: string;
  targetAppIdHint?: string;
  targetScenario?: string;
};

function parseOptions(argv: string[]): ScriptOptions {
  const options: ScriptOptions = {};

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    const next = argv[i + 1];
    if (!next) {
      continue;
    }

    if (value === "--target-app") {
      options.targetAppName = next;
      i += 1;
      continue;
    }

    if (value === "--target-id") {
      options.targetAppIdHint = next;
      i += 1;
      continue;
    }

    if (value === "--target-scenario") {
      options.targetScenario = next;
      i += 1;
    }
  }

  return options;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function normalizeResult(value: string): "pass" | "fail" | "manual_paste" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "pass" || normalized === "fail" || normalized === "manual_paste") {
    return normalized;
  }

  throw new Error("Verification result must be pass, fail, or manual_paste.");
}

function normalizeMethod(
  value: string
): "direct" | "clipboard_paste" | "copied_only" | "unknown" {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "direct" ||
    normalized === "clipboard_paste" ||
    normalized === "copied_only" ||
    normalized === "unknown"
  ) {
    return normalized;
  }

  throw new Error(
    "Verification method must be direct, clipboard_paste, copied_only, or unknown."
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
