import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { showProbePanel } from "../packages/platform-windows/src/panel.js";
import { TechnicalProbeService } from "../packages/shared/src/index.js";
import {
  AppVerificationLog,
  JsonlProbeTelemetry,
  WINDOWS_TARGET_APPS,
  deriveVerificationDefaults,
  type AppVerificationRecord
} from "../packages/storage/src/index.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
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
    console.log(`目标列表共 ${WINDOWS_TARGET_APPS.length} 项。`);
    console.log("每项输入 c 继续、s 跳过、q 退出。");

    for (const target of WINDOWS_TARGET_APPS) {
      console.log(`\n=== ${target.appName} (${target.scenario}) ===`);
      const gate = (await rl.question("请先把目标输入框切到前台，输入 c/s/q: "))
        .trim()
        .toLowerCase();

      if (gate === "q") {
        break;
      }
      if (gate === "s") {
        continue;
      }
      if (gate !== "c") {
        console.log("未识别输入，默认跳过本项。");
        continue;
      }

      const startResult = await service.start();
      if (startResult.status !== "ready") {
        console.log(
          `探针被阻断：${startResult.reason}（app=${startResult.activeApp.appName}）`
        );
        const notes = await rl.question("备注（可留空）: ");
        await verificationLog.append({
          platform: "windows",
          targetAppName: target.appName,
          targetAppIdHint: target.appIdHint,
          targetScenario: target.scenario,
          appName: startResult.activeApp.appName,
          appId: startResult.activeApp.appId,
          processId: startResult.activeApp.processId,
          windowTitle: startResult.activeApp.windowTitle,
          probeEntry: "panel",
          insertMethod: "unknown",
          result: "fail",
          notes: notes.trim() || `probe_blocked:${startResult.reason}`
        });
        continue;
      }

      const panelResult = await showProbePanel(startResult.activeApp, {
        anchorRect: startResult.anchorRect
      });
      if (panelResult.action === "cancel") {
        console.log("已取消本项。");
        continue;
      }

      await bridge.activateApp(startResult.activeApp);
      await delay(250);

      const execution = await service.confirm(startResult.activeApp, panelResult.rawInput);
      const defaults = deriveVerificationDefaults(execution);

      console.log(
        JSON.stringify(
          {
            target: target.appName,
            execution,
            defaults
          },
          null,
          2
        )
      );

      const resultInput = await rl.question(
        `验证结果（默认 ${defaults.result}，可选 pass/fail/manual_paste，直接回车用默认）: `
      );
      const result = resultInput.trim() ? normalizeResult(resultInput) : defaults.result;

      const methodInput = await rl.question(
        `插入方式（默认 ${defaults.insertMethod}，可选 direct/clipboard_paste/copied_only/unknown，直接回车用默认）: `
      );
      const method = methodInput.trim()
        ? normalizeMethod(methodInput)
        : defaults.insertMethod;

      const notes = await rl.question("备注（可留空）: ");

      const record: AppVerificationRecord = {
        platform: "windows",
        targetAppName: target.appName,
        targetAppIdHint: target.appIdHint,
        targetScenario: target.scenario,
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
      console.log(`已记录到 ${verificationPath}`);
    }

    console.log("\n矩阵探针会话结束。");
    console.log("可运行 `npm run probe:win:summary` 查看覆盖率。");
  } finally {
    rl.close();
  }
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
