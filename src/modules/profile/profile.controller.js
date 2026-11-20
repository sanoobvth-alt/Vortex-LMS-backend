import * as profileService from './profile.service.js';
import { storePrivateUpload, deletePrivateUpload, readPrivateUpload } from '../../services/privateStorage.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getProfile(req, res) {
  const profile = await profileService.getProfile(req.auth.userId);
  return res.json({ data: { profile } });
}

export async function updateProfile(req, res) {
  const profile = await profileService.updateProfile(req.auth.userId, req.body);
  return res.json({ data: { profile } });
}

function requireFile(req) {
  if (!req.file) throw new ApiError(400, 'A file is required in the "file" field', 'FILE_REQUIRED');
  return req.file;
}

export async function uploadPhoto(req, res) {
  const file = requireFile(req);
  const stored = await storePrivateUpload(file, ['image/jpeg', 'image/png', 'image/webp']);
  try {
    const { profile, previousStorageKey } = await profileService.updateProfilePhoto(req.auth.userId, stored.storageKey);
    if (previousStorageKey && previousStorageKey !== stored.storageKey) {
      try { await deletePrivateUpload(previousStorageKey); }
      catch { console.error('Could not clean up a replaced profile photo', { userId: req.auth.userId }); }
    }
    return res.status(201).json({ data: { profile } });
  } catch (error) {
    await deletePrivateUpload(stored.storageKey);
    throw error;
  }
}

export async function uploadDocument(req, res) {
  const file = requireFile(req);
  const safeOriginalName = file.originalname.split(/[\\/]/).at(-1).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'document';
  const stored = await storePrivateUpload(file, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  try {
    const document = await profileService.createStudentDocument(req.auth.userId, { ...req.body, originalFileName: safeOriginalName }, stored);
    return res.status(201).json({ data: { document } });
  } catch (error) {
    await deletePrivateUpload(stored.storageKey);
    throw error;
  }
}

export async function downloadPrivateFile(req, res) {
  const access = await profileService.getOwnedFile(req.auth.userId, req.params.storageKey);
  const bytes = await readPrivateUpload(req.params.storageKey);
  console.info('Private student file accessed', { userId: req.auth.userId, category: access.category });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.type(access.mimeType);
  if (access.inline) res.setHeader('Content-Disposition', 'inline');
  else res.attachment(access.fileName);
  return res.send(bytes);
}
