import { performance } from "node:perf_hooks";

import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";

type DoctorCheck =
  | {
      name: string;
      ok: true;
      durationMs: number;
      details: Record<string, unknown>;
    }
  | {
      name: string;
      ok: false;
      durationMs: number;
      error: string;
    };

async function main(): Promise<void> {
  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });
  const checks: DoctorCheck[] = [];

  checks.push(await runCheck("platform_capabilities", () => bridge.getPlatformCapabilities()));
  checks.push(await runCheck("permission_status", () => bridge.getPermissionStatus()));
  checks.push(await runCheck("global_hotkey_probe", () => bridge.registerGlobalHotkey("Ctrl+Shift+Space")));
  checks.push(await runCheck("active_app", () => bridge.getActiveApp()));
  checks.push(await runCheck("focus_context", () => bridge.getFocusContext()));

  const failed = checks.filter((check) => !check.ok).length;
  const status = failed === 0 ? "pass" : "fail";

  console.log(
    JSON.stringify(
      {
        phase: "windows_doctor",
        status,
        failedChecks: failed,
        totalChecks: checks.length,
        checks
      },
      null,
      2
    )
  );

  if (status === "fail") {
    process.exitCode = 1;
  }
}

async function runCheck(
  name: string,
  work: () => Promise<unknown>
): Promise<DoctorCheck> {
  const start = performance.now();
  try {
    const value = await work();
    return {
      name,
      ok: true,
      durationMs: Number((performance.now() - start).toFixed(1)),
      details: normalizeDetails(value)
    };
  } catch (error) {
    return {
      name,
      ok: false,
      durationMs: Number((performance.now() - start).toFixed(1)),
      error: formatError(error)
    };
  }
}

function normalizeDetails(value: unknown): Record<string, unknown> {
  if (typeof value === "boolean") {
    return { value };
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return String(error);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
