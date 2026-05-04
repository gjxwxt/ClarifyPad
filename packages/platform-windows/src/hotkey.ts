export type ParsedWindowsHotkey = {
  modifiers: number;
  virtualKey: number;
};

export function parseWindowsHotkey(shortcut: string): ParsedWindowsHotkey | null {
  const segments = shortcut
    .split("+")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (segments.length === 0) {
    return null;
  }

  let modifiers = 0;
  let keyToken: string | null = null;

  for (const segment of segments) {
    if (segment === "ctrl" || segment === "control") {
      modifiers |= 0x0002;
      continue;
    }
    if (segment === "shift") {
      modifiers |= 0x0004;
      continue;
    }
    if (segment === "alt") {
      modifiers |= 0x0001;
      continue;
    }
    if (segment === "win" || segment === "meta") {
      modifiers |= 0x0008;
      continue;
    }

    if (keyToken) {
      return null;
    }
    keyToken = segment;
  }

  if (!keyToken) {
    return null;
  }

  const virtualKey = parseVirtualKeyCode(keyToken);
  if (virtualKey === null) {
    return null;
  }

  return {
    modifiers,
    virtualKey
  };
}

function parseVirtualKeyCode(token: string): number | null {
  if (token.length === 1) {
    const charCode = token.toUpperCase().charCodeAt(0);
    const isLetter = charCode >= 65 && charCode <= 90;
    const isDigit = charCode >= 48 && charCode <= 57;
    if (isLetter || isDigit) {
      return charCode;
    }
  }

  if (token === "space" || token === "spacebar") {
    return 0x20;
  }
  if (token === "enter" || token === "return") {
    return 0x0d;
  }
  if (token === "tab") {
    return 0x09;
  }
  if (token === "esc" || token === "escape") {
    return 0x1b;
  }

  const functionKeyMatch = /^f([1-9]|1[0-9]|2[0-4])$/.exec(token);
  if (functionKeyMatch) {
    const keyNumber = Number.parseInt(functionKeyMatch[1], 10);
    return 0x70 + keyNumber - 1;
  }

  return null;
}
