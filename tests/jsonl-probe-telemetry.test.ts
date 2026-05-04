import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { JsonlProbeTelemetry } from "../packages/storage/src/jsonl-probe-telemetry.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("JsonlProbeTelemetry", () => {
  it("creates the target directory and appends newline-delimited events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "clarifypad-telemetry-"));
    tempDirs.push(dir);
    const filePath = join(dir, "probe-events.jsonl");
    const telemetry = new JsonlProbeTelemetry(filePath);

    await telemetry.record("probe_started", {
      appName: "Chrome",
      appId: "chrome"
    });
    await telemetry.record("probe_completed", {
      appName: "Chrome",
      appId: "chrome",
      method: "clipboard_paste",
      manualPasteRequired: false
    });

    const content = await readFile(filePath, "utf8");
    const lines = content.trim().split("\n");

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      event: "probe_started",
      payload: {
        appName: "Chrome",
        appId: "chrome"
      }
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      event: "probe_completed",
      payload: {
        appName: "Chrome",
        appId: "chrome",
        method: "clipboard_paste",
        manualPasteRequired: false
      }
    });
  });
});
