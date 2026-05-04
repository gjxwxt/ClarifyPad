import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  parseVerificationJsonl,
  summarizeVerificationRecords
} from "../packages/storage/src/index.js";

async function main(): Promise<void> {
  const filePath = resolve("artifacts", "app-verification.jsonl");
  const content = await readFile(filePath, "utf8");
  const records = parseVerificationJsonl(content);
  const summary = summarizeVerificationRecords(records);

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
        byApp: summary.byApp
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
