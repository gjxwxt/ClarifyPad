import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";
import {
  createProbeOutput
} from "../packages/shared/src/index.js";
import { verifyInsertedText } from "../packages/platform-windows/src/verification.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const rawInput = process.argv.slice(2).join(" ").trim() || "这个需求请尽快处理";
  const output = createProbeOutput(rawInput);
  const artifactsDir = resolve("artifacts");
  const filePath = resolve(artifactsDir, "probe-host.txt");
  const reportPath = resolve(artifactsDir, "probe-notepad-report.json");
  const tracePath = resolve(artifactsDir, "probe-notepad-trace.json");
  const bridge = new WindowsPowerShellBridge();

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(filePath, "", "utf8");
  await writeTrace(tracePath, {
    phase: "initialized",
    filePath,
    reportPath,
    rawInput,
    output
  });

  const pid = await launchNotepad(filePath);
  await writeTrace(tracePath, {
    phase: "launched_notepad",
    pid
  });

  try {
    await activateWindow(pid);
    await writeTrace(tracePath, {
      phase: "activated_window",
      pid
    });
    await delay(500);

    const insertResult = await bridge.insertText({
      text: output,
      mode: "insert_at_caret"
    });
    await writeTrace(tracePath, {
      phase: "inserted_text",
      pid,
      insertResult
    });

    await delay(500);
    const capturedText = await captureNotepadText(pid);
    await writeTrace(tracePath, {
      phase: "captured_text",
      pid,
      capturedText
    });
    const verification = verifyInsertedText(output, capturedText);
    const report = {
      host: "notepad",
      pid,
      insertResult,
      verification
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log(
      JSON.stringify(report, null, 2)
    );
    await writeTrace(tracePath, {
      phase: "report_written",
      pid,
      reportPath
    });
  } finally {
    await closeProcess(pid);
    await writeTrace(tracePath, {
      phase: "closed_process",
      pid
    });
  }
}

async function launchNotepad(filePath: string): Promise<number> {
  const command = `
$p = Start-Process notepad -ArgumentList '${toPowerShellSingleQuoted(filePath)}' -PassThru
Start-Sleep -Seconds 2
$p.Id
`;

  const stdout = await runPowerShell(command);
  return Number.parseInt(stdout.trim(), 10);
}

async function activateWindow(processId: number): Promise<void> {
  const command = `
$wshell = New-Object -ComObject WScript.Shell
[void]$wshell.AppActivate(${processId})
`;

  await runPowerShell(command);
}

async function captureNotepadText(processId: number): Promise<string> {
  const command = `
Add-Type -AssemblyName System.Windows.Forms
$wshell = New-Object -ComObject WScript.Shell
[void]$wshell.AppActivate(${processId})
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^c')
Start-Sleep -Milliseconds 250
Get-Clipboard -Raw
`;

  return runPowerShell(command);
}

async function closeProcess(processId: number): Promise<void> {
  const command = `Stop-Process -Id ${processId} -Force -ErrorAction SilentlyContinue`;
  await runPowerShell(command);
}

async function runPowerShell(script: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();\n${script}`
    ],
    {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    }
  );

  if (stderr?.trim()) {
    throw new Error(stderr.trim());
  }

  return stdout.trimEnd();
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function toPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

async function writeTrace(path: string, payload: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(payload, null, 2), "utf8");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
