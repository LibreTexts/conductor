import PrejectRemixer, {
  PathLevelFormatState,
  RemixerSubPageState,
} from "../models/projectremixer.js";

/**
 * Repairs remixer states corrupted by a non-string `pathLevelFormats[].prefix`.
 *
 * A level format prefix that arrived as an object was cast by Mongoose's
 * `String` schema type to the literal `"[object Object]"` on save. That string
 * then flowed into every level-1 node's `formattedPath` (e.g. `"[object Object]1"`)
 * because path building concatenates `prefix + index`.
 *
 * This migration strips the `"[object Object]"` marker wherever it was persisted:
 *   - `pathLevelFormats[].prefix`  → "" (falls back to no prefix)
 *   - each book node's `formattedPath` → marker removed (e.g. "[object Object]1" → "1")
 *
 * Removing the marker from `formattedPath` is safe for both auto-numbered and
 * overridden nodes: for auto-numbered nodes the client recomputes the value from
 * `pathNumber` on the next load anyway; for overrides it preserves the real
 * index/suffix the user entered while dropping only the corrupted prefix.
 */

const MARKER = "[object Object]";

export async function runMigration() {
  try {
    const states = await PrejectRemixer.find({}).lean();

    const toUpdate: {
      _id: unknown;
      remixerCurrentBook: RemixerSubPageState[];
      pathLevelFormats: PathLevelFormatState[];
    }[] = [];

    for (const state of states) {
      let changed = false;

      const pathLevelFormats = Array.isArray(state.pathLevelFormats)
        ? state.pathLevelFormats.map((format) => {
            if (
              format &&
              typeof format.prefix === "string" &&
              format.prefix.includes(MARKER)
            ) {
              changed = true;
              return { ...format, prefix: format.prefix.split(MARKER).join("") };
            }
            return format;
          })
        : state.pathLevelFormats;

      const remixerCurrentBook = Array.isArray(state.remixerCurrentBook)
        ? state.remixerCurrentBook.map((node) => {
            if (
              node &&
              typeof node.formattedPath === "string" &&
              node.formattedPath.includes(MARKER)
            ) {
              changed = true;
              return {
                ...node,
                formattedPath: node.formattedPath.split(MARKER).join(""),
              };
            }
            return node;
          })
        : state.remixerCurrentBook;

      if (!changed) continue;

      console.log(
        `Repairing remixer state for project ${state.projectID} (remixerID ${state.remixerID}).`,
      );

      toUpdate.push({
        _id: state._id,
        remixerCurrentBook: remixerCurrentBook as RemixerSubPageState[],
        pathLevelFormats: pathLevelFormats as PathLevelFormatState[],
      });
    }

    console.log(`Found ${toUpdate.length} remixer state(s) to repair.`);

    const chunkSize = 25;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      const bulkOps = chunk.map((state) => ({
        updateOne: {
          filter: { _id: state._id },
          update: {
            $set: {
              remixerCurrentBook: state.remixerCurrentBook,
              pathLevelFormats: state.pathLevelFormats,
            },
          },
        },
      }));

      await PrejectRemixer.bulkWrite(bulkOps);
    }

    console.log("Remixer path repair migration complete.");
  } catch (err) {
    console.error("Error during migration: ", err);
  }
}
