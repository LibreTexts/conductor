import Excel from "exceljs";
import { debugError } from "../debug.js";
export function createStandardWorkBook(): Excel.Workbook | null {
  try {
    const workbook = new Excel.Workbook();
    workbook.creator = "LibreTexts Conductor Platform";
    workbook.lastModifiedBy = "LibreTexts Conductor Platform";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();
    return workbook;
  } catch (error) {
    debugError(error);
    return null;
  }
}

export function generateWorkSheetColumnDefinitions(
  columns: string[]
): { header: string; key: string; width: number }[] {
  return columns.map((column) => {
    return {
      header: column,
      key: column.toLowerCase(),
      width: 30,
    };
  });
}

/**
 * Attemps to get a file extension from a MIME type. Returns an empty string if not found.
 * @param mimeType - the MIME type to get the extension for
 * @returns - the file extension (e.g. "pdf" for "application/pdf") or an empty string if not found
 */
export function getFileExtensionFromMimeType(mimeType: string): string {
  const found = COMMON_MIME_TYPES.find((cmt) => {
    const foundMT = cmt.mimeTypes.find((mt) => mt.value.toLowerCase() === mimeType.toLowerCase());
    return foundMT !== undefined;
  });
  if (found) {
    const foundMT = found.mimeTypes.find((mt) => mt.value === mimeType);
    if (foundMT && foundMT.extensions) {
      return foundMT.extensions[0];
    }
  }
  return "";
}

const COMMON_MIME_TYPES: {
  title: string;
  anySubType: string;
  mimeTypes: {
    name: string;
    value: string;
    extensions?: string[];
  }[];
}[] = [
  {
    title: "Image",
    anySubType: "image/*",
    mimeTypes: [
      {
        name: "JPEG",
        value: "image/jpeg",
        extensions: ["jpg", "jpeg"],
      },
      {
        name: "PNG",
        value: "image/png",
        extensions: ["png"],
      },
      {
        name: "GIF",
        value: "image/gif",
        extensions: ["gif"],
      },
      {
        name: "TIFF",
        value: "image/tiff",
        extensions: ["tiff", "tif"],
      },
      {
        name: "SVG",
        value: "image/svg+xml",
        extensions: ["svg"],
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
        extensions: ["avi"],
      },
      {
        name: "FLV",
        value: "video/x-flv",
        extensions: ["flv"],
      },
      {
        name: "QuickTime (MOV)",
        value: "video/quicktime",
        extensions: ["mov"],
      },
      {
        name: "MPEG",
        value: "video/mpeg",
        extensions: ["mpeg", "mpg"],
      },
      {
        name: "WMV",
        value: "video/x-ms-wmv",
        extensions: ["wmv"],
      },
      {
        name: "MP4",
        value: "video/mp4",
        extensions: ["mp4"],
      },
      {
        name: "OGG (Video)",
        value: "video/ogg",
        extensions: ["ogv"],
      },
      {
        name: "WEBM",
        value: "video/webm",
        extensions: ["webm"],
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
        extensions: ["mp3"],
      },
      {
        name: "OGG (Audio)",
        value: "audio/ogg",
        extensions: ["oga"],
      },
      {
        name: "WAV",
        value: "audio/wav",
        extensions: ["wav"],
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
        extensions: ["pdf"],
      },
      {
        name: "Word (DOC)",
        value: "application/msword",
        extensions: ["doc"],
      },
      {
        name: "Word (DOCX)",
        value:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extensions: ["docx"],
      },
      {
        name: "Excel (XLS)",
        value: "application/vnd.ms-excel",
        extensions: ["xls"],
      },
      {
        name: "Excel (XLSX)",
        value:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          extensions: ["xlsx"],
      },
      {
        name: "PowerPoint (PPT)",
        value: "application/vnd.ms-powerpoint",
        extensions: ["ppt"],
      },
      {
        name: "PowerPoint (PPTX)",
        value:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        extensions: ["pptx"],
      },
      {
        name: "JSON",
        value: "application/json",
        extensions: ["json"],
      },
      {
        name: "XML",
        value: "application/xml",
        extensions: ["xml"],
      },
      {
        name: "CSV",
        value: "text/csv",
        extensions: ["csv"],
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
        extensions: ["txt"],
      },
      {
        name: "HTML",
        value: "text/html",
        extensions: ["html", "htm"],
      },
      {
        name: "CSS",
        value: "text/css",
        extensions: ["css"],
      },
      {
        name: "JavaScript",
        value: "text/javascript",
        extensions: ["js"],
      },
      {
        name: "TypeScript",
        value: "text/typescript",
        extensions: ["ts"],
      },
      {
        name: "LaTeX",
        value: "text/x-tex",
        extensions: ["tex"],
      },
    ],
  },
];