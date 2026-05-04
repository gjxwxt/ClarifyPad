import type { AppVerificationRecord } from "./app-verification-log.js";
import type { WindowsTargetApp } from "./windows-target-apps.js";

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

export type TargetCoverageItem = {
  targetAppName: string;
  targetAppIdHint: string;
  targetScenario: string;
  total: number;
  pass: number;
  fail: number;
  manualPaste: number;
  passRate: number;
  status: "untested" | "needs_attention" | "passing";
};

export type TargetCoverageSummary = {
  totalTargets: number;
  testedTargets: number;
  untestedTargets: number;
  items: TargetCoverageItem[];
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
      targetAppName: parsed.targetAppName,
      targetAppIdHint: parsed.targetAppIdHint,
      targetScenario: parsed.targetScenario,
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

export function summarizeTargetCoverage(
  records: AppVerificationRecord[],
  targets: WindowsTargetApp[],
  minPassingRate = 80
): TargetCoverageSummary {
  const aggregates = new Map<
    string,
    {
      total: number;
      pass: number;
      fail: number;
      manualPaste: number;
    }
  >();

  for (const record of records) {
    const targetName = normalize(record.targetAppName ?? record.appName);
    const existing = aggregates.get(targetName) ?? {
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

    aggregates.set(targetName, existing);
  }

  const items = targets.map((target) => {
    const targetKey = normalize(target.appName);
    const aggregate = aggregates.get(targetKey);
    if (!aggregate) {
      return {
        targetAppName: target.appName,
        targetAppIdHint: target.appIdHint,
        targetScenario: target.scenario,
        total: 0,
        pass: 0,
        fail: 0,
        manualPaste: 0,
        passRate: 0,
        status: "untested" as const
      };
    }

    const passRate =
      aggregate.total > 0 ? Number(((aggregate.pass / aggregate.total) * 100).toFixed(1)) : 0;

    return {
      targetAppName: target.appName,
      targetAppIdHint: target.appIdHint,
      targetScenario: target.scenario,
      total: aggregate.total,
      pass: aggregate.pass,
      fail: aggregate.fail,
      manualPaste: aggregate.manualPaste,
      passRate,
      status:
        passRate >= minPassingRate && aggregate.fail === 0
          ? ("passing" as const)
          : ("needs_attention" as const)
    };
  });

  const testedTargets = items.filter((item) => item.total > 0).length;

  return {
    totalTargets: items.length,
    testedTargets,
    untestedTargets: items.length - testedTargets,
    items
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
