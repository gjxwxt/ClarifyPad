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
  - 基础测试与类型检查链路

## Next Steps

- 继续实现 Windows `v0.0` 技术探针闭环：
  - 选区或光标位置探测
  - 插入与 clipboard fallback 的真实验证
  - 最小浮层交互壳
- Windows 最小链路跑通后，按同接口做 macOS `v0.0` 探针。
- 两端插入链路都验证后，再进入 `v0.1` AI 最小闭环。

## Open Questions

- `v0.0` 的桌面壳先用什么技术栈最利于快速探针：原生、Tauri，还是更轻的临时方案。
- 输入浮层 UI 是否需要跨平台共享，还是只共享核心状态与 schema。
- Windows 第一批兼容性测试 App 清单是否需要先固定到 6-8 个。
