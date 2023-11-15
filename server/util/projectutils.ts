import axios from "axios";
import {
  stringContainsOneOfSubstring,
  getProductionURL,
  assembleUrl,
} from "./helpers.js";
import { libraryNameKeys } from "./librariesmap.js";
import { getSignedUrl } from "@aws-sdk/cloudfront-signer";
import { debugError } from "../debug.js";
import Project, { ProjectInterface } from "../models/project.js";
import User from "../models/user.js";
import base64 from "base-64";
import projectsAPI from "../api/projects.js";
import usersAPI from "../api/users.js";
import {
  FileInterface,
  FileInterfaceAccess,
  FileInterfacePath,
  RawFileInterface,
} from "../models/file.js";
import fs from "fs-extra";
import AdmZip from "adm-zip";
import { v4 } from "uuid";
import { all } from "bluebird";

export const projectClassifications = [
  "harvesting",
  "curation",
  "construction",
  "technology",
  "librefest",
  "coursereport",
  "adoptionrequest",
  "miscellaneous",
];

export const constrRoadmapSteps = [
  "1",
  "2",
  "3",
  "4",
  "5a",
  "5b",
  "5c",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];

export const textUseOptions = [
  { key: "empty", text: "Clear...", value: "" },
  { key: "primary", text: "As the primary textbook", value: "primary" },
  { key: "supplement", text: "As supplementary material", value: "supplement" },
  {
    key: "remix",
    text: "As part of a remix that I am creating for my class",
    value: "remix",
  },
  { key: "other", text: "Other (please explain in comments)", value: "other" },
];

export const progressThreadDefaultMessage = `*This thread was automatically created by Conductor. Use it to discuss your project's progress, or create another to the left!*`;

export const projectWelcomeMessage = `Welcome to your new Conductor project!
The Conductor is an increasingly powerful project planning and curation tool. If your text is available on the LibreTexts bookshelves, it is also listed on Commons. Using Conductor, you can collect and curate Peer Reviews to continuously improve the quality of your new resource. Conductor also provides a place for your project files such as slide decks, a syllabus, notes, etc., all of which can be public (available to all) or restricted to instructors. You can use the *Accessibility* tab of your new project or our Accessibility Checker tool in the library editor to ensure your resource is available to all readers.
Conductor improves communication between the LibreTexts team and our community of authors. Projects needing help can be flagged for review. The platform streamlines adoption reporting and account requests into one convenient place. Users submitting a Harvesting Request can be added to the project to stay up-to-date with its progress in real-time.
Conductor also promotes collaboration and organization among everyone on your OER team (including LibreTexts project liaisons) by providing messaging and task/to-do lists. Tasks can have dependencies and due dates and are visible in a calendar or Gantt chart view.
You can find in-depth guides on using the Commons and the Conductor to curate your resource in the [Construction Guide](https://chem.libretexts.org/Courses/Remixer_University/LibreTexts_Construction_Guide/10%3A_Commons_and_Conductor).
`;

export const PROJECT_FILES_S3_CLIENT_CONFIG = {
  credentials: {
    accessKeyId: process.env.AWS_PROJECTFILES_ACCESS_KEY,
    secretAccessKey: process.env.AWS_PROJECTFILES_SECRET_KEY,
  },
  region: process.env.AWS_PROJECTFILES_REGION,
};

export const PROJECT_FILES_ACCESS_SETTINGS = [
  "public",
  "users",
  "instructors",
  "team",
  "mixed",
];

export const isFileInterfaceAccess = (
  access: string
): access is FileInterfaceAccess => {
  return PROJECT_FILES_ACCESS_SETTINGS.includes(access);
};

/**
 * Validates that a given classification string is one of the
 * pre-defined, acceptable classifications.
 * @param {String} classification  - the classification string to test
 * @returns {Boolean} true if valid classification, false otherwise
 */
export const validateProjectClassification = (classification: string) => {
  return projectClassifications.includes(classification);
};

/**
 * Validates that a given Construction Roadmap step name is one of the
 * pre-defined, acceptable step names.
 * @param {String} step  - the step name to test
 * @returns {Boolean} true if valid step, false otherwise.
 */
