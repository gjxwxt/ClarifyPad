import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  AppVerificationLog,
  type AppVerificationRecord
} from "../packages/storage/src/app-verification-log.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("AppVerificationLog", () => {
  it("appends newline-delimited verification records", async () => {
    const dir = await mkdtemp(join(tmpdir(), "clarifypad-verification-"));
    tempDirs.push(dir);
    const filePath = join(dir, "app-verification.jsonl");
    const log = new AppVerificationLog(filePath);

    const record: AppVerificationRecord = {
      platform: "windows",
      appName: "Chrome",
      appId: "chrome",
      windowTitle: "ChatGPT - Chrome",
      probeEntry: "panel",
      insertMethod: "clipboard_paste",
      result: "pass",
      notes: "普通文本输入框可正常插入"
    };

    await log.append(record);

    const lines = (await readFile(filePath, "utf8")).trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({
      platform: "windows",
      appName: "Chrome",
      appId: "chrome",
      probeEntry: "panel",
      insertMethod: "clipboard_paste",
      result: "pass",
      notes: "普通文本输入框可正常插入"
    });
    expect(JSON.parse(lines[0]).timestamp).toBeTypeOf("string");
  });
});
