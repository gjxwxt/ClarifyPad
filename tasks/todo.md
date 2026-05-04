# Current Todo

## Current Phase

- 当前处于 `v0.0` 技术探针第一段实现阶段。
- 已完成：
  - 共享 `PlatformBridge` 接口与探针结果模型
  - `TechnicalProbeService` 探针编排骨架
  - Windows PowerShell 前台应用上下文探针
  - Windows UI Automation 焦点元素探针
  - 密码框阻断保护
  - Windows 手动插入探针脚本
  - 本地 JSONL telemetry 与 probe session runner
  - 受控 Notepad 宿主下的真实插入链路验证
  - 最小 Windows 探针面板与焦点恢复链路
  - 去除 `v0.0` 探针输出的 `[整理后]` 前缀
  - 真实 App 手工验证记录能力
  - 真实 App 验证结果汇总统计能力
  - Windows 目标 App 验证会话脚本（矩阵录入）
  - Windows `caretRect` 探测尝试（基于 TextPattern 选区矩形）
  - 基础测试与类型检查链路

## Next Steps

- 继续实现 Windows `v0.0` 技术探针闭环：
  - 选区或光标位置探测
  - 最小浮层交互壳
  - 扩大到更多真实 App 的插入验证
- 修正自动化 `panel -> notepad` smoke harness 的 PowerShell 对话框退出语义问题
- 修正自动化 `panel -> notepad` smoke harness 的 UIAutomation 输入框识别不稳定问题
- Windows 最小链路跑通后，按同接口做 macOS `v0.0` 探针。
- 两端插入链路都验证后，再进入 `v0.1` AI 最小闭环。

## Open Questions

- `v0.0` 的桌面壳先用什么技术栈最利于快速探针：原生、Tauri，还是更轻的临时方案。
- 输入浮层 UI 是否需要跨平台共享，还是只共享核心状态与 schema。
- Windows 第一批兼容性测试 App 清单是否需要先固定到 6-8 个。
