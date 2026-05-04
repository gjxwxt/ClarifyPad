import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ActiveApp } from "../../shared/src/index.js";

const execFileAsync = promisify(execFile);

export type ProbePanelResult =
  | {
      action: "confirm";
      rawInput: string;
    }
  | {
      action: "cancel";
    };

export async function showProbePanel(activeApp: ActiveApp): Promise<ProbePanelResult> {
  const script = buildProbePanelScript(activeApp);
  let stdout = "";

  try {
    const result = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-STA",
        "-Command",
        `$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new();\n${script}`
      ],
      {
        windowsHide: false,
        maxBuffer: 1024 * 1024
      }
    );
    stdout = result.stdout;
  } catch (error) {
    const failed = error as { stdout?: string };
    stdout = failed.stdout ?? "";
    if (!stdout.trim()) {
      throw error;
    }
  }

  return parseProbePanelOutput(stdout);
}

export function parseProbePanelOutput(output: string): ProbePanelResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(output.trim());
  } catch {
    throw new Error("Probe panel returned invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || !("action" in parsed)) {
    throw new Error("Probe panel returned invalid payload.");
  }

  const action = (parsed as { action?: unknown }).action;
  if (action === "cancel") {
    return { action: "cancel" };
  }

  if (action === "confirm") {
    const rawInput = (parsed as { rawInput?: unknown }).rawInput;
    if (typeof rawInput !== "string" || rawInput.trim().length === 0) {
      throw new Error("Probe panel confirm action requires non-empty rawInput.");
    }

    return {
      action: "confirm",
      rawInput
    };
  }

  throw new Error("Probe panel returned unsupported action.");
}

function buildProbePanelScript(activeApp: ActiveApp): string {
  const appLabel = escapeForPowerShell(activeApp.appName || activeApp.appId);
  const titleLabel = escapeForPowerShell(activeApp.windowTitle ?? "");

  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:result = $null
$accent = [System.Drawing.Color]::FromArgb(15, 118, 110)
$accentSoft = [System.Drawing.Color]::FromArgb(240, 253, 250)
$surface = [System.Drawing.Color]::FromArgb(250, 250, 249)
$panelBorder = [System.Drawing.Color]::FromArgb(212, 212, 216)
$textPrimary = [System.Drawing.Color]::FromArgb(24, 24, 27)
$textMuted = [System.Drawing.Color]::FromArgb(113, 113, 122)
$buttonMuted = [System.Drawing.Color]::FromArgb(244, 244, 245)
$buttonMutedBorder = [System.Drawing.Color]::FromArgb(212, 212, 216)
$titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 15)
$bodyFont = New-Object System.Drawing.Font('Segoe UI', 9.75)
$smallFont = New-Object System.Drawing.Font('Segoe UI', 9)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'ClarifyPad Probe'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(640, 470)
$form.TopMost = $true
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = $surface
$form.Font = $bodyFont

$accentBar = New-Object System.Windows.Forms.Panel
$accentBar.BackColor = $accent
$accentBar.Location = New-Object System.Drawing.Point(0, 0)
$accentBar.Size = New-Object System.Drawing.Size(640, 6)
$form.Controls.Add($accentBar)

$title = New-Object System.Windows.Forms.Label
$title.Text = '发送前探针面板'
$title.Font = $titleFont
$title.ForeColor = $textPrimary
$title.Location = New-Object System.Drawing.Point(20, 20)
$title.Size = New-Object System.Drawing.Size(220, 30)
$form.Controls.Add($title)

$badge = New-Object System.Windows.Forms.Label
$badge.Text = '目标应用  ${appLabel}'
$badge.BackColor = $accentSoft
$badge.ForeColor = $accent
$badge.Font = $smallFont
$badge.TextAlign = 'MiddleCenter'
$badge.Location = New-Object System.Drawing.Point(430, 22)
$badge.Size = New-Object System.Drawing.Size(176, 28)
$form.Controls.Add($badge)

