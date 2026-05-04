import { describe, expect, it } from "vitest";

import {
  normalizeCapturedText,
  verifyInsertedText
} from "../packages/platform-windows/src/verification.js";

describe("normalizeCapturedText", () => {
  it("normalizes CRLF to LF and trims trailing nulls", () => {
    expect(normalizeCapturedText("line1\r\nline2\u0000")).toBe("line1\nline2");
  });
});

describe("verifyInsertedText", () => {
  it("treats normalized equivalent text as a match", () => {
    expect(verifyInsertedText("第一行\n第二行", "第一行\r\n第二行")).toEqual({
      success: true,
      expectedNormalized: "第一行\n第二行",
      actualNormalized: "第一行\n第二行"
    });
  });

  it("returns mismatch details when the captured text differs", () => {
    expect(verifyInsertedText("[整理后] 内容A", "[整理后] 内容B")).toEqual({
      success: false,
      expectedNormalized: "[整理后] 内容A",
      actualNormalized: "[整理后] 内容B"
    });
  });
});
