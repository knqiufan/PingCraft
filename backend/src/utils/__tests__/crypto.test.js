import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, maskSecret, _resetKey } from '../crypto.js';

describe('crypto utility', () => {
  describe('encrypt() / decrypt() round-trip', () => {
    it('should encrypt and decrypt back to the original value', () => {
      const original = 'sk-very-secret-api-key-12345';
      const encrypted = encrypt(original);
      expect(encrypted).not.toBe(original);
      expect(isEncrypted(encrypted)).toBe(true);
      expect(decrypt(encrypted)).toBe(original);
    });

    it('should produce enc:v1: prefixed output', () => {
      const encrypted = encrypt('hello');
      expect(encrypted).toMatch(/^enc:v1:/);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const a = encrypt('same-value');
      const b = encrypt('same-value');
      expect(a).not.toBe(b);
      expect(decrypt(a)).toBe('same-value');
      expect(decrypt(b)).toBe('same-value');
    });

    it('should handle empty string', () => {
      expect(encrypt('')).toBe('');
      expect(decrypt('')).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(encrypt(null)).toBe(null);
      expect(encrypt(undefined)).toBe(undefined);
    });

    it('should not double-encrypt already encrypted values', () => {
      const encrypted = encrypt('my-secret');
      const doubleEncrypted = encrypt(encrypted);
      expect(doubleEncrypted).toBe(encrypted);
    });
  });

  describe('decrypt() backward compatibility', () => {
    it('should return plaintext as-is when value is not encrypted', () => {
      expect(decrypt('plain-token-value')).toBe('plain-token-value');
      expect(decrypt(null)).toBe(null);
    });

    it('should return original value on malformed encrypted string', () => {
      const malformed = 'enc:v1:invalid-data';
      expect(decrypt(malformed)).toBe(malformed);
    });
  });

  describe('isEncrypted()', () => {
    it('should detect encrypted format', () => {
      expect(isEncrypted(encrypt('test'))).toBe(true);
    });

    it('should reject non-encrypted values', () => {
      expect(isEncrypted('plain-text')).toBe(false);
      expect(isEncrypted('')).toBe(false);
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe('maskSecret()', () => {
    it('should mask middle of a long secret', () => {
      const masked = maskSecret('sk-abcd1234efgh5678');
      expect(masked).toContain('****');
      expect(masked).not.toContain('abcd1234efgh5678');
      expect(masked.startsWith('sk-')).toBe(true);
    });

    it('should fully mask very short secrets', () => {
      expect(maskSecret('abc')).toBe('****');
      expect(maskSecret('ab')).toBe('****');
    });

    it('should handle encrypted input by decrypting first', () => {
      const encrypted = encrypt('sk-long-secret-key-12345');
      const masked = maskSecret(encrypted);
      expect(masked).toContain('****');
      expect(masked.startsWith('sk-')).toBe(true);
    });

    it('should handle empty/null input', () => {
      expect(maskSecret('')).toBe('');
      expect(maskSecret(null)).toBe('');
      expect(maskSecret(undefined)).toBe('');
    });
  });

  describe('different encryption keys', () => {
    const originalKey = process.env.ENCRYPTION_KEY;

    beforeEach(() => {
      _resetKey();
    });

    afterEach(() => {
      process.env.ENCRYPTION_KEY = originalKey;
      _resetKey();
    });

    it('should use hex key when provided', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      _resetKey();
      const encrypted = encrypt('test-with-hex-key');
      expect(decrypt(encrypted)).toBe('test-with-hex-key');
    });

    it('should use base64 key when provided', () => {
      // 32 bytes base64 encoded
      process.env.ENCRYPTION_KEY = Buffer.alloc(32, 0xab).toString('base64');
      _resetKey();
      const encrypted = encrypt('test-with-base64-key');
      expect(decrypt(encrypted)).toBe('test-with-base64-key');
    });

    it('should NOT decrypt data encrypted with a different key', () => {
      process.env.ENCRYPTION_KEY = 'a'.repeat(64);
      _resetKey();
      const encrypted = encrypt('secret-with-key-a');

      // 切换到另一个 key，旧密文应无法正确解密
      process.env.ENCRYPTION_KEY = 'b'.repeat(64);
      _resetKey();
      expect(decrypt(encrypted)).not.toBe('secret-with-key-a');
    });
  });
});
