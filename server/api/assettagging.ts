import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import { FileInterface } from "../models/file.js";
import FileAssetTags from "../models/fileassettags.js";
import AssetTagKey, { AssetTagKeyInterface } from "../models/assettagkey.js";
import { getRandomColor } from "../util/assettaggingutils.js";
import { Types, isObjectIdOrHexString } from "mongoose";
import {
  compareMongoIDs,
  isAssetTagFrameworkObject,
} from "../util/typeHelpers.js";

async function upsertAssetTags(
  file: FileInterface,
  tags: AssetTagInterface[]
): Promise<void> {
  try {
    const reqTags = tags;
    let refDoc = await FileAssetTags.findOne({ fileID: file._id });
    let createdRefDoc = false;

    if (!refDoc) {
      createdRefDoc = true;
      refDoc = new FileAssetTags({
        fileID: new Types.ObjectId(file._id),
        tags: [],
      });
    }

    // Map keys to array and then search DB so we only have to do one query
    const keysInTags = reqTags.map((t) => t.key);
    const existingKeys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      title: { $in: keysInTags },
      isDeleted: { $ne: true },
    });

    const currTags = await AssetTag.find({ _id: { $in: refDoc?.tags } });
    const newTags: AssetTagInterface[] = [];

    //Find deleted tags where the tag is in the refDoc but not in the tags array (and has a uuid) (presumed it was removed)
    const reqTagUUIDs = reqTags.map((t) => t.uuid).filter((u) => !!u);

    const deletedTags = currTags.filter((t) => t.uuid && !reqTagUUIDs.includes(t.uuid));
    for (const tag of deletedTags) {
      await tag.deleteOne();
    }

    currTags.filter((t) => !deletedTags.includes(t)); //Remove deleted tags from currTags
    for (const tag of reqTags) {
      const existingTag = currTags.find((t) => t._id.equals(tag._id));

      // If the tag already exists, update it
      if (existingTag) {
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
      }
      // If the tag is new, create it
      else {
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

    const finalTags = [...currTags, ...newTags];

    // If there are no tags, and we created a refDoc, don't save it
    if (finalTags.length === 0 && createdRefDoc) {
      return;
    }

    // Update refDoc
    refDoc.tags = finalTags.map((t) => t._id);
    await refDoc.save();
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
