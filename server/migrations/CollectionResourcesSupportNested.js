import logger from "../logger.js";
import Collection from '../models/collection.js';

/**
 * Remap existing Collection "resources" array from an array of strings to an array of objects in
 * order to support the nestable Collections schema.
 */
export async function runMigration() {
  const migrationTitle = 'Collection Resources Support Nested';
  try {
    logger.info(`Running migration "${migrationTitle}"...`);

    const results = await Collection.find({}).lean();
    const updates = results.map(({ collID, resources }) => {
      if (resources.every((entry) => typeof (entry) === 'string')) {
        return {
          matchObj: { collID },
          updateObj: {
            resources: resources.map((resourceID) => ({
              resourceID,
              resourceType: 'resource',
            })),
          },
        };
      }
      return null;
    }).filter((update) => update !== null);

    const operations = updates.map(({ matchObj, updateObj }) => (
      Collection.updateOne(matchObj, updateObj)
    ));
    await Promise.all(operations);

    logger.info(`Updated ${operations.length} Collections.`);
    logger.info(`Completed migration "${migrationTitle}".`);
  } catch (e) {
    logger.error({ err: e }, `Fatal error during migration "${migrationTitle}"`);
  }
}
