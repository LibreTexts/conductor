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
import ProjectFile, {
  ProjectFileInterface,
  ProjectFileInterfaceAccess,
  ProjectFileInterfacePath,
  RawProjectFileInterface,
  PROJECT_FILES_ACCESS_SETTINGS
} from "../models/projectfile.js";
import AdmZip from "adm-zip";
import { v4 } from "uuid";
import { AssetTagInterface } from "../models/assettag.js";
import { AssetTagTemplateWithKey, AssetTagWithFramework, AssetTagWithFrameworkAndKey } from "../types/AssetTags.js";
import { AssetTagFrameworkInterface } from "../models/assettagframework.js";
import { isAssetTagFrameworkObject, isAssetTagKeyObject } from "./typeHelpers.js";
import { sortXByOrderOfY } from "./assettaggingutils.js";
import { AssetTagTemplateInterface } from "../models/assettagtemplate.js";
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, GetObjectAttributesCommand, GetObjectCommand, GetObjectCommandOutput, HeadObjectCommand, HeadObjectCommandOutput, PutObjectCommand, S3Client, S3ClientConfig, ServiceOutputTypes, UploadPartCommand } from "@aws-sdk/client-s3";
import mailAPI from "../api/mail.js";
import { CXOneFetch, getLibUsers, getLibreBotUserId } from "./librariesclient.js";
import MindTouch from "./CXOne/index.js";
import { URLSearchParams } from "url";

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

export const PROJECT_FILES_S3_CLIENT_CONFIG: S3ClientConfig = {
  credentials: {
    accessKeyId: process.env.AWS_PROJECTFILES_ACCESS_KEY ?? "",
    secretAccessKey: process.env.AWS_PROJECTFILES_SECRET_KEY ?? "",
  },
  region: process.env.AWS_PROJECTFILES_REGION,
};


export const PROJECT_THUMBNAILS_S3_CLIENT_CONFIG = {
  credentials: {
    accessKeyId: process.env.AWS_PROJECT_THUMBNAILS_ACCESS_KEY ?? "",
    secretAccessKey: process.env.AWS_PROJECT_THUMBNAILS_SECRET_KEY ?? "",
  },
  region: process.env.AWS_PROJECT_THUMBNAILS_REGION ?? "",
};