export const validateRoadmapStep = (step: string) => {
  return constrRoadmapSteps.includes(step);
};

/**
 * Retrieves the UI-ready representation of a Text Use option.
 * @param {String} use - The internal Text Use identifier.
 * @returns {String} The UI-ready representation, or an empty string if not found.
 */
export const getTextUse = (use: string) => {
  if (use !== "") {
    let foundUse = textUseOptions.find((item) => {
      return item.value === use;
    });
    if (foundUse !== undefined) return foundUse.text;
  } else {
    return "";
  }
};

/**
 * Retrieves basic information about a LibreText and its location via the LibreTexts API.
 * @param {String} url - The LibreTexts url to retrieve information about.
 * @returns {Object} An object with information about the LibreText (lib, id, shelf, campus).
 */
export async function getLibreTextInformation(url: string) {
  let textInfo = {
    lib: "",
    id: "",
    shelf: "",
    campus: "",
  };
  try {
    if (typeof url !== "string") {
      throw new Error("Invalid URL argument");
    }

    let subdomainSearch = stringContainsOneOfSubstring(
      url,
      libraryNameKeys,
      true
    );

    if (
      !(
        typeof subdomainSearch === "object" &&
        subdomainSearch.hasOwnProperty("substr") &&
        "substr" in subdomainSearch &&
        subdomainSearch.substr !== ""
      )
    ) {
      throw new Error("Subdomain search failed.");
    }

    textInfo.lib = subdomainSearch.substr as string; // TODO: add typing for stringContainsOneOfSubstring
    let libNames = libraryNameKeys.join("|");
    let libreURLRegex = new RegExp(
      `(http(s)?:\/\/)?(${libNames}).libretexts.org\/`,
      "i"
    );
    let path = url.replace(libreURLRegex, "");

    let apiRes = await axios.put(
      "https://api.libretexts.org/endpoint/info",
      {
        subdomain: subdomainSearch.substr,
        path: path,
        dreamformat: "json",
      },
      { headers: { Origin: getProductionURL() } }
    );

    if (!apiRes.data) {
      throw new Error("Server returned null or invalid data.");
    }

    let apiData = apiRes.data;
    if (apiData.hasOwnProperty("@id") && typeof apiData["@id"] === "string") {
      textInfo.id = apiData["@id"];
    }
    if (apiData.hasOwnProperty("path") && typeof apiData.path === "object") {
      if (
        apiData.path.hasOwnProperty("#text") &&
        typeof (apiData.path["#text"] === "string")
      ) {
        let foundPath = apiData.path["#text"];
        let bookshelfRegex = new RegExp("Bookshelves/", "i");
        let courseRegex = new RegExp("Courses/", "i");
        if (bookshelfRegex.test(foundPath)) {
          let intraShelfPath = foundPath.replace(bookshelfRegex, "");
          let pathComponents = intraShelfPath.split("/");
          if (Array.isArray(pathComponents) && pathComponents.length > 1) {
            let mainShelf = decodeURIComponent(pathComponents[0]).replace(
              /_/g,
              " "
            );
            if (pathComponents.length > 2) {
              mainShelf += `/${decodeURIComponent(pathComponents[1]).replace(
                /_/g,
                " "
              )}`;
            }
            textInfo.shelf = mainShelf;
          }
        } else if (courseRegex.test(foundPath)) {
          let intraShelfPath = foundPath.replace(courseRegex, "");
          let pathComponents = intraShelfPath.split("/");
          if (Array.isArray(pathComponents) && pathComponents.length > 0) {
            textInfo.campus = decodeURIComponent(pathComponents[0]).replace(
              /_/g,
              " "
            );
          }
        }
      }
    }
    return textInfo;
  } catch (err) {
    debugError(err);
    return textInfo;
  }
}

/**
 * Takes an array of files and only returns those which requesting user
 * has access to view or modify. Inteded for internal middleware-like use.
 *
 * @param {string} projectID - LibreTexts standard project identifier
 * @param {array} files - Array of files to be filtered
 * @param {boolean} [publicOnly=false] - Return only public files, regardless of user access level
 * @param {string} [userID=''] - UUID of the user initiating request (if provided)
 * @returns {Promise<object[]|null>} Filtered project files, or null if error occured
 */
