//
// LibreTexts Conductor
// projectutils.js
//
import axios from 'axios';
import { stringContainsOneOfSubstring, getProductionURL, assembleUrl } from './helpers.js';
import { libraryNameKeys } from './librariesmap.js';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { debugError } from '../debug.js';
import Project from '../models/project.js';
import base64 from 'base-64';

export const projectClassifications = [
    'harvesting',
    'curation',
    'construction',
    'technology',
    'librefest',
    'coursereport',
    'adoptionrequest',
    'miscellaneous'
];

export const constrRoadmapSteps = [
    '1', '2', '3', '4', '5a', '5b', '5c', '6', '7', '8', '9', '10', '11', '12'
];

export const textUseOptions = [
    { key: 'empty', text: 'Clear...', value: '' },
    { key: 'primary', text: 'As the primary textbook', value: 'primary' },
    { key: 'supplement', text: 'As supplementary material', value: 'supplement' },
    { key: 'remix', text: 'As part of a remix that I am creating for my class', value: 'remix' },
    { key: 'other', text: 'Other (please explain in comments)', value: 'other' },
];

export const progressThreadDefaultMessage = `*This thread was automatically created by Conductor. Use it to discuss your project's progress, or create another to the left!*`;

export const projectWelcomeMessage = `Welcome to your new Conductor project!
The Conductor is an increasingly powerful project planning and curation tool. If your text is available on the LibreTexts bookshelves, it is also listed on Commons. Using Conductor, you can collect and curate Peer Reviews to continuously improve the quality of your new resource. Conductor also provides a place for your ancillary materials such as slide decks, a syllabus, notes, etc., all of which can be public (available to all) or restricted to instructors. You can use the *Accessibility* tab of your new project or our Accessibility Checker tool in the library editor to ensure your resource is available to all readers.
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

export const PROJECT_FILES_ACCESS_SETTINGS = ['public', 'users', 'team'];

/**
 * Validates that a given classification string is one of the
 * pre-defined, acceptable classifications.
 * @param {String} classification  - the classification string to test
 * @returns {Boolean} true if valid classification, false otherwise
 */
export const validateProjectClassification = (classification) => {
    return projectClassifications.includes(classification);
};


/**
 * Validates that a given Construction Roadmap step name is one of the
 * pre-defined, acceptable step names.
 * @param {String} step  - the step name to test
 * @returns {Boolean} true if valid step, false otherwise.
 */
export const validateRoadmapStep = (step) => {
    return constrRoadmapSteps.includes(step);
};


/**
 * Retrieves the UI-ready representation of a Text Use option.
 * @param {String} use - The internal Text Use identifier.
 * @returns {String} The UI-ready representation, or an empty string if not found.
 */
export const getTextUse = (use) => {
    if (use !== '') {
        let foundUse = textUseOptions.find((item) => {
            return item.value === use;
        });
        if (foundUse !== undefined) return foundUse.text;
    } else {
        return '';
    }
};


/**
 * Retrieves basic information about a LibreText and its location via the LibreTexts API.
 * @param {String} url - The LibreTexts url to retrieve information about.
 * @returns {Object} An object with information about the LibreText (lib, id, shelf, campus).
 */
export const getLibreTextInformation = (url) => {
    let textInfo = {
        lib: '',
        id: '',
        shelf: '',
        campus: ''
    }
    return new Promise((resolve, reject) => {
        if (typeof (url) === 'string') {
            let subdomainSearch = stringContainsOneOfSubstring(url, libraryNameKeys, true);
            if (subdomainSearch.hasOwnProperty('substr') && subdomainSearch.substr !== '') {
                textInfo.lib = subdomainSearch.substr;
                let libNames = libraryNameKeys.join('|');
                let libreURLRegex = new RegExp(`(http(s)?:\/\/)?(${libNames}).libretexts.org\/`, 'i');
                let path = url.replace(libreURLRegex, '');
                resolve(axios.put('https://api.libretexts.org/endpoint/info', {
                    subdomain: subdomainSearch.substr,
                    path: path,
                    dreamformat: 'json'
                }, { headers: { 'Origin': getProductionURL() } }));
            }
        }
        reject();
    }).then((axiosRes) => {
        if (axiosRes.data) {
            let apiData = axiosRes.data;
            if (apiData.hasOwnProperty('@id') && typeof (apiData['@id']) === 'string') {
                textInfo.id = apiData['@id'];
            }
            if (apiData.hasOwnProperty('path') && typeof (apiData.path) === 'object') {
                if (apiData.path.hasOwnProperty('#text') && typeof (apiData.path['#text'] === 'string')) {
                    let foundPath = apiData.path['#text'];
                    let bookshelfRegex = new RegExp('Bookshelves\/', 'i');
                    let courseRegex = new RegExp('Courses\/', 'i');
                    if (bookshelfRegex.test(foundPath)) {
                        let intraShelfPath = foundPath.replace(bookshelfRegex, '');
                        let pathComponents = intraShelfPath.split('/');
                        if (Array.isArray(pathComponents) && pathComponents.length > 1) {
                            let mainShelf = decodeURIComponent(pathComponents[0]).replace(/_/g, ' ');
                            if (pathComponents.length > 2) {
                                mainShelf += `/${decodeURIComponent(pathComponents[1]).replace(/_/g, ' ')}`;
                            }
                            textInfo.shelf = mainShelf;
                        }
                    } else if (courseRegex.test(foundPath)) {
                        let intraShelfPath = foundPath.replace(courseRegex, '');
                        let pathComponents = intraShelfPath.split('/');
                        if (Array.isArray(pathComponents) && pathComponents.length > 0) {
                            textInfo.campus = decodeURIComponent(pathComponents[0]).replace(/_/g, ' ');
                        }
                    }
                }
            }

        }
        return textInfo;
    }).catch((_err) => {
        return textInfo;
    });
};

/**
 * Retrieves all Project Files for a Project stored in the database as a flat array.
 * Generally reserved for internal use.
 *
 * @param {string} projectID - LibreTexts standard project identifier
 * @param {boolean} hasTeamPermission - Include files with Project Team Members Only or Superadmin access
 * @returns {Promise<object[]|null>} All Project Files listings, or null if error encountered.
 */
export async function retrieveAllProjectFiles(projectID, hasTeamPermission) {
  try {
    const projectResults = await Project.aggregate([
      {
        $match: { projectID },
      }, {
        $unwind: {
          path: '$files',
          preserveNullAndEmptyArrays: true,
        },
      }, {
        $addFields: {
          files: {
            createdDate: { $dateToString: { date: '$files._id' } },
          },
        },
      }, {
        $lookup: {
          from: 'users',
          let: { createdBy: "$files.createdBy" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$uuid', '$$createdBy' ] },
              }
            }, {
              $project: {
                _id: 0,
                uuid: 1,
                firstName: 1,
                lastName: 1,
              }
            }
          ],
          as: 'files.uploader',
        },
      }, {
        $addFields: {
          'files.uploader': {
            $arrayElemAt: ['$files.uploader', 0],
          },
        },
      }, {
        $group: {
          _id: '$_id',
          files: { $push: '$files' },
        },
      },
    ]);
    if (projectResults.length < 1) {
      throw (new Error('Project not found.'));
    }
    const project = projectResults[0];
    if (!Array.isArray(project.files)) {
      return [];
    }
    
    // If user is not team member, don't return Project Team Member only files
    const accessFiltered = (files) => {
      if(hasTeamPermission) {
        return files;
      } else {
        return files.filter((file) => file.access !== 'team')
      }
    }

    const sorted = accessFiltered(project.files).sort((a, b) => {
      if (a.name < b.name) {
        return -1;
      }
      if (a.name > b.name) {
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
 * @param {string} [filesKey=''] - The folder identifier to restrict the search to, if desired.
 * @param {boolean} hasTeamPermission - Include files with Project Team Members Only or Superadmin access
 * @param {boolean} [publicOnly=false] - Only return Public files regardless of user access level
 * @param {boolean} [details=false] - Include additional details about each file, such as uploader.
 * @returns {Promise<[object[], object[]]|[null, null]>} A 2-tuple containing the list of files and the path
 * leading to the results, or nulls if error encountered.
 */
export async function retrieveProjectFiles(projectID, filesKey = '', hasTeamPermission, publicOnly = false, details = false) {
  try {
    let path = [{
      fileID: '',
      name: '',
    }];

    const allFiles = await retrieveAllProjectFiles(projectID, hasTeamPermission);
    if (!allFiles) {
      throw (new Error('retrieveerror'));
    }
    if (allFiles.length === 0) {
      return [[], path];
    }
    
    const getPublicOnly = (files) => {
      if(publicOnly) {
      return files.filter((file) => ['public', 'mixed'].includes(file.access))
      }
      return files
    }

    const cleanedResults = getPublicOnly(allFiles);

    let foundFolder;
    if (filesKey !== '') {
      foundFolder = cleanedResults.find((obj) => obj.fileID === filesKey);
      if (!foundFolder) {
        return [null, null]
      }
    }
    const foundEntries = cleanedResults.filter((obj) => obj.parent === filesKey);
    const buildParentPath = (obj) => {
      let pathNodes = [];
      pathNodes.push({
        fileID: obj.fileID,
        name: obj.name,
      });
      if (obj.parent !== '') {
        const parent = cleanedResults.find((pParent) => pParent.fileID === obj.parent);
        if (parent) {
          pathNodes = [...buildParentPath(parent), ...pathNodes];
        }
      }
      return pathNodes;
    };

    if (foundFolder) {
      path.push(...buildParentPath(foundFolder));
    }

    const buildChildList = (obj) => {
      const currObj = obj;
      let children = [];
      if (!details) {
        ['_id', 'createdby', 'downloadCount', 'uploader'].forEach((key) => delete currObj[key]);
      }
      if (obj.storageType !== 'folder') {
        return currObj;
      }
      const foundChildren = cleanedResults.filter((childObj) => childObj.parent === currObj.fileID);
      if (foundChildren.length > 0) {
        children = foundChildren.map((childObj) => buildChildList(childObj));
        children = sortProjectFiles(children);
      }
      return {
        ...currObj,
        children,
      }
    };

    const sortedResults = sortProjectFiles(foundEntries.map((obj) => buildChildList(obj)));

    return [sortedResults, path];
  } catch (e) {
    debugError(e);
    return [null, null];
  }
}

/**
 * Generates a pre-signed download URL for a Project File, if access settings allow.
 *
 * @param {string} projectID - Identifier of the project to search in.
 * @param {string} fileID - Identifier of the file in the Project's files list.
 * @param {boolean} hasTeamPermission - Include files with Project Team Members Only or Superadmin access
 * @param {boolean} [publicOnly=false] - Only return file if public regardless of user access level
 * @param {express.Request} req - Original network request object, for determining file access.
 * @returns {Promise<string|null|false>} The pre-signed url or null if not found,
 *  or false if unauthorized.
 */
export async function downloadProjectFile(projectID, fileID, hasTeamPermission, publicOnly = false, req) {
  try {
    const files = await retrieveAllProjectFiles(projectID, hasTeamPermission);
    if (!files) { // error encountered 
      throw (new Error('retrieveerror'));
    }

    const foundFile = files.find((obj) => (
      obj.fileID === fileID && obj.storageType === 'file'
    ));
    if (!foundFile) {
      return null;
    }
    if (foundFile.access === 'users') {
      if (!req.user?.decoded?.uuid) {
        return false;
      }
    }

    //If public only requested and file access does not match, return false
    if(publicOnly && foundFile.access !== 'public') {
      return false
    }

    const fileURL = assembleUrl([
      'https://',
      process.env.AWS_PROJECTFILES_DOMAIN,
      projectID,
      foundFile.fileID,
    ]);
    const exprDate = new Date();
    exprDate.setDate(exprDate.getDate() + 7); // 1-week expiration time
    const privKey = base64.decode(process.env.AWS_PROJECTFILES_CLOUDFRONT_PRIVKEY);

    const signedURL = getSignedUrl({
      url: fileURL,
      keyPairId: process.env.AWS_PROJECTFILES_KEYPAIR_ID,
      dateLessThan: exprDate,
      privateKey: privKey,
    });

    /* Update download count */
    let downloadCount = 1;
    if (typeof (foundFile.downloadCount) === 'number') {
      downloadCount = foundFile.downloadCount + 1;
    }
    const updated = files.map((obj) => {
      if (obj.fileID === foundFile.fileID) {
        return {
          ...obj,
          downloadCount,
        };
      }
      return obj;
    });
    const projectUpdate = await updateProjectFiles(projectID, updated);
    if (!projectUpdate) {
      debugError(`Error occurred updating ${projectID}/${fileID} download count.`);
    }

    return signedURL;
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
export function computeStructureAccessSettings(files) {
  let toUpdate = [];

  const computeFolderAccess = (folder) => {
    const uniqueSettings = new Set();
    uniqueSettings.add(folder.access)
    const children = files.filter((obj) => obj.parent === folder.fileID);
    children.forEach((child) => {
      if (child.storageType === 'file') {
        uniqueSettings.add(child.access);
      }
      if (child.storageType === 'folder') {
        uniqueSettings.add(computeFolderAccess(child));
      }
    });
    const foundSettings = Array.from(uniqueSettings);
    let newSetting = null;
    if (foundSettings.length > 1) {
      newSetting = 'mixed';
    }
    if (foundSettings.length === 1) {
      newSetting = foundSettings[0];
    }
    if (newSetting !== folder.access) {
      toUpdate.push({
        ...folder,
        access: newSetting,
      });
      return newSetting;
    }
    return folder.access;
  };

  const topLevel = files.filter((obj) => obj.storageType === 'folder' && obj.parent === '');
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
export async function updateProjectFiles(projectID, updatedFiles) {
  try {
    await Project.updateOne(
      { projectID },
      { files: updatedFiles },
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
 * @returns {object[]} The sorted array.
 */
export function sortProjectFiles(arr) {
  if (!Array.isArray(arr)) {
    return arr;
  }
  const collator = new Intl.Collator();
  return arr.sort((a, b) => collator.compare(a.name, b.name));
}
