import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { TechnicalProbeService } from "../packages/shared/src/index.js";
import { JsonlProbeTelemetry } from "../packages/storage/src/index.js";
import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

async function main(): Promise<void> {
  const rawInput = process.argv.slice(2).join(" ").trim() || "这个需求请尽快处理";
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

  console.log("3 秒后执行插入探针，请先将焦点切到目标输入框。");
  await delay(3000);

  const confirmResult = await service.confirm(startResult.activeApp, rawInput);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
