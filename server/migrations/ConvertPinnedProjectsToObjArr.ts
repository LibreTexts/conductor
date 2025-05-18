import User from "../models/user";

export async function runMigration() {
  try {
    const users = await User.find({}).lean();

    const toUpdate = [];

    for (const user of users) {
      // If the user pinnedProjects is an array of strings, convert it to an array of objects [{folder: "Default", projects: [...originalIds]}]
      if (Array.isArray(user.pinnedProjects)) {

        // if the first item in the array is already an object, do nothing - it may have already been migrated
        if (typeof user.pinnedProjects[0] === "object") {
          console.log(
            `User ${user.email} already has pinnedProjects in the correct format.`
          );
          continue;
        }

        const stringItems = [
          ...user.pinnedProjects.filter((item) => typeof item === "string"),
        ];
        user.pinnedProjects = [
          {
            folder: "Default",
            projects: stringItems,
          },
        ];
      }

      // If the user pinnedProjects does otherwise not exist or match the expected format, set it to an empty array
      if (!user.pinnedProjects || !Array.isArray(user.pinnedProjects)) {
        user.pinnedProjects = [
          {
            folder: "Default",
            projects: [],
          },
        ];
      }

      console.log(
        `Migrating user ${user.email} with new pinnedProjects: `,
        user.pinnedProjects
      );

      toUpdate.push({
        _id: user._id,
        pinnedProjects: user.pinnedProjects,
      })
    }

    // Update 25 users at a time
    const chunkSize = 25;
    for (let i = 0; i < toUpdate.length; i += chunkSize) {
      const chunk = toUpdate.slice(i, i + chunkSize);
      // use bulkWrite to update the users
      const bulkOps = chunk.map((user) => ({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { pinnedProjects: user.pinnedProjects } },
        },
      }));

      await User.bulkWrite(bulkOps);
    }


  } catch (err) {
    console.error("Error during migration: ", err);
  }
}
