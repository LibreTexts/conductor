// @ts-nocheck
import logger from "../logger.js";
import Project from "../models/project.js";
import ProjectFile from "../models/projectfile.js";

/**
 * Finds all files in the Project.files array and moves them to the ProjectFiles collection.
 */
export async function runMigration() {
  try {
    const projects = await Project.find({
      files: { $exists: true },
    });
    logger.info({ detail: [projects.length] }, "Found projects");
    for (const project of projects) {
      if (!project.files) continue;

      // If the project has no files, remove the files array from the project
      if (project.files.length === 0) {
        project.files = undefined;
        await project.save({
          validateBeforeSave: false,
        });
        continue;
      }

      logger.info({ projectID: project.projectID }, "Migrating project");

      for (const file of project.files) {
        if (!file.fileID) continue;
        const projectID = project.projectID;
        await ProjectFile.create({
          ...file,
          projectID,
        }).catch((e) => {
          if (e.code === 11000) {
            logger.info("File already exists, skipping...");
            return;
          } else {
            throw e;
          }
        });
        logger.info({ detail: [file.fileID] }, "INSERTED FILE ID");
      }
      project.files = undefined; // Remove the files array from the project
      await project.save({
        validateBeforeSave: false,
      });
    }
  } catch (e: any) {
    logger.error({ err: e }, "Fatal error during migration");
  }
}
