# Knowledge

## Summary

- 产品定位：发送前 AI 确认层，而不是普通改写工具或输入法。
- 当前版本策略：`v0.0` 无 AI 技术探针，`v0.1` 才接最小 AI 闭环。
- 平台策略：Windows-first 验证，但采用跨平台核心 + 原生适配层。
- 差异化重点：`missing_info`、`follow_up_questions`、`risk_flags` 不应弱化为附属功能。

## Product Direction

- 一句话：在任何输入框里按下快捷键，把粗糙想法整理成可发送、可执行、可追踪的表达，并一键插回原位置。
- 核心链路：快捷键唤起 -> 浮层输入 -> 生成版本与缺口提醒 -> 用户确认 -> 插回当前输入框。
- 当前不优先做：
  - 浏览器插件优先路线
  - 复杂上下文读取
  - 深度个性化记忆
  - 全量屏幕感知

## Architecture Decisions

- 产品层共享：
  - AI schema
  - Prompt 模板
  - 模式与状态机
  - 历史数据结构
  - 设置结构
  - 埋点事件定义
  - 插入结果与错误码定义
- 平台层分别实现：
  - 全局快捷键
  - 当前 App / 焦点识别
  - 光标或元素定位
  - 文本插入
  - 剪贴板 fallback
  - 权限与敏感场景处理

## Output Contract Direction

- AI 输出应以结构化 JSON 为主。
- 至少保留这些高价值字段：
  - `recommended_version`
  - `short_version`
  - `missing_info`
  - `follow_up_questions`
  - `risk_flags`

## Validation Priorities

- 第一优先验证：插入成功率、fallback 质量、误发送风险、权限摩擦。
- 第二优先验证：用户是否愿意为了更清楚的表达多做一次轻量确认。
