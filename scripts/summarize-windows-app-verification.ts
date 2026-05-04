import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseVerificationJsonl,
  summarizeTargetCoverage,
  summarizeVerificationRecords,
  WINDOWS_TARGET_APPS
} from "../packages/storage/src/index.js";

async function main(): Promise<void> {
  const filePath = resolve("artifacts", "app-verification.jsonl");
  const content = await readFile(filePath, "utf8");
  const records = parseVerificationJsonl(content);
  const summary = summarizeVerificationRecords(records);
  const coverage = summarizeTargetCoverage(records, WINDOWS_TARGET_APPS);
  const untestedTargets = coverage.items
    .filter((item) => item.status === "untested")
    .map((item) => ({
      appName: item.targetAppName,
      scenario: item.targetScenario
    }));
  const needsAttentionTargets = coverage.items
    .filter((item) => item.status === "needs_attention")
    .map((item) => ({
      appName: item.targetAppName,
      passRate: item.passRate,
      fail: item.fail,
      manualPaste: item.manualPaste
    }));

  const passRate =
    summary.total === 0 ? 0 : Number(((summary.pass / summary.total) * 100).toFixed(1));

  console.log(
    JSON.stringify(
      {
        filePath,
        total: summary.total,
        pass: summary.pass,
        fail: summary.fail,
        manualPaste: summary.manualPaste,
        passRate,
        byApp: summary.byApp,
        coverage,
        untestedTargets,
        needsAttentionTargets
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  ) {
    console.error("No app verification log found at artifacts/app-verification.jsonl");
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
