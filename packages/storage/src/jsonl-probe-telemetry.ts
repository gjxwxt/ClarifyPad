import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  ProbeTelemetry,
  ProbeTelemetryEvent,
  ProbeTelemetryPayload
} from "../../shared/src/index.js";

type ProbeTelemetryRecord = {
  timestamp: string;
  event: ProbeTelemetryEvent;
  payload: ProbeTelemetryPayload;
};

export class JsonlProbeTelemetry implements ProbeTelemetry {
  constructor(private readonly filePath: string) {}

  async record(event: ProbeTelemetryEvent, payload: ProbeTelemetryPayload): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    const record: ProbeTelemetryRecord = {
      timestamp: new Date().toISOString(),
      event,
      payload
    };

    await appendFile(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}
