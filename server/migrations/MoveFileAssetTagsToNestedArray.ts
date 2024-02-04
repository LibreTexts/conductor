import { debugError } from "../debug.js";
import ProjectFile from "../models/projectfile.js";
import FileAssetTags from "../models/fileassettags.js";

/**
 * Finds all documents in FileAssetTags and moves the tags array to the matching ProjectFile document.
 */
export async function runMigration() {
  try {
    const fileAssetTags = await FileAssetTags.find();
    console.log("Found fileAssetTags: ", fileAssetTags.length);

    for (const fileAssetTag of fileAssetTags) {
      if (!fileAssetTag.tags) continue;
      const fileID = fileAssetTag.fileID;
      const projectFile = await ProjectFile.findOne({ _id: fileID });
      if (!projectFile) {
        console.log("ProjectFile not found, skipping...");
        continue;
      }

      console.log("Migrating fileAssetTag: ", fileID);
      projectFile.tags = fileAssetTag.tags;

      await projectFile.save();
    }
  } catch (e: any) {
    debugError(`Fatal error during migration: ${e.toString()}`);
  }
}