export async function filterFilesByAccess(
  projectID: string,
  files: FileInterface[],
  publicOnly = false,
  userID = ""
) {
  const authorizedLevels = ["public", "mixed"]; // Base Levels
  if (publicOnly) {
    return files.filter(
      (file) => file.access && authorizedLevels.includes(file.access)
    );
  }

  if (userID) {
    const user = await User.findOne({ uuid: userID });
    if (user) {
      authorizedLevels.push("users");

      let foundProject: ProjectInterface | null = null;
      if (typeof projectID === "string") {
        foundProject = await Project.findOne({ projectID: projectID });
      } else if (typeof projectID === "object") {
        foundProject = projectID;
      }

      if (
        foundProject &&
        projectsAPI.checkProjectMemberPermission(foundProject, user)
      ) {
        authorizedLevels.push("team");
      }

      if (await usersAPI.checkVerifiedInstructorStatus(userID)) {
        authorizedLevels.push("instructors");
      }
    }
  }
  return files.filter(
    (file) => file.access && authorizedLevels.includes(file.access)
  );
}

/**
 * Retrieves all Project Files for a Project stored in the database as a flat array.
 * Generally reserved for internal use.
 *
 * @param {string} projectID - LibreTexts standard project identifier
 * @param {boolean} [publicOnly=false] - Only return public files regardless of user access
 * @param {string} [userID=''] - Uuid of user initiating request (if provided)
 * @returns {Promise<object[]|null>} All Project Files listings, or null if error encountered.
 */
