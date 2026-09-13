// src/services/cloudinary.service.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ يرفع صورة من الذاكرة (Buffer، عبر multer memoryStorage) مباشرة لـ Cloudinary
// دون الحاجة لحفظها مؤقتاً على قرص الخادم (غير موثوق على Railway أصلاً)
export function uploadAvatar(fileBuffer, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "sgms-avatars",
        public_id: publicId,
        overwrite: true,
        // ✅ قص وضغط تلقائي: صورة مربعة 400×400، تُركِّز على الوجه إن وُجد
        transformation: [
          { width: 400, height: 400, crop: "fill", gravity: "face" },
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
}
