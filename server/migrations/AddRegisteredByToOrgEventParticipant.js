import logger from "../logger.js";
import { v4 as uuidv4 } from 'uuid';
import OrgEventParticipant from '../models/orgeventparticipant.js';

/**
 * Populates the 'registeredBy' reference of the OrgEventParticipant model with the user who
 * originally registered (pre-migration)
 */
export async function runMigration() {
  const migrationTitle = 'Add RegisteredBy to OrgEventParticipant';
  try {
    logger.info(`Running migration "${migrationTitle}"...`);

    const results = await OrgEventParticipant.find({}).lean();
    const operations = results.map((participant) =>
      OrgEventParticipant.updateOne(
        { _id: participant._id },
        {
          regID: uuidv4(),
          registeredBy: participant.user
        },
      )
    );
    await Promise.all(operations);

    logger.info(`Updated ${operations.length} Participants.`);
    logger.info(`Completed migration "${migrationTitle}".`);
  } catch (e) {
    logger.error({ err: e }, `Fatal error during migration "${migrationTitle}"`);
  }
}
