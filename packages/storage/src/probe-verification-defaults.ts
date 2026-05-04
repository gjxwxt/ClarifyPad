import type { ProbeExecutionResult } from "../../shared/src/index.js";
import type { AppVerificationRecord } from "./app-verification-log.js";

export type VerificationDefaults = Pick<
  AppVerificationRecord,
  "result" | "insertMethod"
>;

export function deriveVerificationDefaults(
  execution: ProbeExecutionResult
): VerificationDefaults {
  if (execution.status === "completed") {
    return {
      result: "pass",
      insertMethod: execution.insertResult.method
    };
  }

  if (execution.status === "manual_paste_required") {
    return {
      result: "manual_paste",
      insertMethod: execution.insertResult.method
    };
  }

  return {
    result: "fail",
    insertMethod: execution.insertResult.method
  };
}
