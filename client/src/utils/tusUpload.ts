import * as tus from "tus-js-client";

export default async function tusUpload(
  file: File,
  endpoint: string,
  onProgressFunc?: (percentage: number) => void,
  abortSignal?: AbortSignal,
  options?: {
    maxDurationSeconds?: number;
    expiry?: Date;
  }
): Promise<string | null> {
  let mediaId: string | null = null;

  const userOptions = options || {};
  const defaultExpiry = new Date();
  defaultExpiry.setHours(defaultExpiry.getHours() + 1); // Set default expiry to 1 hour from now

  return new Promise((resolve, reject) => {
    const options: tus.UploadOptions = {
      endpoint,
      /**
       * https://developers.cloudflare.com/stream/uploading-videos/upload-video-file/#resumable-uploads-with-tus-for-large-files
       * Important: Cloudflare Stream requires a minimum chunk size of 5,242,880 bytes when using TUS, unless the entire file is less than this amount.
       * We recommend increasing the chunk size to 52,428,800 bytes for better performance when the client connection is expected to be reliable.
       * Maximum chunk size can be 209,715,200 bytes.
       */
      chunkSize: 5242880,
      retryDelays: [0, 3000],
      metadata: {
        name: file.name,
        maxDurationSeconds:
          userOptions?.maxDurationSeconds?.toString() || "1800", // Fall back to 30 minutes
        expiry:
          userOptions?.expiry?.toISOString() || defaultExpiry.toISOString(),
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        const parsed = parseFloat(percentage);
        if (onProgressFunc) {
          onProgressFunc(parsed);
        }
      },
      onError: (error) => {
        console.error("Video upload failed with error: ", error);
        reject("Video upload failed");
      },
      // This happens after the initial request to get the upload URL
      onAfterResponse: (req, res) => {
        const mediaIdHeader = res.getHeader("Stream-Media-Id");
        if (!mediaIdHeader) reject("No media id found in response header");
        mediaId = mediaIdHeader ?? null;
      },
      // This happens after the upload is actually finished
      onSuccess: () => {
        resolve(mediaId);
      },
    };

    const upload = new tus.Upload(file, options);

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        upload.abort();
        reject("Upload aborted");
      });
    }

    upload.start();
  });
}
