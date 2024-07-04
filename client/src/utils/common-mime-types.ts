const COMMON_MIME_TYPES: {
  title: string;
  anySubType: string;
  mimeTypes: {
    name: string;
    value: string;
  }[];
}[] = [
  {
    title: "Image",
    anySubType: "image/*",
    mimeTypes: [
      {
        name: "JPEG",
        value: "image/jpeg",
      },
      {
        name: "PNG",
        value: "image/png",
      },
      {
        name: "GIF",
        value: "image/gif",
      },
      {
        name: "TIFF",
        value: "image/tiff",
      },
      {
        name: "SVG",
        value: "image/svg+xml",
      },
    ],
  },
  {
    title: "Video",
    anySubType: "video/*",
    mimeTypes: [
      {
        name: "AVI",
        value: "video/x-msvideo",
      },
      {
        name: "FLV",
        value: "video/x-flv",
      },
      {
        name: "QuickTime (MOV)",
        value: "video/quicktime",
      },
      {
        name: "MPEG",
        value: "video/mpeg",
      },
      {
        name: "WMV",
        value: "video/x-ms-wmv",
      },
      {
        name: "MP4",
        value: "video/mp4",
      },
      {
        name: "OGG (Video)",
        value: "video/ogg",
      },
      {
        name: "WEBM",
        value: "video/webm",
      },
    ],
  },
  {
    title: "Audio",
    anySubType: "audio/*",
    mimeTypes: [
      {
        name: "MP3",
        value: "audio/mpeg",
      },
      {
        name: "OGG (Audio)",
        value: "audio/ogg",
      },
      {
        name: "WAV",
        value: "audio/wav",
      },
    ],
  },
  {
    title: "Document",
    anySubType: "application/*",
    mimeTypes: [
      {
        name: "PDF",
        value: "application/pdf",
      },
      {
        name: "Word (DOC)",
        value: "application/msword",
      },
      {
        name: "Word (DOCX)",
        value:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      {
        name: "Excel (XLS)",
        value: "application/vnd.ms-excel",
      },
      {
        name: "Excel (XLSX)",
        value:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      {
        name: "PowerPoint (PPT)",
        value: "application/vnd.ms-powerpoint",
      },
      {
        name: "PowerPoint (PPTX)",
        value:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      },
      {
        name: "JSON",
        value: "application/json",
      },
      {
        name: "XML",
        value: "application/xml",
      },
      {
        name: "CSV",
        value: "text/csv",
      },
      {
        name: "Other/Unknown",
        value: "application/octet-stream",
      },
    ],
  },
  {
    title: "Text",
    anySubType: "text/*",
    mimeTypes: [
      {
        name: "Plain Text",
        value: "text/plain",
      },
      {
        name: "HTML",
        value: "text/html",
      },
      {
        name: "CSS",
        value: "text/css",
      },
      {
        name: "JavaScript",
        value: "text/javascript",
      },
      {
        name: "TypeScript",
        value: "text/typescript",
      },
      {
        name: "LaTeX",
        value: "text/x-tex",
      },
    ],
  },
];

export function getPrettyNameFromMimeType(mimeType?: string): string {
  if (!mimeType) return "Unknown";
  const found = COMMON_MIME_TYPES.find((cmt) => {
    const foundMT = cmt.mimeTypes.find((mt) => mt.value === mimeType);
    return foundMT !== undefined;
  });
  if (found) {
    const foundMT = found.mimeTypes.find((mt) => mt.value === mimeType);
    if (foundMT) {
      return foundMT.name;
    }
  }

  // If a specific subtype is not found, try to find a generic one (i.e. video/* => Video)
  if(!found) {
    const generic = COMMON_MIME_TYPES.find((cmt) => cmt.anySubType === mimeType);
    if (generic) {
      return generic.title
    }
  }

  return mimeType;
}

export const VIDEO_MIME_TYPES = (): string[] => {
  const found = COMMON_MIME_TYPES.find((cmt) => cmt.title === "Video");
  if (found) {
    return found.mimeTypes.map((mt) => mt.value);
  }
  return [];
};

export default COMMON_MIME_TYPES;
