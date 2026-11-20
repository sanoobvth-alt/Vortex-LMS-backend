import { v2 as cloudinary } from 'cloudinary';
import { ApiError } from '../utils/ApiError.js';

function configuredClient() {
  if (process.env.UPLOAD_PROVIDER !== 'cloudinary') {
    throw new ApiError(503, 'Cloudinary uploads are disabled. Set UPLOAD_PROVIDER=cloudinary in the backend environment.', 'UPLOAD_UNAVAILABLE');
  }
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new ApiError(503, 'Cloudinary storage is not configured. Set the three CLOUDINARY_* server environment variables.', 'CLOUDINARY_NOT_CONFIGURED');
  }
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  return cloudinary;
}

export async function uploadToCloudinary(file, { folder, resourceType = 'raw', deliveryType = 'authenticated', allowedMimeTypes }) {
  const { inspectUpload } = await import('./privateStorage.js');
  const detected = await inspectUpload(file, allowedMimeTypes);
  const client = configuredClient();
  const result = await new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({
      folder, resource_type: resourceType, type: deliveryType,
      use_filename: false, unique_filename: true, overwrite: false,
      allowed_formats: [detected.ext === 'jpeg' ? 'jpg' : detected.ext],
    }, (error, response) => error ? reject(error) : resolve(response));
    stream.end(file.buffer);
  }).catch((error) => {
    console.error('Cloudinary upload failed', { message: error?.message, http_code: error?.http_code });
    throw new ApiError(error?.http_code === 420 || error?.http_code === 429 ? 503 : 502, 'File storage upload failed', 'CLOUDINARY_UPLOAD_FAILED');
  });
  return {
    publicId: result.public_id,
    assetId: result.asset_id,
    secureUrl: result.secure_url,
    resourceType: result.resource_type,
    deliveryType: result.type,
    format: result.format,
    mimeType: detected.mime,
    fileSizeBytes: result.bytes,
    originalFileName: file.originalname.split(/[\\/]/).at(-1).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'upload',
    folder,
  };
}

export async function deleteFromCloudinary({ publicId, resourceType = 'raw', deliveryType = 'authenticated' }) {
  const client = configuredClient();
  const result = await client.uploader.destroy(publicId, { resource_type: resourceType, type: deliveryType, invalidate: true });
  if (!['ok', 'not found'].includes(result.result)) throw new ApiError(502, 'File storage deletion failed', 'CLOUDINARY_DELETE_FAILED');
  return result.result;
}

export function privateCloudinaryDownload(asset, { attachment = true } = {}) {
  const client = configuredClient();
  const url = client.utils.private_download_url(asset.publicId, asset.format, {
    resource_type: asset.resourceType, type: asset.deliveryType,
    attachment, expires_at: Math.floor(Date.now() / 1000) + 300,
  });
  return url;
}
