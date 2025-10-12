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
import { isMongoIDValidator } from "./validators/misc.js";

type AssetTagFromRequest = Pick<
  AssetTagInterface,
  "key" | "value" | "framework"
> & { uuid?: string; _id?: string };

/**
 * Upserts asset tags for a given file. If mode is "append", tags are simply added to any existing tags (de-duplicated).
 * If mode is replace, any existing tags are disregarded and cleared.
 * @param file - The file object to upsert tags for
 * @param reqTags - The tags to upsert
 * @param  mode - "replace" or "append" (default: "append")
 */
async function upsertAssetTags(
  file: RawProjectFileInterface,
  reqTags: AssetTagFromRequest[],
  mode: "replace" | "append" = "append"
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

    const tagsToWrite = [];
    const newTags: AssetTagInterface[] = [];
    let finalTags: AssetTagInterface[] = [];

    if (mode === "append") {
      // De-duplicate tags based on key (only one tag per key is allowed)
      // If a tag with the same key already exists, replace it with the new tag (from reqTags) to ensure the value is updated
      for (const tag of reqTags) {
        tag.key = new Types.ObjectId(
          await getUpsertedAssetTagKey(existingKeys, tag)
        );

        const existingTag = existingTags.find((e) => {
          if (!isMongoIDValidator(tag.key?.toString())) return false;
          if (!isMongoIDValidator(e.key?.toString())) return false;
          return compareMongoIDs(tag.key, e.key);
        });

        if (existingTag) {
          const updated = await updateExistingTag(existingTag, tag, existingKeys);
          tagsToWrite.push({
            updateOne: {
              filter: { _id: existingTag._id },
              update: {
                $set: {
                  value: updated.value,
                  key: updated.key,
                  framework: updated.framework,
                },
              },
            },
          });
        } else {
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
      finalTags = [...existingTags, ...newTags];
    } else {
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
        const existingTag = tag._id
          ? existingWithoutDeleted.find((t) => t._id.equals(tag._id))
          : null;

        if (existingTag) {
          const tagChanged = await updateExistingTag(existingTag, tag, existingKeys);
          tagsToWrite.push({
            updateOne: {
              filter: { _id: existingTag._id },
              update: {
                $set: {
                  value: tagChanged.value,
                  key: tagChanged.key,
                  framework: tagChanged.framework,
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

      finalTags = [...existingWithoutDeleted, ...newTags];
    }

    if (tagsToWrite.length > 0) {
      await AssetTag.bulkWrite(tagsToWrite);
    }

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

async function updateExistingTag(existingTag: AssetTagInterface | AssetTagFromRequest, tag: AssetTagFromRequest, existingKeys: AssetTagKeyInterface[]) {
  existingTag.value = tag.value;
  existingTag.framework = tag.framework;
  existingTag.key = new Types.ObjectId(
    await getUpsertedAssetTagKey(
      existingKeys,
      existingTag,
      tag.key.toString()
    ) // Pass the key from the request in case it was updated and is no longer a valid mongoID/object
  );

  return existingTag;
}

async function getUpsertedAssetTagKey(
  existingKeys: AssetTagKeyInterface[],
  tag: AssetTagInterface | AssetTagFromRequest,
  updatedKey?: string
): Promise<string> {
  const _compareFrameworks = (tagFramework: any, keyFramework: any) => {
    if (!tagFramework && !keyFramework) return true;
    if (!tagFramework || !keyFramework) return false;

    // We could use isAssetTagFrameworkObject() here, but we only need to check if the _id is present
    // This allows us to avoid having to pass the entire framework object in the request
    const isMatch = compareMongoIDs(
      typeof keyFramework === "object" && "_id" in keyFramework
        ? keyFramework._id
        : keyFramework,
      typeof tagFramework === "object" && "_id" in tagFramework
        ? tagFramework._id
        : tagFramework
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
