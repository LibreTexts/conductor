import logger from "../logger.js";
import ProjectFile from "../models/projectfile.js";
import FileAssetTags from "../models/fileassettags.js";

/**
 * Finds all documents in FileAssetTags and moves the tags array to the matching ProjectFile document.
 */
export async function runMigration() {
  try {
    const fileAssetTags = await FileAssetTags.find();
    logger.info({ detail: [fileAssetTags.length] }, "Found fileAssetTags");

    for (const fileAssetTag of fileAssetTags) {
      if (!fileAssetTag.tags) continue;
      const fileID = fileAssetTag.fileID;
      const projectFile = await ProjectFile.findOne({ _id: fileID });
      if (!projectFile) {
        logger.info("ProjectFile not found, skipping...");
        continue;
      }

      logger.info({ detail: [fileID] }, "Migrating fileAssetTag");
      projectFile.tags = fileAssetTag.tags;

      await projectFile.save();
    }
  } catch (e: any) {
    logger.error({ err: e }, "Fatal error during migration");
  }
}
