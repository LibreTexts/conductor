import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import ProjectFile, { ProjectFileInterface } from "../models/projectfile.js";
import AssetTagKey, { AssetTagKeyInterface } from "../models/assettagkey.js";
import { getRandomColor } from "../util/assettaggingutils.js";
import { Types, isObjectIdOrHexString } from "mongoose";
import {
  compareMongoIDs,
  isAssetTagFrameworkObject,
} from "../util/typeHelpers.js";

async function upsertAssetTags(
  file: ProjectFileInterface,
  reqTags: AssetTagInterface[]
): Promise<void> {
  try {
    const existingTagIds = file.tags ?? [];
    const existingTags = await AssetTag.find({ _id: { $in: existingTagIds } });

    // Map keys to array and then search DB so we only have to do one query
    const existingKeys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      isDeleted: { $ne: true },
    });

    const newTags: AssetTagInterface[] = [];

    //Find deleted tags where the tag is in the existing tags but not in the tags array (and has a uuid) (presumed it was removed)
    const reqTagUUIDs = reqTags.map((t) => t.uuid).filter((u) => !!u);
    const deletedTags = existingTags.filter(
      (t) => t.uuid && !reqTagUUIDs.includes(t.uuid)
    );
    if (deletedTags.length > 0) {
      await AssetTag.deleteMany({
        _id: { $in: deletedTags.map((t) => t._id) },
      });
    }

    // Filter out the deleted tags from the existing tags
    const existingWithoutDeleted = existingTags.filter(
      (t) => !deletedTags.includes(t)
    );
    for (const tag of reqTags) {
      const existingTag = existingWithoutDeleted.find((t) =>
        t._id.equals(tag._id)
      );

      if (existingTag) {
        // If the tag already exists, update it
        existingTag.value = tag.value;
        existingTag.framework = tag.framework;
        existingTag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(
            existingKeys,
            existingTag,
            tag.key.toString()
          ) // Pass the key from the request in case it was updated and is no longer a valid mongoID/object
        );
        await existingTag.save();
      } else {
        // If the tag is new, create it
        tag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(existingKeys, tag)
        );
        const newTag = new AssetTag({
          ...tag,
          uuid: v4(),
        });
        await newTag.save();
        newTags.push(newTag);
      }
    }

    const finalTags = [...existingWithoutDeleted, ...newTags];

    await ProjectFile.updateOne(
      {
        fileID: file.fileID,
      },
      {
        tags: finalTags.map((t) => t._id),
      }
    );
  } catch (err) {
    throw err;
  }
}

async function getUpsertedAssetTagKey(
  existingKeys: AssetTagKeyInterface[],
  tag: AssetTagInterface,
  updatedKey?: string
): Promise<string> {
  /**
   * If key is ObjectId, find where tag.key === key._id (likely an existing tag)
   * If key is string, find where tag.key === key.title (likely a new tag)
   * If key is string and tag.framework is set, find where tag.key === key.title && tag.framework === key.framework
   */
  const key = existingKeys.find((k) =>
    isObjectIdOrHexString(tag.key)
      ? k._id.equals(tag.key)
      : k.title === tag.key.toString() &&
        (k.framework
          ? compareMongoIDs(
              k.framework,
              isAssetTagFrameworkObject(tag.framework)
                ? tag.framework._id
                : tag.framework
            )
          : true)
  );

  // If the key already exists, return it's ObjectId
  if (key) {
    return key._id.toString();
  }

  // If the key doesn't exist, create it and return it's ObjectId
  const newKey = new AssetTagKey({
    title: updatedKey ? updatedKey : tag.key.toString(),
    hex: getRandomColor(),
    orgID: process.env.ORG_ID,
    framework: tag.framework,
  });
  await newKey.save();
  return newKey._id.toString();
}

function validateAssetTag(tag: AssetTagInterface): boolean {
  if (!tag.key) return false;
  if (!tag.value) return false;
  return true;
}

function validateAssetTagArray(tags: AssetTagInterface[]): boolean {
  for (const tag of tags) {
    if (!validateAssetTag(tag)) return false;
  }
  return true;
}

export { upsertAssetTags, validateAssetTag, validateAssetTagArray };
