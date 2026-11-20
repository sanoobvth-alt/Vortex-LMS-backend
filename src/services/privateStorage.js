import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../utils/ApiError.js';

const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || '.private-uploads');
const storageKeyPattern = /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/i;

export async function storePrivateUpload(file, allowedMimeTypes) {
  if ((process.env.UPLOAD_PROVIDER || 'local') !== 'local') throw new ApiError(503, 'Private file storage is not configured', 'UPLOAD_UNAVAILABLE');
  const detected = await inspectUpload(file, allowedMimeTypes);
  const storageKey = `${randomUUID()}.${detected.ext === 'jpeg' ? 'jpg' : detected.ext}`;
  if (!storageKeyPattern.test(storageKey)) throw new ApiError(500, 'Could not allocate private storage key', 'STORAGE_ERROR');
  await mkdir(root, { recursive: true });
  const filePath = path.join(root, storageKey);
  await writeFile(filePath, file.buffer, { flag: 'wx' });
  return { storageKey, mimeType: detected.mime, fileSizeBytes: file.buffer.byteLength, filePath };
}

export async function inspectUpload(file, allowedMimeTypes) {
  if (!file?.buffer?.length) throw new ApiError(400, 'A file is required', 'FILE_REQUIRED');
  if (file.buffer.byteLength > Number(process.env.UPLOAD_MAX_BYTES || 5_242_880) || file.size !== file.buffer.byteLength) throw new ApiError(413, 'File exceeds the 5 MB limit', 'FILE_TOO_LARGE');
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !allowedMimeTypes.includes(detected.mime) || file.mimetype !== detected.mime) {
    throw new ApiError(400, 'File type or file signature is not allowed', 'INVALID_FILE_TYPE');
  }
  return detected;
}

export async function readPrivateUpload(storageKey) {
  if (!storageKeyPattern.test(storageKey)) throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  const filePath = path.resolve(root, storageKey);
  if (path.dirname(filePath) !== root) throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
  try { return await readFile(filePath); }
  catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'File not found', 'FILE_NOT_FOUND');
    throw error;
  }
}

export async function deletePrivateUpload(storageKey) {
  if (!storageKeyPattern.test(storageKey)) return;
  try { await unlink(path.resolve(root, storageKey)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
