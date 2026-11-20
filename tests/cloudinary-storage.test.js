import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteFromCloudinary } from '../src/services/cloudinaryStorage.js';

test('Cloudinary deletion fails with a clear configuration error when credentials are missing', async () => {
  const names = ['UPLOAD_PROVIDER', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.UPLOAD_PROVIDER = 'cloudinary';
    for (const name of names.slice(1)) delete process.env[name];
    await assert.rejects(deleteFromCloudinary({ publicId: 'test-asset' }), (error) => error.code === 'CLOUDINARY_NOT_CONFIGURED' && error.statusCode === 503);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('Cloudinary operations stay disabled unless UPLOAD_PROVIDER is explicitly set', async () => {
  const previous = process.env.UPLOAD_PROVIDER;
  try {
    delete process.env.UPLOAD_PROVIDER;
    await assert.rejects(deleteFromCloudinary({ publicId: 'test-asset' }), (error) => error.code === 'UPLOAD_UNAVAILABLE' && error.statusCode === 503);
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_PROVIDER;
    else process.env.UPLOAD_PROVIDER = previous;
  }
});
