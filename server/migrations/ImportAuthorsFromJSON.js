import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Author from "../models/author.js";
// import dotenv from "dotenv";
// dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Imports author records from prod-authors-header.json and prod-authors-footer.json
 * into the Author collection.
 *
 * Merge rules:
 *  - Within each file, the FIRST occurrence of a duplicate key wins.
 *  - Between files, prod-authors-header.json takes precedence over prod-authors-footer.json.
 *  - Records already present in the DB (matched by nameKey + orgID) are skipped (idempotent).
 *
 * Both files contain invalid JSON escape sequences (\') which are sanitized before parsing.
 *
 * Field mapping (source keys are all lowercase in the JSON):
 *   root key       → nameKey
 *   name           → name
 *   nametitle      → nameTitle
 *   nameurl        → nameURL
 *   note           → note
 *   noteurl        → noteURL
 *   companyname    → companyName
 *   companyurl     → companyURL
 *   picturecircle  → pictureCircle  ("yes" / "no" string)
 *   pictureurl     → pictureURL
 *   programname    → programName
 *   programurl     → programURL
 *   attributionprefix → attributionPrefix
 */

const FIELD_MAP = {
  name: "name",
  nametitle: "nameTitle",
  nameurl: "nameURL",
  note: "note",
  noteurl: "noteURL",
  companyname: "companyName",
  companyurl: "companyURL",
  picturecircle: "pictureCircle",
  pictureurl: "pictureURL",
  programname: "programName",
  programurl: "programURL",
  attributionprefix: "attributionPrefix",
};

/**
 * Replace invalid JSON escape sequences involving apostrophes with a plain apostrophe.
 * Both \' and \\' appear in the source files (single and double-escaped apostrophes),
 * so we collapse any run of one or more backslashes immediately before a ' into
 * just the apostrophe itself.
 * Standard JSON only allows \", \\, \/, \b, \f, \n, \r, \t, \uXXXX.
 */
function fixEscapes(raw) {
  return raw.replace(/\\+'(?!')/g, "'");
}

/**
 * Parse a JSON file, preserving first-occurrence order for duplicate top-level keys.
 *
 * JSON.parse gives last-wins for duplicate keys (undefined behavior per spec, but
 * consistent in V8). Since both source files contain many within-file duplicates, we
 * scan the raw text for top-level key positions and extract each object value via
 * brace-matching, skipping any key we have already seen.
 */
function parseFileFirstWins(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const fixed = fixEscapes(raw);

  const result = {};
  const seenKeys = new Set();

  // Match top-level keys: a line that starts with optional whitespace,
  // a quoted string, a colon, and an opening brace.
  const keyPattern = /\n[ \t]*"([^"]+)"[ \t]*:[ \t]*\{/g;
  let match;

  while ((match = keyPattern.exec(fixed)) !== null) {
    const key = match[1];
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Walk forward from the opening brace of this value using brace-matching.
    const openBrace = match.index + match[0].length - 1; // index of '{'
    let depth = 0;
    let i = openBrace;
    let inString = false;
    let prevBackslash = false;

    while (i < fixed.length) {
      const ch = fixed[i];

      if (prevBackslash) {
        prevBackslash = false;
        i++;
        continue;
      }

      if (ch === "\\" && inString) {
        prevBackslash = true;
        i++;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        i++;
        continue;
      }

      if (!inString) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const valueStr = fixed.substring(openBrace, i + 1);
            try {
              result[key] = JSON.parse(valueStr);
            } catch (e) {
              console.warn(
                `  Warning: could not parse value for key "${key}" in ${path.basename(filePath)}: ${e.message}. Skipping.`
              );
            }
            break;
          }
        }
      }

      i++;
    }
  }

  return result;
}

/**
 * Merge footer and header data.
 * Footer is processed first; header entries always overwrite footer entries
 * (header takes precedence for cross-file duplicates).
 */
