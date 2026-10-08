import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, auth } from "./config.ts";
import { isAdminUser } from "./authContext.tsx";

export interface UploadProgressCallback {
  (percentage: number): void;
}

// Keep these in sync with storage.rules.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB after optimisation
const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // refuse absurdly large originals
const MAX_DIMENSION = 2000; // px, longest side
const RESIZE_THRESHOLD_BYTES = 400 * 1024;
const RESIZABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Phone and camera photos are often 4–10 MB, which would make the site slow for every visitor.
 * Large JPEG / PNG / WebP images are scaled down to 2000px and re-encoded as WebP before upload.
 * If anything goes wrong the original file is used unchanged.
 */
async function optimiseImage(file: File): Promise<File> {
  if (!RESIZABLE_TYPES.includes(file.type) || file.size <= RESIZE_THRESHOLD_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    // Some browsers silently fall back to PNG; only keep the result if it is really smaller WebP.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch (err) {
    console.warn("Image optimisation skipped:", err);
    return file;
  }
}

/**
 * Uploads an image to Firebase Storage under the given folder and returns its public download URL.
 * Administrators only (also enforced by storage.rules).
 */
export async function uploadChurchAsset(
  file: File,
  folder = "church_media",
  onProgress?: UploadProgressCallback
): Promise<string> {
  if (!file) {
    throw new Error("No file provided for upload.");
  }

  if (!isAdminUser(auth.currentUser)) {
    throw new Error("You do not have permission to upload images. Only the administrator can upload media.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded (JPG, PNG, WebP, GIF or SVG).");
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("This image is too large. Please choose one under 25 MB.");
  }

  const upload = await optimiseImage(file);

  if (upload.size > MAX_UPLOAD_BYTES) {
    throw new Error("This image is too large (over 5 MB). Please choose a smaller one.");
  }

  // Sanitize filename
  const cleanName = upload.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const storagePath = `${folder}/${Date.now()}_${cleanName}`;
  const fileRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(fileRef, upload, {
      contentType: upload.type,
      // Uploaded files get a unique name, so browsers may cache them for a long time.
      cacheControl: "public, max-age=31536000, immutable",
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
        }
      },
      (error) => {
        console.error("Firebase Storage Upload Error:", error);
        let errorMsg = "The upload failed. Please try again.";
        if (error.code === "storage/unauthorized") {
          errorMsg =
            "Firebase Storage refused the upload. Check that storage.rules is deployed and that you are signed in as the administrator with a verified email.";
        } else if (error.code === "storage/bucket-not-found" || error.code === "storage/project-not-found") {
          errorMsg =
            "Firebase Storage is not set up for this project yet. Open Firebase Console → Storage → Get started.";
        } else if (error.code === "storage/quota-exceeded") {
          errorMsg = "Firebase Storage quota exceeded.";
        } else if (error.code === "storage/retry-limit-exceeded") {
          errorMsg = "The upload timed out. Please check your internet connection and try again.";
        } else if (error.code === "storage/canceled") {
          errorMsg = "The upload was cancelled.";
        }
        reject(new Error(errorMsg));
      },
      async () => {
        try {
          resolve(await getDownloadURL(uploadTask.snapshot.ref));
        } catch (urlError) {
          console.error("Could not get download URL:", urlError);
          reject(new Error("The image uploaded, but its link could not be read. Please try again."));
        }
      }
    );
  });
}
