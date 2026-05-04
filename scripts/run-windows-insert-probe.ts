import { WindowsPowerShellBridge } from "../packages/platform-windows/src/bridge.js";
import { createProbeOutput } from "../packages/shared/src/index.js";

async function main(): Promise<void> {
  const input = process.argv.slice(2).join(" ").trim() || "这个需求请尽快处理";
  const bridge = new WindowsPowerShellBridge({
    blacklistedAppIds: ["1password", "bitwarden"]
  });

  const activeApp = await bridge.getActiveApp();
  const focusContext = await bridge.getFocusContext();

  if (focusContext.isPasswordField) {
    console.error("当前聚焦输入框是密码框，已阻止插入探针。");
    process.exitCode = 1;
    return;
  }

  const output = createProbeOutput(input);

  console.log(
    JSON.stringify(
      {
        phase: "before_insert",
        activeApp,
        focusContext,
        output
      },
      null,
      2
    )
  );

  console.log("3 秒后执行 clipboard paste 探针，请先将焦点切到目标输入框。");
  await delay(3000);

  const result = await bridge.insertText({
    text: output,
    mode: "insert_at_caret"
  });

  console.log(
    JSON.stringify(
      {
        phase: "after_insert",
        result
      },
      null,
      2
    )
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
