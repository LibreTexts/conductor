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