function mergeData(header, footer) {
  const result = {};

  for (const [key, value] of Object.entries(footer)) {
    result[key] = value;
  }

  for (const [key, value] of Object.entries(header)) {
    result[key] = value;
  }

  return result;
}

/**
 * Transform a raw JSON record into an Author document.
 * Trims whitespace from all string values and skips empty strings.
 */
function transformRecord(nameKey, record, orgID) {
  const doc = { nameKey, orgID };

  for (const [srcField, value] of Object.entries(record)) {
    const destField = FIELD_MAP[srcField.toLowerCase()];
    if (!destField) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) doc[destField] = trimmed;
    } else if (value !== undefined && value !== null) {
      doc[destField] = value;
    }
  }

  return doc;
}

export async function runMigration() {
  const migrationTitle = "Import Authors from JSON Files";
  try {
    console.log(`Running migration "${migrationTitle}"...`);

    if (!process.env.MONGOOSEURI) {
      throw new Error("MONGOOSEURI environment variable is not set.");
    }
    if (!process.env.ORG_ID) {
      throw new Error("ORG_ID environment variable is not set.");
    }

    await mongoose.connect(process.env.MONGOOSEURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB.");

    const headerPath = path.resolve(__dirname, "../../prod-authors-header.json");
    const footerPath = path.resolve(__dirname, "../../prod-authors-footer.json");

    console.log("Parsing prod-authors-header.json (first-wins)...");
    const headerData = parseFileFirstWins(headerPath);
    console.log(`  ${Object.keys(headerData).length} unique records`);

    console.log("Parsing prod-authors-footer.json (first-wins)...");
    const footerData = parseFileFirstWins(footerPath);
    console.log(`  ${Object.keys(footerData).length} unique records`);

    const merged = mergeData(headerData, footerData);
    console.log(`Merged total: ${Object.keys(merged).length} unique records`);

    // Load existing nameKeys to make this migration idempotent
    const existing = await Author.find({ orgID: process.env.ORG_ID })
      .select("nameKey")
      .lean();
    const existingKeys = new Set(existing.map((a) => a.nameKey));
    console.log(`Existing authors in DB: ${existingKeys.size}`);

    const toInsert = [];
    const skippedExisting = [];
    const skippedInvalid = [];

    for (const [nameKey, record] of Object.entries(merged)) {
      if (existingKeys.has(nameKey)) {
        skippedExisting.push(nameKey);
        continue;
      }

      const doc = transformRecord(nameKey, record, process.env.ORG_ID);

      if (!doc.name) {
        console.warn(`  Skipping "${nameKey}": missing required "name" field.`);
        skippedInvalid.push(nameKey);
        continue;
      }

      toInsert.push(doc);
    }

    console.log(`Records to insert:               ${toInsert.length}`);
    console.log(`Records skipped (already in DB): ${skippedExisting.length}`);
    console.log(`Records skipped (invalid data):  ${skippedInvalid.length}`);

    if (toInsert.length === 0) {
      console.log("Nothing to insert. Migration already complete.");
      return;
    }

    // ordered: false — continue inserting even if individual docs fail
    const insertResult = await Author.insertMany(toInsert, { ordered: false });
    console.log(`Inserted ${insertResult.length} authors successfully.`);
    console.log(`Completed migration "${migrationTitle}".`);
  } catch (e) {
    // MongoBulkWriteError is thrown by insertMany when ordered:false and some docs fail
    if (e.name === "MongoBulkWriteError") {
      console.log(
        `Inserted ${e.result?.nInserted ?? 0} authors (${e.writeErrors?.length ?? 0} skipped due to write errors).`
      );
      return;
    }
    console.error(`Fatal error during migration "${migrationTitle}": ${e.toString()}`);
    throw e;
  } finally {
    await mongoose.disconnect();
  }
}

//Uncomment to run standalone:
// runMigration()
//   .then(() => process.exit(0))
//   .catch((e) => {
//     console.error(`Migration failed: ${e.toString()}`);
//     process.exit(1);
//   });
