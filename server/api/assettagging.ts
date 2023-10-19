import AssetTag, { AssetTagInterface } from "../models/assettag.js";
import { v4 } from "uuid";
import { FileInterface } from "../models/file.js";
import FileAssetTags from "../models/fileassettags.js";

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

    const currTags = await AssetTag.find({ _id: { $in: refDoc?.tags } });
    const newTags: AssetTagInterface[] = [];

    for (const tag of tags) {
      const currTag = currTags.find((t) => t._id.equals(tag._id));
      if (currTag) {
        currTag.title = tag.title;
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
  if (!tag.title) return false;
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
