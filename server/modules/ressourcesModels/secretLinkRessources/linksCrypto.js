import {createCipheriv, createDecipheriv, createHash, randomBytes} from 'node:crypto';

const MASTER_KEY = Buffer.from(String(process.env.MASTER_KEY_V1), 'hex'); // 32 bytes
const KEY_VERSION = Number(process.env.KEY_VERSION || 1);

export function randomTokenBase64Url(bytes = 32) {
    return randomBytes(bytes).toString('base64url'); // ~43 chars
}
export function sha256Hex(input) {
    return createHash('sha256').update(input).digest('hex');
}
export function buildAAD(params) {
    const keys = Object.keys(params).sort();
    return Buffer.from(keys.map(k => `${k}:${params[k]}`).join('|'), 'utf8');
}
export function encryptAesGcm(plaintextBuf, aadBuf) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', MASTER_KEY, iv, { authTagLength: 16 });
    cipher.setAAD(aadBuf, { plaintextLength: plaintextBuf.length });
    const enc = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { iv, ciphertext: Buffer.concat([enc, tag]), keyVersion: KEY_VERSION };
}
export function decryptAesGcm(ciphertextWithTag, iv, aadBuf) {
    const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const data = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', MASTER_KEY, iv, { authTagLength: 16 });
    decipher.setAAD(aadBuf, { plaintextLength: data.length });
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}
export const cryptoCfg = { keyVersion: KEY_VERSION, baseUrl: process.env.BASE_URL || 'http://localhost:3000' };
