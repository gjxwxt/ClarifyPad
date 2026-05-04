import { describe, expect, it } from "vitest";

import {
  parseVerificationJsonl,
  summarizeTargetCoverage,
  summarizeVerificationRecords
} from "../packages/storage/src/app-verification-matrix.js";
import { WINDOWS_TARGET_APPS } from "../packages/storage/src/windows-target-apps.js";

describe("parseVerificationJsonl", () => {
  it("parses newline-delimited records and ignores empty lines", () => {
    const content = `{"platform":"windows","targetAppName":"Chrome","targetAppIdHint":"chrome","appName":"Chrome","appId":"chrome","probeEntry":"panel","insertMethod":"clipboard_paste","result":"pass"}\n\n{"platform":"windows","targetAppName":"Feishu","targetAppIdHint":"feishu","appName":"Feishu","appId":"feishu","probeEntry":"panel","insertMethod":"copied_only","result":"manual_paste"}\n`;

    const records = parseVerificationJsonl(content);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      targetAppName: "Chrome",
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

describe("summarizeTargetCoverage", () => {
  it("builds coverage status by target app list", () => {
    const coverage = summarizeTargetCoverage(
      [
        {
          platform: "windows",
          targetAppName: "Feishu",
          targetAppIdHint: "Feishu",
          targetScenario: "协作消息输入框",
          appName: "Feishu",
          appId: "Feishu",
          probeEntry: "panel",
          insertMethod: "clipboard_paste",
          result: "pass"
        },
        {
          platform: "windows",
          targetAppName: "Feishu",
          targetAppIdHint: "Feishu",
          targetScenario: "协作消息输入框",
          appName: "Feishu",
          appId: "Feishu",
          probeEntry: "panel",
          insertMethod: "copied_only",
          result: "manual_paste"
        },
        {
          platform: "windows",
          targetAppName: "Slack",
          targetAppIdHint: "slack",
          targetScenario: "协作消息输入框",
          appName: "Slack",
          appId: "slack",
          probeEntry: "panel",
          insertMethod: "clipboard_paste",
          result: "fail"
        }
      ],
      WINDOWS_TARGET_APPS,
      80
    );

    expect(coverage.totalTargets).toBe(WINDOWS_TARGET_APPS.length);
    expect(coverage.testedTargets).toBe(2);
    expect(coverage.untestedTargets).toBe(WINDOWS_TARGET_APPS.length - 2);

    const feishu = coverage.items.find((item) => item.targetAppName === "Feishu");
    expect(feishu).toMatchObject({
      total: 2,
      pass: 1,
      manualPaste: 1,
      passRate: 50,
      status: "needs_attention"
    });

    const slack = coverage.items.find((item) => item.targetAppName === "Slack");
    expect(slack).toMatchObject({
      total: 1,
      fail: 1,
      passRate: 0,
      status: "needs_attention"
    });
  });
});
