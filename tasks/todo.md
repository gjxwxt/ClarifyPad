# Current Todo

## Current Phase

- 当前处于项目初始化完成后的 `v0.0` 技术探针规划阶段。

## Next Steps

- 定义 `PlatformBridge` 的最小跨平台接口。
- 先实现 Windows `v0.0` 技术探针闭环：
  - 全局快捷键唤起
  - 浮层显示
  - 输入确认
  - 插回原输入框
  - fallback 与埋点
- Windows 最小链路跑通后，按同接口做 macOS `v0.0` 探针。
- 两端插入链路都验证后，再进入 `v0.1` AI 最小闭环。

## Open Questions

- `v0.0` 的桌面壳先用什么技术栈最利于快速探针：原生、Tauri，还是更轻的临时方案。
- 输入浮层 UI 是否需要跨平台共享，还是只共享核心状态与 schema。
- Windows 第一批兼容性测试 App 清单是否需要先固定到 6-8 个。
