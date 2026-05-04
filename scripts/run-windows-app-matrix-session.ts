import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import {
  AppVerificationLog,
  WINDOWS_TARGET_APPS,
  type AppVerificationRecord
} from "../packages/storage/src/index.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const artifactsDir = resolve("artifacts");
  const filePath = resolve(artifactsDir, "app-verification.jsonl");
  await mkdir(artifactsDir, { recursive: true });

  const bridge = new WindowsPowerShellBridge();
  const log = new AppVerificationLog(filePath);
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    for (const target of WINDOWS_TARGET_APPS) {
      console.log(`\n=== ${target.appName} (${target.scenario}) ===`);
      const action = (
        await rl.question("输入 r 记录本项，s 跳过本项，q 结束会话: ")
      )
        .trim()
        .toLowerCase();

      if (action === "q") {
        break;
      }

      if (action === "s") {
        continue;
      }

      const activeApp = await bridge.getActiveApp();
      if (normalize(activeApp.appName) !== normalize(target.appName)) {
        console.log(
          `提示：当前前台应用是 ${activeApp.appName}，与目标 ${target.appName} 不一致，请确认后再记录。`
        );
      }
      const result = normalizeResult(
        await rl.question("结果 pass / fail / manual_paste: ")
      );
      const method = normalizeMethod(
        await rl.question("方式 direct / clipboard_paste / copied_only / unknown: ")
      );
      const notes = await rl.question("备注（可留空）: ");

      const record: AppVerificationRecord = {
        platform: "windows",
        targetAppName: target.appName,
        targetAppIdHint: target.appIdHint,
        targetScenario: target.scenario,
        appName: activeApp.appName || target.appName,
        appId: activeApp.appId || target.appIdHint,
        processId: activeApp.processId,
        windowTitle: activeApp.windowTitle,
        probeEntry: "panel",
        insertMethod: method,
        result,
        notes: notes.trim() || undefined
      };

      await log.append(record);
      console.log(`已记录到 ${filePath}`);
    }

    console.log(`\n会话结束。日志路径: ${filePath}`);
    console.log("可运行 `npm run probe:win:summary` 查看汇总。");
  } finally {
    rl.close();
  }
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

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
