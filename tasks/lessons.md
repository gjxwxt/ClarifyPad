# Lessons

## Typed Entries

### trade-off

- Windows 先做技术探针是为了更快拿到系统链路反馈，但不能把产品核心逻辑写死在 Windows API 上。

### trade-off

- `v0.0` 先证明唤起与插入链路，不先证明 AI 效果；否则系统风险和模型风险会混在一起，难以判断问题来源。

### gotcha

- 不要把浏览器插件当成主验证路径。它无法代表“跨应用输入中间层”的核心体验。

### gotcha

- Windows WinForms 面板的 UIAutomation 控件识别在不同环境下不稳定；自动化 smoke 优先走“面板预填 + 自动确认”通道，避免把探针结果误判成 UIA 噪声。
