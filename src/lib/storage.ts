import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './security';
const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || 'uploads');
const location = (key: string) => {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new HttpError(400, 'invalidInput');
  return path.join(/*turbopackIgnore: true*/ root(), key);
};
export function receiptMime(bytes: Buffer) {
  if (bytes.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  throw new HttpError(400, 'unsupportedFile');
}
export async function storeReceipt(bytes: Buffer) {
  if (bytes.length > 5_000_000) throw new HttpError(413, 'fileTooLarge');
  const mime = receiptMime(bytes);
  const storageKey = randomUUID();
  await mkdir(/*turbopackIgnore: true*/ root(), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ location(storageKey), bytes, {
    flag: 'wx',
  });
  return { storageKey, mime, size: bytes.length };
}
export const loadReceipt = (key: string) => readFile(/*turbopackIgnore: true*/ location(key));
export const removeReceipt = (key: string) =>
  unlink(/*turbopackIgnore: true*/ location(key)).catch(() => {});
