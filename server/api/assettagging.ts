import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import { FileInterface } from "../models/file.js";
import FileAssetTags from "../models/fileassettags.js";
import AssetTagKey from "../models/assettagkey.js";
import { getRandomColor } from "../util/assettaggingutils.js";



async function upsertAssetTags(
  file: FileInterface,
  tags: AssetTagInterface[]
): Promise<void> {
  try {
    let refDoc = await FileAssetTags.findOne({ fileID: file._id });

    if (!refDoc) {
      refDoc = new FileAssetTags({
        fileID: file._id,
        tags: [],
      });
    }

    // Map keys to array and then search DB so we only have to do one query
    const keysInTags = tags.map((t) => t.key);
    const existingKeys = await AssetTagKey.find({
      orgID: process.env.ORG_ID,
      title: { $in: keysInTags },
      isDeleted: {$ne: true}
    }).lean();

    const currTags = await AssetTag.find({ _id: { $in: refDoc?.tags } });
    const newTags: AssetTagInterface[] = [];

    for (const tag of tags) {
      const currTag = currTags.find((t) => t._id.equals(tag._id));
      if (currTag) {
        const key = existingKeys.find((k) => k._id.equals(tag.key));
        if (key) {
          currTag.key = key._id;
        } else {
          const newKey = new AssetTagKey({
            title: tag.key,
            hex: getRandomColor(),
            orgID: process.env.ORG_ID,
          });
          await newKey.save();
          currTag.key = newKey._id;
        }
        currTag.value = tag.value;
        currTag.framework = tag.framework;
        currTag.isDeleted = tag.isDeleted;
        await currTag.save();
      } else {
        const newTag = new AssetTag({
          ...tag,
          uuid: v4(),
        });
        await newTag.save();
        newTags.push(newTag);
      }
    }

    refDoc.tags = [...currTags.map((c) => c._id), ...newTags.map((n) => n._id)];

    await refDoc.save();
  } catch (err) {
    throw err;
  }
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
