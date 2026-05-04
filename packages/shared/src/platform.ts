export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ActiveApp = {
  appName: string;
  appId: string;
  windowTitle?: string;
};

export type FocusContext = {
  hasFocusedInput: boolean;
  isPasswordField?: boolean;
  caretRect?: Rect;
  focusedElementRect?: Rect;
  fallbackReason?: string;
};

export type PermissionState = "granted" | "denied" | "not_required" | "unknown";

export type PlatformCapabilities = {
  canReadActiveApp: boolean;
  canDetectFocus: boolean;
  canLocateCaret: boolean;
  canDirectInsert: boolean;
  canClipboardPasteFallback: boolean;
};

export type InsertMode = "insert_at_caret" | "replace_selection" | "paste_fallback";
export type InsertMethod = "direct" | "clipboard_paste" | "copied_only";

export type InsertRequest = {
  text: string;
  mode: InsertMode;
};

export type InsertResult = {
  success: boolean;
  method: InsertMethod;
  manualPasteRequired: boolean;
  errorCode?: string;
};

export interface PlatformBridge {
  registerGlobalHotkey(shortcut: string): Promise<boolean>;
  getActiveApp(): Promise<ActiveApp>;
  getFocusContext(): Promise<FocusContext>;
  showFloatingPanel(anchor?: Rect): Promise<void>;
  insertText(request: InsertRequest): Promise<InsertResult>;
  copyText(text: string): Promise<boolean>;
  isAppBlacklisted(appId: string): Promise<boolean>;
  getPermissionStatus(): Promise<PermissionState>;
  getPlatformCapabilities(): Promise<PlatformCapabilities>;
}
