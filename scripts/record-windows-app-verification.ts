import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { AppVerificationLog } from "../packages/storage/src/index.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const artifactsDir = resolve("artifacts");
  const filePath = resolve(artifactsDir, "app-verification.jsonl");
  await mkdir(artifactsDir, { recursive: true });

  const bridge = new WindowsPowerShellBridge();
  const activeApp = await bridge.getActiveApp();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const result = await rl.question(
      `当前目标应用是 ${activeApp.appName}，插入结果如何？输入 pass / fail / manual_paste: `
    );
    const normalizedResult = normalizeResult(result);
    const method = await rl.question(
      "插入方式是什么？输入 direct / clipboard_paste / copied_only / unknown: "
    );
    const normalizedMethod = normalizeMethod(method);
    const notes = await rl.question("备注（可留空）: ");

    const log = new AppVerificationLog(filePath);
    await log.append({
      platform: "windows",
      appName: activeApp.appName,
      appId: activeApp.appId,
      processId: activeApp.processId,
      windowTitle: activeApp.windowTitle,
      probeEntry: "panel",
      insertMethod: normalizedMethod,
      result: normalizedResult,
      notes: notes.trim() || undefined
    });

    console.log(
      JSON.stringify(
        {
          savedTo: filePath,
          app: activeApp,
          result: normalizedResult,
          method: normalizedMethod
        },
        null,
        2
      )
    );
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
