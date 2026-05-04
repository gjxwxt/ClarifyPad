import type { AppVerificationRecord } from "./app-verification-log.js";

export type AppVerificationSummary = {
  total: number;
  pass: number;
  fail: number;
  manualPaste: number;
  byApp: Array<{
    appId: string;
    appName: string;
    total: number;
    pass: number;
    fail: number;
    manualPaste: number;
  }>;
};

export function parseVerificationJsonl(content: string): AppVerificationRecord[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const records: AppVerificationRecord[] = [];
  for (const line of lines) {
    const parsed = JSON.parse(line) as AppVerificationRecord & { timestamp?: string };
    records.push({
      platform: parsed.platform,
      appName: parsed.appName,
      appId: parsed.appId,
      processId: parsed.processId,
      windowTitle: parsed.windowTitle,
      probeEntry: parsed.probeEntry,
      insertMethod: parsed.insertMethod,
      result: parsed.result,
      notes: parsed.notes
    });
  }

  return records;
}

export function summarizeVerificationRecords(
  records: AppVerificationRecord[]
): AppVerificationSummary {
  const byAppMap = new Map<
    string,
    {
      appId: string;
      appName: string;
      total: number;
      pass: number;
      fail: number;
      manualPaste: number;
    }
  >();

  let pass = 0;
  let fail = 0;
  let manualPaste = 0;

  for (const record of records) {
    if (record.result === "pass") {
      pass += 1;
    } else if (record.result === "fail") {
      fail += 1;
    } else {
      manualPaste += 1;
    }

    const existing = byAppMap.get(record.appId) ?? {
      appId: record.appId,
      appName: record.appName,
      total: 0,
      pass: 0,
      fail: 0,
      manualPaste: 0
    };

    existing.total += 1;
    if (record.result === "pass") {
      existing.pass += 1;
    } else if (record.result === "fail") {
      existing.fail += 1;
    } else {
      existing.manualPaste += 1;
    }

    byAppMap.set(record.appId, existing);
  }

  const byApp = Array.from(byAppMap.values()).sort((a, b) => b.total - a.total);

  return {
    total: records.length,
    pass,
    fail,
    manualPaste,
    byApp
  };
}
