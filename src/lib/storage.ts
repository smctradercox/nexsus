import "server-only";
import { v2 as cloudinary } from "cloudinary";

function getStorage() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary storage is not configured");
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return cloudinary;
}

function publicId(key: string) {
  return key.replace(/\.(?:png|jpg|jpeg)$/i, "");
}

export async function storeChartImage(key: string, bytes: Buffer, contentType: string) {
  const storage = getStorage();
  await new Promise<void>((resolve, reject) => {
    const upload = storage.uploader.upload_stream({
      public_id: publicId(key),
      resource_type: "image",
      type: "authenticated",
      format: contentType === "image/png" ? "png" : "jpg",
      overwrite: true,
    }, (error) => error ? reject(error) : resolve());
    upload.end(bytes);
  });
}

export async function removeChartImage(key: string) {
  const storage = getStorage();
  await storage.uploader.destroy(publicId(key), { resource_type: "image", type: "authenticated", invalidate: true });
}

export async function signChartImage(key: string) {
  const storage = getStorage();
  return storage.url(publicId(key), {
    secure: true,
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    expires_at: Math.floor(Date.now() / 1000) + 60,
  });
}