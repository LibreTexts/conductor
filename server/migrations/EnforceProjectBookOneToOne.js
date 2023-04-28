import Book from '../models/book.js';
import Project from '../models/project.js';
import { getLibraryAndPageFromBookID } from '../util/bookutils.js';
import { debugError } from '../debug.js';

/**
 * Finds cases where a Book has more than one Project associated with it.
 */
export async function runMigration() {
  try {
    const allBooks = await Book.find();
    console.info(`Found ${allBooks.length.toLocaleString()} total Books.`);

    const moreThanOne = (await Promise.all(allBooks.map(async (bk) => {
      const [library, coverID] = getLibraryAndPageFromBookID(bk.bookID);
      const matchingProjects = await Project.find({
        libreLibrary: library,
        libreCoverID: coverID,
      });
      if (matchingProjects.length > 1) {
        return {
          bookID: bk.bookID,
          projects: matchingProjects,
        };
      }
      return null;
    }))).filter((assoc) => !!assoc);

    console.info(`Found ${moreThanOne.length.toLocaleString()} Books with more than one associated Project: `, moreThanOne.map((assoc) => assoc.bookID));

    await Promise.all(moreThanOne.map(async ({ bookID, projects }) => {
      const toRemove = projects.sort((a, b) => a.updatedAt - b.updatedAt);
      toRemove.pop();
      await Project.deleteMany({ projectID: { $in: toRemove.map((proj) => proj.projectID) } });
      console.info(`Fixed associations for ${bookID}.`);
    }));

    console.log(`Updated ${moreThanOne.length.toLocaleString()} Books to enforce 1-to-1 relationship with Projects.`);
  } catch (e) {
    debugError(`Fatal error during migration: ${e.toString()}`);
  }
}
