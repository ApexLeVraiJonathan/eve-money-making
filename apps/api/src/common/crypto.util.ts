import crypto from 'node:crypto';

/**
 * AES-GCM encryption helper for sensitive tokens.
 *
 * Learning notes:
 * - AES-GCM provides confidentiality + integrity (via auth tag).
 * - We derive a 32-byte key from ENCRYPTION_KEY using a KDF (scrypt).
 * - The output format is base64(iv|tag|ciphertext) for storage.
 */
export class CryptoUtil {
  private static cachedKey: Buffer | null = null;

  private static async getKey(): Promise<Buffer> {
    if (this.cachedKey) return this.cachedKey;
    const secret = process.env.ENCRYPTION_KEY ?? '';
    if (!secret) throw new Error('ENCRYPTION_KEY not set');
    // scrypt: deterministic key from secret (salted with a constant app label)
    const salt = 'eve-money-making:v1';
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(secret, salt, 32, (err, derived) => {
        if (err) reject(err);
        else resolve(derived);
      });
    });
    this.cachedKey = key;
    return key;
  }

  static async encrypt(plaintext: string): Promise<string> {
    const key = await this.getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  static async decrypt(payloadB64: string): Promise<string> {
    const key = await this.getKey();
    const buf = Buffer.from(payloadB64, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString('utf8');
  }
}
