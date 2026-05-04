export type WindowsTargetApp = {
  appName: string;
  appIdHint: string;
  scenario: string;
};

export const WINDOWS_TARGET_APPS: WindowsTargetApp[] = [
  { appName: "WeChat", appIdHint: "WeChat", scenario: "IM 聊天输入框" },
  { appName: "Feishu", appIdHint: "Feishu", scenario: "协作消息输入框" },
  { appName: "Slack", appIdHint: "slack", scenario: "协作消息输入框" },
  { appName: "Chrome", appIdHint: "chrome", scenario: "Web 文本输入框" },
  { appName: "Edge", appIdHint: "msedge", scenario: "Web 文本输入框" },
  { appName: "Outlook", appIdHint: "olk", scenario: "邮件编辑框" },
  { appName: "Notion", appIdHint: "Notion", scenario: "文档编辑输入区" },
  { appName: "Cursor", appIdHint: "Cursor", scenario: "AI/编辑器输入区" },
  { appName: "VS Code", appIdHint: "Code", scenario: "编辑器输入区" },
  { appName: "ChatGPT Web", appIdHint: "chrome", scenario: "Prompt 输入框" }
];
