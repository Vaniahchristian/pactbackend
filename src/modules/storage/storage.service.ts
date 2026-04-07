import { Client as MinioClient } from 'minio';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

export const minioClient = new MinioClient({
  endPoint: env.minio.endpoint,
  port: env.minio.port,
  useSSL: env.minio.useSsl,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

export async function ensureBucketExists(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(env.minio.bucket);
    if (!exists) {
      await minioClient.makeBucket(env.minio.bucket);
      logger.info(`Created MinIO bucket: ${env.minio.bucket}`);
    }
  } catch (err) {
    logger.warn('MinIO bucket check failed — storage may not be available', { err });
  }
}

export async function uploadFile(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  folder = 'uploads'
): Promise<{ key: string; url: string; size: number }> {
  const ext = path.extname(originalName);
  const key = `${folder}/${uuidv4()}${ext}`;

  await minioClient.putObject(env.minio.bucket, key, fileBuffer, fileBuffer.length, {
    'Content-Type': mimeType,
  });

  const url = await getSignedUrl(key);
  return { key, url, size: fileBuffer.length };
}

export async function getSignedUrl(key: string, expirySeconds = 3600): Promise<string> {
  return minioClient.presignedGetObject(env.minio.bucket, key, expirySeconds);
}

export async function deleteFile(key: string): Promise<void> {
  await minioClient.removeObject(env.minio.bucket, key);
}
