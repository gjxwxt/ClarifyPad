import { describe, expect, it } from "vitest";

import {
  parseVerificationJsonl,
  summarizeVerificationRecords
} from "../packages/storage/src/app-verification-matrix.js";

describe("parseVerificationJsonl", () => {
  it("parses newline-delimited records and ignores empty lines", () => {
    const content = `{"platform":"windows","appName":"Chrome","appId":"chrome","probeEntry":"panel","insertMethod":"clipboard_paste","result":"pass"}\n\n{"platform":"windows","appName":"Feishu","appId":"feishu","probeEntry":"panel","insertMethod":"copied_only","result":"manual_paste"}\n`;

    const records = parseVerificationJsonl(content);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      appId: "chrome",
      result: "pass"
    });
    expect(records[1]).toMatchObject({
      appId: "feishu",
      result: "manual_paste"
    });
  });
});

describe("summarizeVerificationRecords", () => {
  it("groups by app and counts results", () => {
    const summary = summarizeVerificationRecords([
      {
        platform: "windows",
        appName: "Chrome",
        appId: "chrome",
        probeEntry: "panel",
        insertMethod: "clipboard_paste",
        result: "pass"
      },
      {
        platform: "windows",
        appName: "Chrome",
        appId: "chrome",
        probeEntry: "panel",
        insertMethod: "copied_only",
        result: "manual_paste"
      },
      {
        platform: "windows",
        appName: "Feishu",
        appId: "feishu",
        probeEntry: "panel",
        insertMethod: "clipboard_paste",
        result: "fail"
      }
    ]);

    expect(summary).toMatchObject({
      total: 3,
      pass: 1,
      fail: 1,
      manualPaste: 1
    });
    expect(summary.byApp).toEqual([
      {
        appId: "chrome",
        appName: "Chrome",
        total: 2,
        pass: 1,
        fail: 0,
        manualPaste: 1
      },
      {
        appId: "feishu",
        appName: "Feishu",
        total: 1,
        pass: 0,
        fail: 1,
        manualPaste: 0
      }
    ]);
  });
});
