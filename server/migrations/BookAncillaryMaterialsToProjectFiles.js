import async from 'async';
import { S3Client, CopyObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { debug, debugError } from '../debug.js';
import Book from '../models/book.js';
import Project from '../models/project.js';
import { getLibraryAndPageFromBookID } from '../util/bookutils.js';
import { PROJECT_FILES_S3_CLIENT_CONFIG } from '../util/projectutils.js';

/**
 * Transfer Book "Materials" to their related Project, renamed as "Files".
 */
export async function runMigration() {
  const migrationTitle = 'Book Ancillary Materials to Project Files';
  try {
    debug(`Running migration "${migrationTitle}"...`);
    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const libraries = new Set();
    const pageIDs = new Set();
    const booksWithMaterials = (await Book.aggregate([
      {
        $match: {
          materials: { $ne: null },
        },
      },
      {
        $project: {
          _id: 0,
          bookID: 1,
          materials: 1,
        },
      },
    ])).map((entry) => {
      const [library, pageID] = getLibraryAndPageFromBookID(entry.bookID);
      if (!library || !pageID) {
        return;
      }
      libraries.add(library);
      pageIDs.add(pageID);
      return { library, pageID, materials: entry.materials };
    }).filter((entry) => entry !== null);
    const relatedProjects = await Project.aggregate([
      {
        $match: {
          $and: [
            { libreLibrary: { $in: Array.from(libraries) } },
            { libreCoverID: { $in: Array.from(pageIDs) } },
          ]
        }
      }, {
        $project: {
          _id: 0,
          projectID: 1,
          libreLibrary: 1,
          libreCoverID: 1,
        },
      },
    ]);

    const projectUpdates = [];
    const bookUpdates = [];
    let fileMoves = [];
    relatedProjects.forEach((project) => {
      const foundBook = booksWithMaterials.find((entry) => 
        (entry.library === project.libreLibrary && entry.pageID === project.libreCoverID)
      );
      if (!foundBook) {
        return;
      }
      const updatedFiles = foundBook.materials.map((material) => ({
        fileID: material.materialID,
        ...material,
      }));
      updatedFiles.forEach((file) => fileMoves.push({
        CopySource: `${process.env.AWS_MATERIALS_BUCKET}/${foundBook.library}-${foundBook.pageID}/${file.fileID}`,
        Key: `${project.projectID}/${file.fileID}`,
        OriginalKey: `${foundBook.library}-${foundBook.pageID}/${file.fileID}`,
      }));
      projectUpdates.push({
        filter: { projectID: project.projectID },
        update: { files: updatedFiles },
      });
      bookUpdates.push({
        filter: { bookID: `${foundBook.library}-${foundBook.pageID}` },
        update: { $unset: { materials: '' } },
      });
    });

    const objectsResponse = await storageClient.send(new ListObjectsV2Command({ Bucket: process.env.AWS_MATERIALS_BUCKET }));
    const originalObjects = objectsResponse.Contents?.map((item) => item.Key);
    fileMoves = fileMoves.filter((move) => originalObjects.includes(move.OriginalKey))

    const projResults = await async.mapLimit(projectUpdates, 2, async (op) => Project.updateOne(op.filter, op.update));
    const bookResults = await async.mapLimit(bookUpdates, 2, async (op) => Book.updateOne(op.filter, op.update));
    const fileResults = await async.mapLimit(fileMoves, 2, async (move) => storageClient.send(new CopyObjectCommand({
      Bucket: process.env.AWS_PROJECTFILES_BUCKET,
      CopySource: move.CopySource,
      Key: move.Key,
    })));
    const projUpdated = projResults.reduce((acc, curr) => curr.acknowledged ? acc + 1 : acc, 0);
    const bookUpdated = bookResults.reduce((acc, curr) => curr.acknowledged ? acc + 1 : acc, 0);
    const fileUpdated = fileResults.reduce((acc, curr) => curr.$metadata?.httpStatusCode === 200 ? acc + 1 : acc, 0);

    debug(`Updated ${projUpdated.toLocaleString()} Projects, ${bookUpdated.toLocaleString()} Books, and ${fileUpdated.toLocaleString()} files.`);
    debug(`Completed migration "${migrationTitle}".`);
  } catch (e) {
    debugError(`Fatal error during migration "${migrationTitle}": ${e.toString()}`);
  }
}
