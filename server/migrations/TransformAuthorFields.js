import Author from "../models/author.js";
import mongoose from "mongoose";
// import dotenv from 'dotenv';
// dotenv.config();

/**
 * Transforms the Author collection to match the new schema:
 * - Combines firstName + lastName into name
 * - Renames url to nameURL
 * - Keeps orgID and userUUID unchanged
 * - Removes email, primaryInstitution, and isAdminEntry fields
 *
 * Idempotent - can be run multiple times safely.
 */
export async function runMigration() {
  const migrationTitle = "Transform Author Fields";
  try {
    console.log(`Running migration "${migrationTitle}"...`);

    console.log("Connecting to MongoDB...");
    if (!process.env.MONGOOSEURI) {
      throw new Error("MONGOOSEURI environment variable is not set.");
    }

    await mongoose.connect(process.env.MONGOOSEURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Connected to MongoDB.");

    // Find all authors that haven't been migrated yet
    // (they still have firstName field, which indicates they need migration)
    const authorsToMigrate = await Author.find({
      firstName: { $exists: true },
    }).lean();

    console.log(`Found ${authorsToMigrate.length} authors to migrate.`);

    if (authorsToMigrate.length === 0) {
      console.log(
        "No authors need migration. Migration already complete or no authors exist.",
      );
      return;
    }

    // Get the underlying MongoDB collection to bypass Mongoose schema validation
    const collection = Author.collection;

    const operations = authorsToMigrate.map((author) => {
      const updateObj = {
        $set: {},
        $unset: {},
      };

      // Generate nameKey from firstName and lastName
      if (author.firstName || author.lastName) {
        const firstName = author.firstName || "";
        const lastName = author.lastName || "";
        updateObj.$set.nameKey = generateNameKey(firstName, lastName);
      }

      if (!updateObj.$set.nameKey) {
        console.warn(
          `Author ${author._id} is missing both firstName and lastName. Skipping migration for this author.`,
        );
        return collection.updateOne({ _id: author._id }, { $set: {} }); // No-op update to skip this author
      }

      // Combine firstName + lastName into name
      // Only set if both firstName and lastName exist
      if (author.firstName || author.lastName) {
        const firstName = author.firstName || "";
        const lastName = author.lastName || "";
        updateObj.$set.name = `${firstName} ${lastName}`.trim();
      }

      // Rename url to nameURL if it exists
      if (author.url) {
        updateObj.$set.nameURL = author.url;
      }

      // Remove old fields
      updateObj.$unset.firstName = "";
      updateObj.$unset.lastName = "";
      updateObj.$unset.url = "";
      updateObj.$unset.email = "";
      updateObj.$unset.primaryInstitution = "";
      updateObj.$unset.isAdminEntry = "";

      console.log(`Updating author ${author._id}:`, updateObj);

      // Use native MongoDB collection.updateOne() to bypass Mongoose schema validation
      return collection.updateOne({ _id: author._id }, updateObj);
    });

    const results = await Promise.all(operations);

    const updatedCount = results.filter((r) => r.modifiedCount > 0).length;

    console.log(`Updated ${updatedCount} authors successfully.`);
    console.log(`Completed migration "${migrationTitle}".`);
  } catch (e) {
    console.error(
      `Fatal error during migration "${migrationTitle}": ${e.toString()}`,
    );
    throw e;
  } finally {
    await mongoose.disconnect();
  }
}

function generateNameKey(firstName, lastName) {
  const first = firstName ? firstName.trim() : "";
  const last = lastName ? lastName.trim() : "";

  return `${first.toLowerCase()}-${last.toLowerCase()}`.trim();
}

// runMigration()
// .then(() => {
//   console.log('Migration completed successfully.');
//   process.exit(0);
// })
// .catch((e) => {
//   console.error(`Migration failed: ${e.toString()}`);
//   process.exit(1);
// });
