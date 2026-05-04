import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type AppVerificationRecord = {
  platform: "windows" | "macos";
  targetAppName?: string;
  targetAppIdHint?: string;
  targetScenario?: string;
  appName: string;
  appId: string;
  processId?: number;
  windowTitle?: string;
  probeEntry: "panel" | "notepad_harness" | "session";
  insertMethod: "direct" | "clipboard_paste" | "copied_only" | "unknown";
  result: "pass" | "fail" | "manual_paste";
  notes?: string;
};

export class AppVerificationLog {
  constructor(private readonly filePath: string) {}

  async append(record: AppVerificationRecord): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    await appendFile(
      this.filePath,
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        ...record
      })}\n`,
      "utf8"
    );
  }
}
