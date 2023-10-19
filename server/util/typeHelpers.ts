import { FileInterfaceAccess } from "../models/file.js";
import { PROJECT_FILES_ACCESS_SETTINGS } from "./projectutils.js";

export const isFileInterfaceAccess = (access: string): access is FileInterfaceAccess => {
  return PROJECT_FILES_ACCESS_SETTINGS.includes(access);
}