export const isProjectFileInterfaceAccess = (
  access: string
): access is ProjectFileInterfaceAccess => {
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

export const validateDefaultFileLicense = (obj: object): boolean => {
  if(!obj || typeof obj !== 'object') {
    return false;
  }
  
  // Only check if name is present for now
  if(!('name' in obj) || typeof obj.name !== 'string') {
    return false;
  }

  if('url' in obj && typeof obj.url !== 'string') {
    return false;
  }
  if('version' in obj && typeof obj.version !== 'string') {
    return false;
  }
  if('sourceURL' in obj && typeof obj.sourceURL !== 'string') {
    return false;
  }
  if('modifiedFromSource' in obj && typeof obj.modifiedFromSource !== 'boolean') {
    return false;
  }
  return true;
}

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
  files: (RawProjectFileInterface | ProjectFileInterface)[],
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

export async function getProjectFiles(
  projectID: string,
  fileIDs: string[],
  publicOnly = false,
  userID = ""
){
  try {
    const results = await ProjectFile.aggregate<ProjectFileInterface>(
      [
        {
          $match: {
            projectID,
            fileID: { $in: fileIDs },
            ...(publicOnly ? { access: "public" } : {}),
          }
        },
        ...RETRIEVE_PROJECT_FILES_AGGREGATION
      ]
    );

    if (!Array.isArray(results)) {
      return [];
    }

    const sorted = (
      await filterFilesByAccess(projectID, results, publicOnly, userID)
    ).sort((a, b) => {
      if ((a.name ?? "") < (b.name ?? "")) {
        return -1;
      }
      if ((a.name ?? "") > (b.name ?? "")) {
        return 1;
      }
      return 0;
    });

    for(const file of sorted) {
      // @ts-ignore
      if(!file.tags || file.tags.length === 0) {
        continue;
      }
      //@ts-ignore
      file.tags = _sortTagsLikeTheirFrameworks(file.tags);
    }

    return sorted;
  } catch (err){
    debugError(err);
    return null;
  }
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
    const results = await ProjectFile.aggregate<ProjectFileInterface>(
      [
        {
          $match: {
            projectID,
            ...(publicOnly ? { access: "public" } : {}),
          }
        },
        ...RETRIEVE_PROJECT_FILES_AGGREGATION
      ]
    );

    if (!Array.isArray(results)) {
      return [];
    }

    const sorted = (
      await filterFilesByAccess(projectID, results, publicOnly, userID)
    ).sort((a, b) => {
      if ((a.name ?? "") < (b.name ?? "")) {
        return -1;
      }
      if ((a.name ?? "") > (b.name ?? "")) {
        return 1;
      }
      return 0;
    });

    for(const file of sorted) {
      // @ts-ignore
      if(!file.tags || file.tags.length === 0) {
        continue;
      }
      //@ts-ignore
      file.tags = _sortTagsLikeTheirFrameworks(file.tags);
    }

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
 * @returns {Promise<[object[], object[]]|[null, null]>} A 2-tuple containing the list of files and the path
 * leading to the results, or nulls if error encountered.
 */
export async function getFolderContents(
  projectID: string,
  folderID: string,
  publicOnly = false,
  userID = ""
) {
  try {
    if(publicOnly === false && !userID) {
      throw new Error('User ID required for non-public file retrieval');
    }

    const ROOT_PATH: ProjectFileInterfacePath[] = [
      {
        fileID: "",
        name: "",
      },
    ];

    let thisFolder: ProjectFileInterface | null = null;
    if(folderID !== "") {
      // We need to know the name of the current folder for the path
      thisFolder = await ProjectFile.findOne({
        projectID,
        fileID: folderID,
      });
      if (!thisFolder) {
        throw new Error("foldererror");
      }
    }

    const foundItems = await ProjectFile.aggregate<ProjectFileInterface>(
      [
        {
          $match: {
            projectID,
            parent: folderID,
            ...(publicOnly ? { access: "public" } : {}),
          }
        },
        ...RETRIEVE_PROJECT_FILES_AGGREGATION
      ]
    )

    if (!foundItems) {
      throw new Error("retrieveerror");
    }
    if (foundItems.length === 0) {
      const finalPath = [...ROOT_PATH];
      if(folderID !== "") {
        finalPath.push({
          fileID: folderID,
          name: thisFolder?.name ?? "",
        });
      }
      return [[], finalPath];
    }

    const sortedResults = sortProjectFiles(foundItems);
    const accessFiltered = [];

    // If not public only, then user ID is required - filter by access
    if(!publicOnly) {
      const filtered = await filterFilesByAccess(projectID, sortedResults, publicOnly, userID);
      accessFiltered.push(...filtered);
    } else {
      accessFiltered.push(...sortedResults);
    }

    if(folderID === "") { // Root folder
      return [accessFiltered, ROOT_PATH];
    }


    // get parents as {fileID, name} objects
    const parentPath = await ProjectFile.aggregate<ProjectFileInterface>([
      {
        $match: {
          projectID,
          fileID: folderID,
        }
      },
      {
        $graphLookup: {
          from: "projectfiles",
          startWith: "$parent",
          connectFromField: "parent",
          connectToField: "fileID",
          as: "path",
        },
      },
      {
        $unwind: "$path",
      },
      {
        $replaceRoot: {
          newRoot: "$path",
        },
      },
      {
        $project: {
          fileID: 1,
          name: 1,
        },
      },
      {
        $sort: {
          fileID: -1,
        },
      },
    ]) as ProjectFileInterfacePath[];

    const finalPath = [...ROOT_PATH, ...parentPath];

    // Push the current folder info to the path
    finalPath.push({
      fileID: folderID,
      name: thisFolder?.name ?? "",
    });

    return [accessFiltered, finalPath];
  } catch (e) {
    debugError(e);
    return [null, null];
  }
}

export async function getProjectFileS3Metadata(projectID: string, fileID: string): Promise<HeadObjectCommandOutput | null> {
  try {
    // @ts-ignore
    const s3 = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);
    const fileKey = `${projectID}/${fileID}`;
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_PROJECTFILES_BUCKET ?? "",
      Key: fileKey,
    });
    const res = await s3.send(command);
    return res;
  } catch (err) {
    debugError(err);
    return null;
  }
}

