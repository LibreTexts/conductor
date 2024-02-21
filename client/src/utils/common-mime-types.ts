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
      }
    ],
  },
  {
    title: "Video",
    anySubType: "video/*",
    mimeTypes: [
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
      }
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
    ],
  },
];

export function getPrettyNameFromMimeType(mimeType: string): string {
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
  return mimeType;
}

export default COMMON_MIME_TYPES;
