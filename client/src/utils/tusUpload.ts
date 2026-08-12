import * as tus from "tus-js-client";

/**
 * Uploads a file directly to a pre-authorized tus upload URL.
 *
 * The URL must already have been created by the server (see
 * `api.createStreamUploadURL`), which is also where upload metadata such as
 * `maxDurationSeconds` is set. Because `uploadUrl` is supplied, tus skips its
 * creation request entirely and talks only to the upload host — no request in
 * this flow reaches the Conductor API.
 *
 * @param file - The file to upload.
 * @param uploadUrl - The pre-authorized upload URL returned by the server.
 * @param onProgressFunc - Optional callback receiving upload percentage.
 * @param abortSignal - Optional signal used to cancel the upload.
 */
export default async function tusUpload(
  file: File,
  uploadUrl: string,
  onProgressFunc?: (percentage: number) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const options: tus.UploadOptions = {
      uploadUrl,
      /**
       * https://developers.cloudflare.com/stream/uploading-videos/upload-video-file/#resumable-uploads-with-tus-for-large-files
       * Important: Cloudflare Stream requires a minimum chunk size of 5,242,880 bytes when using TUS, unless the entire file is less than this amount.
       * We recommend increasing the chunk size to 52,428,800 bytes for better performance when the client connection is expected to be reliable.
       * Maximum chunk size can be 209,715,200 bytes.
       */
      chunkSize: 5242880,
      retryDelays: [0, 3000],
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        const parsed = parseFloat(percentage);
        if (onProgressFunc) {
          onProgressFunc(parsed);
        }
      },
      onError: (error) => {
        console.error("Video upload failed with error: ", error);
        reject(new Error("Video upload failed"));
      },
      onSuccess: () => {
        resolve();
      },
    };

    const upload = new tus.Upload(file, options);

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        upload.abort();
        // Matches the message callers check for to silently ignore cancellation.
        reject(new Error("canceled"));
      });
    }

    upload.start();
  });
}