function _sortTagsLikeTheirFrameworks(paramTags: AssetTagWithFrameworkAndKey[]) {
  const tags = [...paramTags];
  if (!tags || tags.length === 0) return paramTags;
  const allFrameworksInTags = tags.reduce(
    (acc: AssetTagFrameworkInterface[], curr: AssetTagWithFramework) => {
      if (!isAssetTagFrameworkObject(curr.framework)) return acc;
      if (
        curr.framework &&
        !acc.map((a) => a.uuid).includes(curr.framework.uuid)
      ) {
        return [...acc, curr.framework];
      }
      return acc;
    },
    []
  );

  const _sortTagsByFrameworkTemplates = (x: AssetTagWithFrameworkAndKey[], y: AssetTagTemplateWithKey[]): AssetTagWithFramework[] => {

    //Filter out tags that don't have a key (all tags should have a key, but just in case)
    x = x.filter((tag) => tag.key);
    y = y.filter((template) => template.key);

    // Create a map of elements in array Y to their indices
    const mapY = new Map<string, number>();
    y.forEach((element, index) => {
      mapY.set(element.key.title, index);
    });
  
    // Sort array X based on the order in array Y
    x.sort((a, b) => {
      const indexA = mapY.has(isAssetTagKeyObject(a.key) ? a.key.title : a.key) ? mapY.get(isAssetTagKeyObject(a.key) ? a.key.title : a.key) : Infinity;
      const indexB = mapY.has(isAssetTagKeyObject(b.key) ? b.key.title : b.key) ? mapY.get(isAssetTagKeyObject(b.key) ? b.key.title : b.key) : Infinity;
      if(!indexA || !indexB) {
        return 0;
      }
      return indexA - indexB;
    });
  
    return x;
  }

  const endResult = [];
  for (const framework of allFrameworksInTags) {
    const tagsForFramework = tags.filter(
      (t) => isAssetTagFrameworkObject(t.framework) && t.framework.uuid === framework.uuid
    );
    const sortedTags = _sortTagsByFrameworkTemplates(
      [...tagsForFramework],
      framework.templates as unknown as AssetTagTemplateWithKey[]
    );
    endResult.push(...sortedTags);
  }

  const tagsWithoutFrameworks = tags.filter((t) => !t.framework); // Append tags without frameworks to the end
  endResult.push(...tagsWithoutFrameworks);
  return endResult;
}

