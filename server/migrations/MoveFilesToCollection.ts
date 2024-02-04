// @ts-nocheck
import Project from "../models/project.js";
import { debugError } from "../debug.js";
import ProjectFile from "../models/projectfile.js";

/**
 * Finds all files in the Project.files array and moves them to the ProjectFiles collection.
 */
export async function runMigration() {
  try {
    const projects = await Project.find({
      files: { $exists: true },
    });
    console.log("Found projects: ", projects.length);
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

      console.log("Migrating project: ", project.projectID);

      for (const file of project.files) {
        if (!file.fileID) continue;
        const projectID = project.projectID;
        await ProjectFile.create({
          ...file,
          projectID,
        }).catch((e) => {
          if (e.code === 11000) {
            console.log("File already exists, skipping...");
            return;
          } else {
            throw e;
          }
        });
        console.log("INSERTED FILE ID: ", file.fileID);
      }
      project.files = undefined; // Remove the files array from the project
      await project.save({
        validateBeforeSave: false,
      });
    }
  } catch (e: any) {
    debugError(`Fatal error during migration: ${e.toString()}`);
  }
}
