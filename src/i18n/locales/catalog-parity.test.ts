import { describe, expect, it } from "vitest";

import en from "./en.json";
import zh from "./zh.json";

describe("locale catalog parity", () => {
  it("keeps English and Simplified Chinese keys in lock-step", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it("defines the encryption-key whitespace validation in both locales", () => {
    const english = en as Record<string, string>;
    const chinese = zh as Record<string, string>;

    expect(english["data.encryption.key.whitespace"]).toBe(
      "Encryption key must not have leading or trailing whitespace",
    );
    expect(chinese["data.encryption.key.whitespace"]).toBe(
      "加密密钥首尾不能包含空格",
    );
  });

  it("defines route, asset-detail, and encryption-key UI copy in both locales", () => {
    const english = en as Record<string, string>;
    const chinese = zh as Record<string, string>;
    const expected = {
      "common.openAssetDetails": [
        "Open {asset} details",
        "打开 {asset} 详情",
      ],
      "loading.route": ["Loading page", "正在加载页面"],
      "loading.routeDesc": ["Preparing this view.", "正在准备当前页面。"],
      "data.encryption.key.title": ["Encryption Key", "加密密钥"],
      "data.encryption.key.description": [
        "Change the application-layer key used to encrypt sensitive configuration values and chat message content. Existing encrypted data is re-encrypted when you save. Assets and transactions remain in the local SQLite database without application-layer encryption.",
        "更改用于在应用层加密敏感配置值和聊天消息正文的密钥。保存时，现有加密数据会使用新密钥重新加密。资产与交易仍以未经过应用层加密的形式存储在本地 SQLite 数据库中。",
      ],
      "data.encryption.key.newPlaceholder": [
        "New encryption key (min 8 chars)",
        "新加密密钥（至少 8 个字符）",
      ],
      "data.encryption.key.confirmPlaceholder": [
        "Confirm new encryption key",
        "确认新加密密钥",
      ],
      "data.encryption.key.update": [
        "Update Encryption Key",
        "更新加密密钥",
      ],
      "data.encryption.key.saving": ["Saving...", "保存中..."],
      "data.encryption.key.mismatch": [
        "Keys do not match or are empty",
        "密钥为空或两次输入不一致",
      ],
      "data.encryption.key.minLength": [
        "Encryption key must be at least 8 characters",
        "加密密钥至少需要 8 个字符",
      ],
      "data.encryption.key.success": [
        "Encryption key updated. Sensitive configuration and chat message content were re-encrypted; assets and transactions remain unchanged.",
        "加密密钥已更新。敏感配置与聊天消息正文已重新加密；资产和交易未受影响。",
      ],
    } satisfies Record<string, [string, string]>;

    Object.entries(expected).forEach(([key, [englishText, chineseText]]) => {
      expect(english[key]).toBe(englishText);
      expect(chinese[key]).toBe(chineseText);
    });
  });
});