export async function retrieveAllProjectFiles(
  projectID: string,
  publicOnly = false,
  userID = ""
) {
  try {
    const projectResults = await Project.aggregate<ProjectInterface>([
      {
        $match: { projectID },
      },
      {
        $unwind: {
          path: "$files",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          files: {
            createdDate: { $dateToString: { date: "$files._id" } },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          let: { createdBy: "$files.createdBy" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$uuid", "$$createdBy"] },
              },
            },
            {
              $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
              },
            },
          ],
          as: "files.uploader",
        },
      },
      {
        $lookup: {
          from: "fileassettags",
          localField: "files._id",
          foreignField: "fileID",
          as: "files.tags",
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "files.tags.tags",
          foreignField: "_id",
          pipeline: [
            {
              $lookup: {
                from: "assettagframeworks",
                localField: "framework",
                foreignField: "_id",
                pipeline: [
                  // Go through each template in framework and lookup key
                  {
                    $unwind: {
                      path: "$templates",
                      preserveNullAndEmptyArrays: true,
                    },
                  },
                  {
                    $lookup: {
                      from: "assettagkeys",
                      let: { key: "$templates.key" },
                      pipeline: [
                        {
                          $match: {
                            $expr: { $eq: ["$_id", "$$key"] },
                          },
                        },
                      ],
                      as: "key",
                    },
                  },
                  {
                    $set: {
                      "templates.key": {
                        $arrayElemAt: ["$key", 0],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$_id",
                      uuid: { $first: "$uuid" },
                      name: { $first: "$name" },
                      description: { $first: "$description" },
                      enabled: { $first: "$enabled" },
                      orgID: { $first: "$orgID" },
                      templates: { $push: "$templates" },
                    },
                  },
                ],
                as: "framework",
              },
            },
            {
              $set: {
                framework: {
                  $arrayElemAt: ["$framework", 0],
                },
              },
            },
            {
              $lookup: {
                from: "assettagkeys",
                localField: "key",
                foreignField: "_id",
                as: "key",
              },
            },
            {
              $set: {
                key: {
                  $arrayElemAt: ["$key", 0],
                },
              },
            },
          ],
          as: "files.tags",
        },
      },
      {
        //filter asset tags where isDeleted = true
        $set: {
          "files.tags": {
            $filter: {
              input: "$files.tags",
              as: "tag",
              cond: { $ne: ["$$tag.isDeleted", true] },
            },
          },
        },
      },
      {
        $addFields: {
          "files.uploader": {
            $arrayElemAt: ["$files.uploader", 0],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          files: { $push: "$files" },
        },
      },
    ]);
    if (projectResults.length < 1) {
      throw new Error("Project not found.");
    }
    const project = projectResults[0];

    if (!Array.isArray(project.files)) {
      return [];
    }

    const sorted = (
      await filterFilesByAccess(projectID, project.files, publicOnly, userID)
    ).sort((a, b) => {
      if ((a.name ?? "") < (b.name ?? "")) {
        return -1;
      }
      if ((a.name ?? "") > (b.name ?? "")) {
        return 1;
      }
      return 0;
    });
    return sorted;
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Retrieves a list of Project Files for a Project in hierarchical format.
 *
 * @param {string} projectID - The LibreTexts standard project identifier.
 * @param {string} [folderID=''] - The folder identifier to restrict the search to, if desired.
 * @param {boolean} [publicOnly=false] - Only return Public files regardless of user access level
 * @param {string} [userID=''] - Uuid of user initating request (if provided)
 * @param {boolean} [details=false] - Include additional details about each file, such as uploader.
 * @returns {Promise<[object[], object[]]|[null, null]>} A 2-tuple containing the list of files and the path
 * leading to the results, or nulls if error encountered.
 */
export async function retrieveProjectFiles(
  projectID: string,
  folderID = "",
  publicOnly = false,
  userID = "",
  details = false
) {
  try {
    const path: FileInterfacePath[] = [
      {
        fileID: "",
        name: "",
      },
    ];

    const allFiles = await retrieveAllProjectFiles(
      projectID,
      publicOnly,
      userID
    );

    if (!allFiles) {
      throw new Error("retrieveerror");
    }
    if (allFiles.length === 0) {
      return [[], path];
    }

    const foundItems = [];
    if (folderID) {
      foundItems.push(...allFiles.filter((obj) => obj.parent === folderID));
    } else {
      foundItems.push(...allFiles.filter((obj) => !obj.parent));
    }

    const sortedResults = sortProjectFiles(
      foundItems.map((obj) => _buildChildList(obj, allFiles))
    );

    let finalPath;
    if (folderID) {
      const folder = allFiles.find((obj) => obj.fileID === folderID);
      if (!folder) {
        return [null, null];
      }
      finalPath = [...path, ..._buildParentPath(folder, allFiles)];
    }

    return [sortedResults, finalPath ?? path];
  } catch (e) {
    debugError(e);
    return [null, null];
  }
}

/**
 * Retrieves a list of Project Files for a Project in hierarchical format.
 *
 * @param {string} projectID - The LibreTexts standard project identifier.
 * @param {string} fileID - The file identifier to get.
 * @param {boolean} [publicOnly=false] - Only return Public files regardless of user access level
 * @param {string} [userID=''] - Uuid of user initating request (if provided)
 * @param {boolean} [details=false] - Include additional details about each file, such as uploader.
 * @returns {Promise<[object, object[]]|[null, null]>} A 2-tuple containing the list of files and the path
 * leading to the results, or nulls if error encountered.
 */
export async function retrieveSingleProjectFile(
  projectID: string,
  folderID: string,
  publicOnly = false,
  userID = "",
  details = false
): Promise<[RawFileInterface, FileInterfacePath[]] | [null, null]> {
  try {
    const allFiles = await retrieveAllProjectFiles(
      projectID,
      publicOnly,
      userID
    );

    if (!allFiles || allFiles.length === 0) {
      throw new Error("retrieveerror");
    }

    const foundItem = allFiles.find((obj) => obj.fileID === folderID);
    if (!foundItem) {
      return [null, null];
    }

    if (!details) {
      delete foundItem["createdBy"];
      delete foundItem["downloadCount"];
      delete foundItem["createdBy"];
    }

    const withChildren = _buildChildList(foundItem, allFiles);
    const path = _buildParentPath(foundItem, allFiles);

    return [
      withChildren,
      [
        {
          fileID: "",
          name: "",
        },
        ...path,
      ],
    ];
  } catch (e) {
    debugError(e);
    return [null, null];
  }
}

const _buildParentPath = (obj: FileInterface, allFiles: FileInterface[]) => {
  let pathNodes: FileInterfacePath[] = [];
  pathNodes.push({
    fileID: obj.fileID,
    name: obj.name ?? "",
  });
  if (obj.parent !== "") {
    const parent = allFiles.find((pParent) => pParent.fileID === obj.parent);
    if (parent) {
      pathNodes = [..._buildParentPath(parent, allFiles), ...pathNodes];
    }
  }
  return pathNodes;
};

const _buildChildList = (
  obj: FileInterface,
  allFiles: FileInterface[],
  details = false
) => {
  let children: RawFileInterface[] = [];
  if (!details) {
    delete obj["createdBy"];
    delete obj["downloadCount"];
    delete obj["createdBy"];
  }
  if (obj.storageType !== "folder") {
    return obj;
  }
  const foundChildren = allFiles.filter(
    (childObj) => childObj.parent === obj.fileID
  );
  if (foundChildren.length > 0) {
    children = foundChildren.map((childObj) =>
      _buildChildList(childObj, allFiles)
    );
    children = sortProjectFiles(children);
  }

  return {
    ...obj,
    children,
  };
};

/**
 * Generates a pre-signed download URL for a Project File, if access settings allow.
 *
 * @param {string} projectID - Identifier of the project to search in.
 * @param {string[]} fileIDs - Array of identifiers of files in the Project's files list.
 * @param {boolean} [publicOnly=false] - Only return file if public regardless of user access level
 * @param {string?} [userID=''] - Uuid of user initiating request (if provided)
 * @returns {Promise<string[]|null|false>} The pre-signed url or null if not found,
 */
export async function downloadProjectFiles(
  projectID: string,
  fileIDs: string[],
  publicOnly = false,
  userID = "",
  shouldIncrement = true
): Promise<string[] | null> {
  try {
    if (
      !process.env.AWS_PROJECTFILES_DOMAIN ||
      !process.env.AWS_PROJECTFILES_KEYPAIR_ID ||
      !process.env.AWS_PROJECTFILES_CLOUDFRONT_PRIVKEY
    ) {
      throw new Error("Missing ENV variables");
    }

    const allFiles = await retrieveAllProjectFiles(
      projectID,
      publicOnly,
      userID
    );
    if (!allFiles) {
      // error encountered
      throw new Error("retrieveerror");
    }

    const foundFiles = allFiles.filter((obj) => fileIDs.includes(obj.fileID));
    if (!foundFiles || foundFiles.length < 1) {
      return null;
    }

    // If any of the files are URLs, return them as-is
    const urlsAsFiles = foundFiles.filter((obj) => obj.storageType === "file" && obj.isURL && obj.url);

    const signedURLs: string[] = [];
    signedURLs.push(
      ...urlsAsFiles.map((obj) => obj.url as string)
    );

    const exprDate = new Date();
    exprDate.setDate(exprDate.getDate() + 7); // 1-week expiration time
    const privKey = base64.decode(
      process.env.AWS_PROJECTFILES_CLOUDFRONT_PRIVKEY
    );

    for (const f of foundFiles) {
      const fileURL = assembleUrl([
        "https://",
        process.env.AWS_PROJECTFILES_DOMAIN,
        projectID,
        f.fileID,
      ]);

      const signedURL = getSignedUrl({
        url: fileURL,
        keyPairId: process.env.AWS_PROJECTFILES_KEYPAIR_ID,
        dateLessThan: exprDate.toString(),
        privateKey: privKey,
      });
      signedURLs.push(signedURL);
    }

    if (shouldIncrement) {
      /* Update download count */
      const updated = allFiles.map((obj) => {
        if (fileIDs.includes(obj.fileID)) {
          let downloadCount = 1;
          if (typeof obj.downloadCount === "number") {
            downloadCount = obj.downloadCount + 1;
          }

          return {
            ...obj,
            downloadCount,
          };
        }
        return obj;
      });

      const projectUpdate = await updateProjectFiles(projectID, updated);
      if (!projectUpdate) {
        debugError(
          `Error occurred updating ${projectID} file(s) download count.`
        );
      }
    }

    return signedURLs;
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Computes the access settings of folder within a Project Files file system.
 * Does not update the database.
 *
 * @param {object[]} files - The full array of Files, with any access updates applied.
 * @returns {object[]} The array of Files with folder access settings fully computed.
 */
export function computeStructureAccessSettings(files: FileInterface[]) {
  const toUpdate: RawFileInterface[] = [];

  const computeFolderAccess = (folder: FileInterface): FileInterfaceAccess => {
    const uniqueSettings = new Set<FileInterfaceAccess>();
    if (!folder.access) return "team"; // default to team if no access set
    uniqueSettings.add(folder.access);
    const children = files.filter((obj) => obj.parent === folder.fileID);
    children.forEach((child) => {
      if (child.storageType === "file" && child.access) {
        uniqueSettings.add(child.access);
      }
      if (child.storageType === "folder") {
        const folderAccess = computeFolderAccess(child);
        if (folderAccess) uniqueSettings.add(folderAccess);
      }
    });
    const foundSettings = Array.from(uniqueSettings);
    let newSetting = null;
    if (foundSettings.length > 1) {
      newSetting = "mixed";
    }
    if (foundSettings.length === 1) {
      newSetting = foundSettings[0];
    }
    if (
      newSetting &&
      isFileInterfaceAccess(newSetting) &&
      newSetting !== folder.access
    ) {
      toUpdate.push({
        ...folder,
        access: newSetting,
      });
      return newSetting;
    }
    return folder.access;
  };

  const topLevel = files.filter(
    (obj) => obj.storageType === "folder" && obj.parent === ""
  );
  topLevel.forEach((obj) => computeFolderAccess(obj));

  return files.map((obj) => {
    const foundUpdate = toUpdate.find((upd) => upd.fileID === obj.fileID);
    if (foundUpdate) {
      return foundUpdate;
    }
    return obj;
  });
}

/**
 * Stores an update to a Project's files array in the database.
 *
 * @param {string} projectID - Identifier of the Project to update.
 * @param {object[]} updatedFiles - The full array of Files, with updated entries.
 * @return {Promise<boolean>} True if successful, false otherwise.
 */
export async function updateProjectFiles(
  projectID: string,
  files: (RawFileInterface | FileInterface)[]
): Promise<boolean> {
  try {
    await Project.updateOne({ projectID }, { files });
    return true;
  } catch (e) {
    debugError(e);
    return false;
  }
}

/**
 * Sorts an array of Project Files based on the name of each entry, in natural alphanumeric order.
 *
 * @param {object[]} arr - Array of Files entries.
 * @returns {RawFileInterface[] | FileInterface[]} The sorted array.
 */
export function sortProjectFiles(arr: (RawFileInterface | FileInterface)[]) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  const collator = new Intl.Collator();
  return arr.sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
}

/**
 * Checks if any project exists with the given book associated with it.
 * If another project has the book linked, returns the projectID, otherwise false (true if error encountered)
 * @param {string} libreLibrary
 * @param {string} libreCoverID
 * @returns {Promise<string | boolean>}
 */
export async function checkIfBookLinkedToProject(
  libreLibrary: string,
  libreCoverID: string
) {
  try {
    if (!(libreLibrary && libreCoverID)) {
      throw new Error("Invalid params passed to checkIfBookLinkedToProject");
    }
    const foundProjects = await Project.find({
      $and: [{ libreLibrary }, { libreCoverID }],
    });

    if (foundProjects && foundProjects.length > 0) {
      return foundProjects[0].projectID;
    } else if (foundProjects && foundProjects.length === 0) {
      return false;
    } else {
      return true;
    }
  } catch (err) {
    debugError(err);
    return true;
  }
}

export async function generateZIPFile(
  items: { name: string; data: Uint8Array }[]
): Promise<string | null> {
  try {
    const zip = new AdmZip();
    for (let i = 0; i < items.length; i++) {
      const buffer = Buffer.from(items[i].data);
      zip.addFile(items[i].name, buffer);
    }

    const dirName = `${process.cwd()}/temp`;
    await fs.ensureDir(dirName); // ensure temp directory exists

    const path = `${dirName}/${v4()}.zip`;
    await zip.writeZipPromise(path);

    return path;
  } catch (err) {
    debugError(err);
    return null;
  }
}
