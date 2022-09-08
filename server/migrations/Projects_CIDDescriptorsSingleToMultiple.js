import { debugError } from '../debug';
import Project from '../models/project';

/**
 * Updates the Projects collection to convert the 'cidDescriptor' string field to the
 * 'cidDescriptors' string-array field.
 * If using MongoDB Shell, set the 
 */
async function ProjectsCIDDescriptorSingleToMultiple() {
  try {
    const results = await Project.updateMany({
      $and: [
        { cidDescriptor: { $exists: true } },
        { cidDescriptor: { $type: 'string' } },
      ],
    }, [
      {
        $addFields: {
          cidDescriptors: {
            $cond: [
              { $gt: [{ $strLenBytes: '$cidDescriptor' }, 0] },
              ['$cidDescriptor'],
              '$$REMOVE',
            ],
          },
        },
      }, {
        $unset: "cidDescriptor",
      },
    ]);
    if (results.acknowledged) {
      console.log(`Succesfully updated ${results.modifiedCount} records.`);
    } else {
      throw new Error('Request not acknowledged by database.');
    }
  } catch (e) {
    debugError(`Fatal error during migration: ${e.toString()}`);
  }
}
