import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import { TechnicalProbeService } from "../packages/shared/src/index.js";
import { JsonlProbeTelemetry } from "../packages/storage/src/index.js";
import { MacOSAppleScriptBridge } from "../packages/platform-macos/src/index.js";

async function main(): Promise<void> {
  const telemetryPath = resolve("artifacts", "probe-events-macos.jsonl");
  await mkdir(resolve("artifacts"), { recursive: true });

  const bridge = new MacOSAppleScriptBridge({
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
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
