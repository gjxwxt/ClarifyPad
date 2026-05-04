export type InsertVerificationResult = {
  success: boolean;
  expectedNormalized: string;
  actualNormalized: string;
};

export function normalizeCapturedText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\u0000+$/g, "");
}

export function verifyInsertedText(
  expected: string,
  captured: string
): InsertVerificationResult {
  const expectedNormalized = normalizeCapturedText(expected);
  const actualNormalized = normalizeCapturedText(captured);

  return {
    success: expectedNormalized === actualNormalized,
    expectedNormalized,
    actualNormalized
  };
}
