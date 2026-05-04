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

### implementation

- 真实 App 验证日志需要同时记录“目标场景元数据”和“实际前台应用信息”；否则像 ChatGPT Web/Chrome 这类同进程场景在汇总里无法区分覆盖情况。

### implementation

- 跨平台适配层需要在非目标系统上给出明确错误码（例如 `platform_macos_unavailable_on_non_darwin`），避免把“运行环境不匹配”误诊为业务逻辑失败。

### implementation

- Windows 全局热键探针先做“可注册性验证”（注册后立即释放），可以快速验证冲突/权限问题；持续监听放到下一阶段桌面壳实现。

### implementation

- 对系统集成型产品，单独的 `doctor` 命令能显著降低排障成本：把能力探测、权限状态、前台应用和焦点探测集中输出，比逐条命令排查更高效。

### implementation

- 真实 App 批量验证时，把“执行探针”和“记录结果”合并到同一会话命令里，能明显降低遗漏率，也更容易形成可比较的数据集。
