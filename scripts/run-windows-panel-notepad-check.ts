import { mkdir, writeFile } from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { createProbeOutput } from "../packages/shared/src/index.js";
import { verifyInsertedText } from "../packages/platform-windows/src/verification.js";

const execFileAsync = promisify(execFile);

async function main(): Promise<void> {
  const rawInput = process.argv.slice(2).join(" ").trim() || "这个需求请尽快处理";
  const expectedOutput = createProbeOutput(rawInput);
  const artifactsDir = resolve("artifacts");
  const filePath = resolve(artifactsDir, "panel-probe-host.txt");
  const reportPath = resolve(artifactsDir, "panel-probe-notepad-report.json");

  await mkdir(artifactsDir, { recursive: true });
  await writeFile(filePath, "", "utf8");

  const pid = await launchNotepad(filePath);

  try {
    await activateWindowByPid(pid);
    await delay(500);

    const panelRun = runPanelProcess(rawInput);
    const panelProcessResult = await panelRun;
    await delay(600);

    const capturedText = await captureNotepadText(pid);
    const verification = verifyInsertedText(expectedOutput, capturedText);

    const report = {
      host: "notepad",
      pid,
      rawInput,
      expectedOutput,
      panelProcessResult,
      verification
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await closeProcess(pid);
  }
}

async function runPanelProcess(rawInput: string): Promise<{
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      "node",
      [
        "./node_modules/tsx/dist/cli.mjs",
        "./scripts/run-windows-probe-panel.ts",
        "--prefill",
        rawInput,
        "--auto-confirm-ms",
        "250"
      ],
      {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: false
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolvePromise({
        exitCode,
        stdout,
        stderr
      });
    });
  });
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

async function activateWindowByPid(processId: number): Promise<void> {
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
Start-Sleep -Milliseconds 250
[System.Windows.Forms.SendKeys]::SendWait('^a')
Start-Sleep -Milliseconds 150
[System.Windows.Forms.SendKeys]::SendWait('^c')
Start-Sleep -Milliseconds 250
Get-Clipboard -Raw
`;

  return runPowerShell(command);
}

async function closeProcess(processId: number): Promise<void> {
  await runPowerShell(`Stop-Process -Id ${processId} -Force -ErrorAction SilentlyContinue`);
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

function toPowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
