import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import ProjectFile, { RawProjectFileInterface } from "../models/projectfile.js";
import AssetTagKey, { AssetTagKeyInterface } from "../models/assettagkey.js";
import { getRandomColor } from "../util/assettaggingutils.js";
import { Types, isObjectIdOrHexString } from "mongoose";
import {
  compareMongoIDs,
  isAssetTagFrameworkObject,
  isAssetTagKeyObject,
} from "../util/typeHelpers.js";

type AssetTagFromRequest = Pick<
  AssetTagInterface,
  "key" | "value" | "framework"
> & { uuid?: string; _id?: string };

async function upsertAssetTags(
  file: RawProjectFileInterface,
  reqTags: AssetTagFromRequest[]
): Promise<void> {
  try {
    const existingTagIds = file.tags ?? [];
    const existingTags =
      existingTagIds.length > 0
        ? await AssetTag.find({ _id: { $in: existingTagIds } })
        : [];

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

    const tagsToWrite = [];
    for (const tag of reqTags) {
      const existingTag = tag._id
        ? existingWithoutDeleted.find((t) => t._id.equals(tag._id))
        : null;

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

        tagsToWrite.push({
          updateOne: {
            filter: { _id: existingTag._id },
            update: {
              $set: {
                value: existingTag.value,
                key: existingTag.key,
                framework: existingTag.framework,
              },
            },
          },
        });
      } else {
        // If the tag is new, create it
        tag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(existingKeys, tag)
        );
        const newTag = new AssetTag({
          ...tag,
          uuid: v4(),
        });

        tagsToWrite.push({
          insertOne: {
            document: newTag,
          },
        });

        newTags.push(newTag);
      }
    }

    if (tagsToWrite.length > 0) {
      await AssetTag.bulkWrite(tagsToWrite);
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
  tag: AssetTagFromRequest,
  updatedKey?: string
): Promise<string> {
  console.log('existingKeys')
  console.log(existingKeys)
  const _compareFrameworks = (tagFramework: any, keyFramework: any) => {
    if (!tagFramework && !keyFramework) return true;
    if (!tagFramework || !keyFramework) return false;
    const isMatch = compareMongoIDs(
      isAssetTagFrameworkObject(keyFramework) ? keyFramework._id : keyFramework,
      isAssetTagFrameworkObject(tagFramework) ? tagFramework._id : tagFramework
    );
    return isMatch;
  };

  /**
   * If key is ObjectId, find where tag.key === key._id (likely an existing tag)
   * If key is AssetTagKey, find where tag.key._id === key._id (likely an existing tag)
   * If key is string, find where tag.key === key.title (likely a new tag, manually entered by user)
   * If key is string and tag.framework is set, find where tag.key === key.title && tag.framework === key.framework
   */
  let key = null;
  if (isObjectIdOrHexString(tag.key)) {
    key = existingKeys.find((k) =>
      k._id.equals(new Types.ObjectId(tag.key.toString()))
    );
  } else if (isAssetTagKeyObject(tag.key)) {
    key = existingKeys.find((k) =>
      k._id.equals(
        new Types.ObjectId((tag.key as AssetTagKeyInterface)._id.toString())
      )
    );
  } else {
    key = existingKeys.find(
      (k) =>
        k.title === tag.key.toString() &&
        _compareFrameworks(tag.framework, k.framework)
    );
  }

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
