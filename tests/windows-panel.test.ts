import { describe, expect, it } from "vitest";

import {
  parseProbePanelOutput,
  type ProbePanelResult
} from "../packages/platform-windows/src/panel.js";

describe("parseProbePanelOutput", () => {
  it("parses confirm output and trims only validation, not payload content", () => {
    const parsed = parseProbePanelOutput(
      JSON.stringify({
        action: "confirm",
        rawInput: "  请尽快同步这个需求  "
      })
    );

    expect(parsed).toEqual<ProbePanelResult>({
      action: "confirm",
      rawInput: "  请尽快同步这个需求  "
    });
  });

  it("parses cancel output", () => {
    expect(parseProbePanelOutput('{"action":"cancel"}')).toEqual({
      action: "cancel"
    });
  });

  it("rejects confirm output without meaningful content", () => {
    expect(() =>
      parseProbePanelOutput(
        JSON.stringify({
          action: "confirm",
          rawInput: "   "
        })
      )
    ).toThrowError("Probe panel confirm action requires non-empty rawInput.");
  });

  it("rejects malformed output", () => {
    expect(() => parseProbePanelOutput("not-json")).toThrowError(
      "Probe panel returned invalid JSON."
    );
  });
});