$subHeader = New-Object System.Windows.Forms.Label
$subHeader.Text = '把粗糙想法先放到这里，确认后会尝试插回原输入框。当前窗口：${titleLabel}'
$subHeader.ForeColor = $textMuted
$subHeader.Font = $smallFont
$subHeader.Location = New-Object System.Drawing.Point(22, 56)
$subHeader.Size = New-Object System.Drawing.Size(584, 40)
$form.Controls.Add($subHeader)

$composerLabel = New-Object System.Windows.Forms.Label
$composerLabel.Text = '输入内容'
$composerLabel.ForeColor = $textPrimary
$composerLabel.Font = $smallFont
$composerLabel.Location = New-Object System.Drawing.Point(22, 106)
$composerLabel.Size = New-Object System.Drawing.Size(80, 20)
$form.Controls.Add($composerLabel)

$inputFrame = New-Object System.Windows.Forms.Panel
$inputFrame.BackColor = $panelBorder
$inputFrame.Location = New-Object System.Drawing.Point(22, 132)
$inputFrame.Size = New-Object System.Drawing.Size(584, 226)
$form.Controls.Add($inputFrame)

$inputBox = New-Object System.Windows.Forms.TextBox
$inputBox.Multiline = $true
$inputBox.AcceptsReturn = $true
$inputBox.AcceptsTab = $false
$inputBox.ScrollBars = 'Vertical'
$inputBox.BorderStyle = 'None'
$inputBox.BackColor = [System.Drawing.Color]::White
$inputBox.ForeColor = $textPrimary
$inputBox.Font = $bodyFont
$inputBox.Location = New-Object System.Drawing.Point(1, 1)
$inputBox.Size = New-Object System.Drawing.Size(582, 224)
$inputBox.ImeMode = 'On'
$inputBox.Add_KeyDown({
  if ($_.Control -and $_.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
    $confirm.PerformClick()
    $_.SuppressKeyPress = $true
  }
})
$inputFrame.Controls.Add($inputBox)

$hint = New-Object System.Windows.Forms.Label
$hint.Text = 'Ctrl+Enter 或点击按钮确认插入，Esc 取消。当前阶段仍使用 clipboard paste 作为主要插入路径。'
$hint.ForeColor = $textMuted
$hint.Font = $smallFont
$hint.Location = New-Object System.Drawing.Point(22, 370)
$hint.Size = New-Object System.Drawing.Size(584, 20)
$form.Controls.Add($hint)

$confirm = New-Object System.Windows.Forms.Button
$confirm.Text = '确认插入'
$confirm.Location = New-Object System.Drawing.Point(416, 398)
$confirm.Size = New-Object System.Drawing.Size(92, 32)
$confirm.BackColor = $accent
$confirm.ForeColor = [System.Drawing.Color]::White
$confirm.FlatStyle = 'Flat'
$confirm.FlatAppearance.BorderSize = 0
$confirm.Add_Click({
  if ([string]::IsNullOrWhiteSpace($inputBox.Text)) {
    [System.Windows.Forms.MessageBox]::Show('请输入要插入的内容。', 'ClarifyPad Probe')
    return
  }

  $script:result = @{
    action = 'confirm'
    rawInput = $inputBox.Text
  }
  $form.Close()
})
$form.Controls.Add($confirm)
$form.AcceptButton = $confirm

$cancel = New-Object System.Windows.Forms.Button
$cancel.Text = '取消'
$cancel.Location = New-Object System.Drawing.Point(516, 398)
$cancel.Size = New-Object System.Drawing.Size(92, 32)
$cancel.BackColor = $buttonMuted
$cancel.ForeColor = $textPrimary
$cancel.FlatStyle = 'Flat'
$cancel.FlatAppearance.BorderColor = $buttonMutedBorder
$cancel.Add_Click({
  $script:result = @{
    action = 'cancel'
  }
  $form.Close()
})
$form.Controls.Add($cancel)
$form.CancelButton = $cancel

$form.Add_Shown({
  $inputBox.Focus()
})

[void]$form.ShowDialog()

if ($null -eq $script:result) {
  $script:result = @{
    action = 'cancel'
  }
}

$script:result | ConvertTo-Json -Compress
`;
}

function escapeForPowerShell(value: string): string {
  return value.replace(/'/g, "''");
}