const _buildChildList = (
  obj: ProjectFileInterface,
  allFiles: ProjectFileInterface[],
  details = false
) => {
  let children: RawProjectFileInterface[] = [];
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

    const foundFiles = await getProjectFiles(
      projectID,
      fileIDs,
      publicOnly,
      userID
    );
    if (!foundFiles || foundFiles.length === 0) {
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

      const params = new URLSearchParams();
      const version = f.version ?? 1;
      params.append("v", version.toString());

      const signedURL = getSignedUrl({
        url: fileURL + `?${params.toString()}`,
        keyPairId: process.env.AWS_PROJECTFILES_KEYPAIR_ID,
        dateLessThan: exprDate.toString(),
        privateKey: privKey,
      });
      signedURLs.push(signedURL);
    }

    if(!shouldIncrement){
      return signedURLs;
    }

    const updateDocs = foundFiles.map((file) => {
      return {
        ...file,
        downloadCount: file.downloadCount ?? 0 + 1,
      };
    }
    );

    const updateRes = await ProjectFile.bulkWrite(
      updateDocs.map((file) => {
        return {
          updateOne: {
            filter: {
              projectID,
              fileID: file.fileID,
            },
            update: {
              ...file,
            },
          },
        };
      })
    );

    if (!updateRes.isOk) {
      // Silent fail
      debugError(
        `Error occurred updating ${projectID} file(s) download count.`
      );
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
export function computeStructureAccessSettings(files: ProjectFileInterface[]) {
  const toUpdate: RawProjectFileInterface[] = [];

  const computeFolderAccess = (folder: ProjectFileInterface): ProjectFileInterfaceAccess => {
    const uniqueSettings = new Set<ProjectFileInterfaceAccess>();
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
      isProjectFileInterfaceAccess(newSetting) &&
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
  files: (RawProjectFileInterface | ProjectFileInterface)[]
): Promise<boolean> {
  try {
    // TODO: Update files individually, not with bulkWrite
    await ProjectFile.bulkWrite(
      files.map((file) => {
        return {
          updateOne: {
            filter: {
              projectID,
              fileID: file.fileID,
            },
            update: {
              ...file,
            },
          },
        };
      })
    );
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
 * @returns {RawProjectFileInterface[] | ProjectFileInterface[]} The sorted array.
 */
export function sortProjectFiles(arr: (RawProjectFileInterface | ProjectFileInterface)[]) {
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
): Promise<Buffer | null> {
  try {
    const zip = new AdmZip();

    for (let i = 0; i < items.length; i++) {
      const buffer = Buffer.from(items[i].data);
      zip.addFile(items[i].name, buffer);
      console.log('[SYSTEM] Added file to ZIP: ' + items[i].name)
    }

    const buffer = await zip.toBufferPromise();
    return buffer
  } catch (err) {
    debugError(err);
    return null;
  }
}

export async function parseAndZipS3Objects(
  s3Res: GetObjectCommandOutput[],
  files: (RawProjectFileInterface | ProjectFileInterface)[]
): Promise<Buffer | null> {
  try {
    const items = [];
    for (let i = 0; i < s3Res.length; i++) {
      const byteArray = await s3Res[i].Body?.transformToByteArray();

      if (files[i]) {
        items.push({
          name: files[i].name,
          data: byteArray,
        });
      } else {
        items.push({
          name: v4(), // Fallback to random name
          data: byteArray,
        });
      }
    }
  
    const noUndefined = items.filter((item) => item.name && item.data) as {
      name: string;
      data: Uint8Array;
    }[];
 
    const zipBuff = await generateZIPFile(noUndefined);
    return zipBuff ?? null;  
  } catch (e) {
    debugError(e);
    return null;
  }
}

/**
 * Downloads and zips files from S3.
 * Sends an email to the user when the zip file is ready with a signed Cloudfront url.
 * 
 * @param projectID - The project ID to download files from
 * @param fileKeys - The file keys to download
 * @param allFiles - All relevant files in the project
 * @param emailToNotify - The email to notify when the zip file is ready
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function createZIPAndNotify(
  fileKeys: string[],
  allFiles: (RawProjectFileInterface | ProjectFileInterface)[],
  emailToNotify: string
): Promise<boolean> {
  try {
    // @ts-ignore
    const storageClient = new S3Client(PROJECT_FILES_S3_CLIENT_CONFIG);

    const downloadCommands: GetObjectCommand[] = [];
    fileKeys.forEach(async (key) => {
      downloadCommands.push(
        new GetObjectCommand({
          Bucket: process.env.AWS_PROJECTFILES_BUCKET,
          Key: key,
        })
      );
    });

    const downloadRes = await Promise.all(
      downloadCommands.map((command) => storageClient.send(command))
    );

    const zipBuff = await parseAndZipS3Objects(downloadRes, allFiles);
    if (!zipBuff) throw new Error("Zip path is undefined");


    const tempFileID = v4();
    const tempFileKey = `temp/${tempFileID}.zip`;
    const multipartUpload = await storageClient.send(new CreateMultipartUploadCommand({
      Bucket: process.env.AWS_PROJECTFILES_BUCKET,
      Key: tempFileKey,
      ContentDisposition: `inline; filename=${tempFileID}.zip`,
      ContentType: "application/zip",
    }));

    if(!multipartUpload.UploadId) {
      throw new Error('Upload ID is undefined');
    }

    console.log('[SYSTEM] Created multipart upload with ID: ' + multipartUpload.UploadId)

    // chunk zip buffer into 5MB chunks
    const chunkSize = 5 * 1024 * 1024;
    const chunks = [];
    for(let i = 0; i < zipBuff.length; i += chunkSize) {
      chunks.push(zipBuff.slice(i, i + chunkSize));
    }
    const uploadCommands: UploadPartCommand[] = [];
    for(let i = 0; i < chunks.length; i++) {
      uploadCommands.push(new UploadPartCommand({
        Bucket: process.env.AWS_PROJECTFILES_BUCKET,
        Key: tempFileKey,
        UploadId: multipartUpload.UploadId,
        PartNumber: i + 1,
        Body: chunks[i]
      }));
    }

    const uploadRes = []
    for(let i = 0; i < uploadCommands.length; i++) {
      const s3Res = await storageClient.send(uploadCommands[i], { requestTimeout: 240000 });
      uploadRes.push(s3Res);
    }

    if(uploadRes.length !== chunks.length) {
      throw new Error('Upload failed');
    }

    console.log('[SYSTEM] Completing multipart upload')
    const completeUpload = await storageClient.send(new CompleteMultipartUploadCommand({
      Bucket: process.env.AWS_PROJECTFILES_BUCKET,
      Key: tempFileKey,
      UploadId: multipartUpload.UploadId,
      MultipartUpload: {
        Parts: uploadRes.map((res, index) => {
          return {
            ETag: res.ETag,
            PartNumber: index + 1
          }
        })
      }
    }));

    if(!completeUpload.$metadata.httpStatusCode || ![200, 201].includes(completeUpload.$metadata.httpStatusCode)) {
      throw new Error('Upload failed');
    }

    console.log('[SYSTEM] Finished multipart upload')

    // await storageClient.send(
    //   new PutObjectCommand({
    //     Bucket: process.env.AWS_PROJECTFILES_BUCKET,
    //     Key: tempFileKey,
    //     Body: zipBuff,
    //     ContentDisposition: `inline; filename=${tempFileID}.zip`,
    //     ContentType: "application/zip",
    //   }), 
    //   {
    //     requestTimeout: 600000 // 1 minute timeout
    //   }
    // );

    const fileURL = assembleUrl([
      "https://",
      // @ts-ignore
      process.env.AWS_PROJECTFILES_DOMAIN,
      tempFileKey,
    ]);

    const exprDate = new Date();
    exprDate.setDate(exprDate.getDate() + 7); // 1-week expiration time
    const privKey = base64.decode(
      // @ts-ignore
      process.env.AWS_PROJECTFILES_CLOUDFRONT_PRIVKEY
    );

    const signedURL = getSignedUrl({
      url: fileURL,
      // @ts-ignore
      keyPairId: process.env.AWS_PROJECTFILES_KEYPAIR_ID,
      dateLessThan: exprDate.toString(),
      privateKey: privKey,
    });

    await mailAPI.sendZIPFileReadyNotification(signedURL, emailToNotify);
    console.log('[SYSTEM] Sent email to: ' + emailToNotify)
    return true;
  } catch (err) {
    debugError(err);
    return false;
  }
}

export async function updateTeamWorkbenchPermissions(projectID: string, subdomain: string, coverID: string) {
  try {
    if (!projectID) {
      throw new Error("Invalid projectID passed to updateTeamWorkbenchPermissions");
    }

    const project = await Project.findOne({ projectID }).orFail();
    const team = [
      ...project.leads ?? [],
      ...project.liaisons ?? [],
      ...project.members ?? [],
      ...project.auditors ?? [],
    ];

    const conductorUsers = await User.find({ uuid: { $in: team } });
    const centralIDs = conductorUsers
      .filter((user) => user.centralID)
      .map((user) => user.centralID.toString());
    
    const libreBotID = await getLibreBotUserId(subdomain);
    if(!libreBotID) {
      throw new Error("Error getting LibreBot user ID");
    }

    const libUsers = await getLibUsers(subdomain);
    const foundUsers = libUsers.filter((u) =>
      centralIDs.includes(u.username.toString())
    );

    // Get auditors (viewers only)
    const getAuditors = () => {
      if(!project.auditors) {
        return [];
      }

      const originalAuditors = conductorUsers.filter((user) => project.auditors?.includes(user.uuid));
      return foundUsers.filter((u) => originalAuditors.map((a) => a.centralID).includes(u.username));
    }

    const auditors = getAuditors();
    const withoutAuditors = foundUsers.filter((u) => !auditors.map((a) => a.username).includes(u.username));

    const body = MindTouch.Templates.PUT_TeamAsContributors(
      withoutAuditors.map((u) => u.id),
      auditors.map((u) => u.id),
      libreBotID
    );

    const permsRes = await CXOneFetch({
      scope: "page",
      path: coverID,
      api: MindTouch.API.Page.PUT_Security,
      subdomain,
      options: {
        method: "PUT",
        headers: { "Content-Type": "application/xml; charset=utf-8" },
        body: body
      },
      query: {
        cascade: "delta",
      },
    });

    if (!permsRes.ok) {
      throw new Error(
        `Error updating permissions for Workbench project: "${projectID}"`
      );
    }
    return true;
  } catch (err) {
    debugError(err);
    return false;
  }
}

/**
 * Standardized aggregation pipeline for retrieving Project Files.
 * NOTE: A $match stage should be added to the beginning of the pipeline to filter by projectID and/or fileID.
 * No restrictions are made regarding file access levels;
 */
export const RETRIEVE_PROJECT_FILES_AGGREGATION = [
  {
    $addFields: {
        createdDate: { $dateToString: { date: "$_id" } },
    },
  },
  {
    $lookup: {
      from: "users",
      let: { createdBy: "$createdBy" },
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
      as: "uploader",
    },
  },
  {
    $addFields: {
      "uploader": {
        $arrayElemAt: ["$uploader", 0],
      },
    },
  },
  {
    $lookup: {
      from: "projects",
      let: {
        searchID: "$projectID",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $eq: ["$projectID", "$$searchID"],
            },
          },
        },
        {
          $project: {
            title: 1,
            thumbnail: 1,
          },
        },
      ],
      as: "projectInfo",
    },
  },
  {
    $set: {
      projectInfo: {
        $arrayElemAt: ["$projectInfo", 0],
      },
    },
  },
  {
    $lookup: {
      from: "assettags",
      localField: "tags",
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
                  let: {
                    key: "$templates.key",
                  },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: ["$_id", "$$key"],
                        },
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
                  uuid: {
                    $first: "$uuid",
                  },
                  name: {
                    $first: "$name",
                  },
                  description: {
                    $first: "$description",
                  },
                  enabled: {
                    $first: "$enabled",
                  },
                  orgID: {
                    $first: "$orgID",
                  },
                  templates: {
                    $push: "$templates",
                  },
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
      as: "tags",
    },
  },
  {
    $lookup: {
      from: "authors",
      localField: "authors",
      foreignField: "_id",
      as: "authors",
    },
  },
  {
    $lookup: {
      from: "authors",
      localField: "primaryAuthor",
      foreignField: "_id",
      as: "primaryAuthor",
    }
  },
  {
    $set: {
      primaryAuthor: {
        $arrayElemAt: ["$primaryAuthor", 0],
      },
    },
  },
  {
    $lookup: {
      from: "authors",
      localField: "correspondingAuthor",
      foreignField: "_id",
      as: "correspondingAuthor",
    }
  },
  {
    $set: {
      correspondingAuthor: {
        $arrayElemAt: ["$correspondingAuthor", 0],
      },
    },
  }
];