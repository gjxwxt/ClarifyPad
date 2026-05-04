# 05. 技术可行性与架构建议

## 1. 技术目标

v0.1 要实现的不是完整输入法，而是：

> 全局快捷键唤起一个桌面浮层，用户输入后调用 AI，结果插入当前输入框，并保存确认历史。

这条链路技术可行，但跨 App 稳定性是主要难点。

## 2. 推荐架构

```
Desktop Client
  ├─ Global Hotkey Manager
  ├─ Floating Window Manager
  ├─ Text Input / Result UI
  ├─ Insert Engine
  ├─ Local History Store
  ├─ Privacy Guard
  └─ AI Orchestrator
        ├─ Prompt Templates
        ├─ Cloud LLM Provider
        ├─ Local LLM Provider
        └─ Output Parser
```

## 3. 客户端选型

### 方案 A：Swift + AppKit（推荐首版）

优点：
- macOS 权限、窗口、辅助功能集成最好；
- 浮层体验更自然；
- 插入、剪贴板、快捷键更稳定。

缺点：
- 跨平台复用弱；
- 团队需要 macOS 原生开发能力。

适合：认真做 macOS MVP。

### 方案 B：Tauri

优点：
- 体积小；
- 前端开发体验好；
- 后续跨平台较容易。

缺点：
- 系统级能力需要写 Rust/Swift/Objective-C 插件；
- 早期调试复杂度高。

适合：想兼顾跨平台但仍重视体积。

### 方案 C：Electron

优点：
- 开发快；
- 前端生态成熟；
- 跨平台方便。

缺点：
- 体积大；
- 系统级权限体验一般；
- 对一个输入增强工具来说可能显得重。

适合：快速 Demo，不建议长期首选。

## 4. 插入文本实现

### 优先级 1：Accessibility API

通过辅助功能获取当前焦点控件并插入文本。体验最好，但不同 App 兼容性不一。

### 优先级 2：剪贴板 + 模拟粘贴

流程：
1. 保存当前剪贴板；
2. 将结果写入剪贴板；
3. 模拟 `Cmd + V`；
4. 延迟恢复原剪贴板。

优点：兼容性强。  
缺点：可能影响用户剪贴板；需要处理失败和隐私提示。

### 优先级 3：只复制

当插入失败时，复制结果并提示用户手动粘贴。

## 5. 浮层定位

理想：定位在当前光标附近。  
实际：很多 App 不暴露 caret 坐标。

策略：
1. 能获取 caret bounds 时，显示在光标旁；
2. 获取不到时，显示在当前窗口中心；
3. 再失败时，显示在屏幕中心；
4. 允许用户固定浮层位置。

## 6. 隐私与安全

### 6.1 默认原则

- 不做全局键盘记录；
- 只有用户主动唤起后才读取输入；
- 未确认插入不保存；
- 默认不读取屏幕；
- 明示模型调用；
- 历史本地加密；
- 支持一键删除。

### 6.2 黑名单 App

内置黑名单：
- 1Password / Bitwarden / iCloud Keychain；
- 银行、证券、钱包类 App；
- 浏览器隐私模式可提示关闭保存；
- 企业用户可配置更多黑名单。

### 6.3 敏感内容检测

本地正则检测：
- 身份证、银行卡、手机号；
- API Key、Token；
- 密码样式；
- 私钥片段。

检测到后：
- 提示是否继续；
- 可默认切换到本地模型；
- 不保存历史。

## 7. AI 编排

### 7.1 模型选择

v0.1 建议支持：
- OpenAI-compatible API；
- Anthropic；
- Gemini；
- 本地 Ollama/OpenAI-compatible endpoint。

产品层面不绑定单一模型，允许用户自带 Key 或使用官方额度。

### 7.2 Prompt 策略

不要让用户每次都写复杂 prompt。系统根据模式组织 prompt：

输入：
- 原始内容；
- 当前模式；
- 目标 App；
- 用户偏好；
- 历史风格摘要（v0.2）；
- 输出 JSON schema。

输出：
- 场景判断；
- 多版本文本；
- 缺口提醒；
- 标签。

### 7.3 延迟优化

- 请求开始时立即展示 skeleton；
- 流式输出；
- 短文本用小模型；
- 常见模式 prompt 缓存；
- 历史风格摘要定期离线更新；
- 失败时降级到规则模板。

## 8. 本地数据

推荐 SQLite + SQLCipher 或系统 Keychain 加密 key。

表：
- history_items
- user_preferences
- prompt_templates
- app_rules
- model_configs

## 9. 兼容性测试清单

v0.1 优先测试：
- 飞书
- 微信
- Slack
- Chrome / Safari
- Gmail / Outlook Web
- Notion
- Linear / Jira
- VS Code / Cursor
- Apple Mail
- Notes

每个 App 测：
- 快捷键是否冲突；
- 浮层是否正常；
- 插入是否成功；
- 换行/提交行为是否受影响；
- 中文输入法状态是否正常。

## 10. 技术风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 光标定位失败 | 浮层体验下降 | 提供窗口中心/固定位置 fallback |
| 插入失败 | 核心链路断裂 | Accessibility + 剪贴板 + 复制三层 fallback |
| 权限吓退用户 | 激活下降 | 首次使用时解释用途，分阶段申请权限 |
| 模型延迟高 | 用户放弃 | 流式输出、本地模板、缓存 |
| 隐私担忧 | 无法进入企业 | 本地优先、黑名单、透明模型调用 |
| 大厂功能覆盖 | 产品被替代 | 聚焦任务化、缺口提醒、历史记忆 |
