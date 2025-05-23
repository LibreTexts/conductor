import { Request, Response } from "express";
import fs from "fs-extra";
import { debug, debugError, debugCommonsSync, debugServer } from "../debug.js";
import AdoptionReport from "../models/adoptionreport.js";
import Book, { BookInterface } from "../models/book.js";
import Collection from "../models/collection.js";
import Organization, { OrganizationInterface } from "../models/organization.js";
import CustomCatalog from "../models/customcatalog.js";
import Project, { ProjectBookBatchUpdateJob } from "../models/project.js";
import PeerReview from "../models/peerreview.js";
import CIDDescriptor from "../models/ciddescriptor.js";
import conductorErrors from "../conductor-errors.js";
import {
  getSubdomainFromUrl,
  isEmptyString,
  isValidDateObject,
  sleep,
  getRandomOffset,
  truncateString,
} from "../util/helpers.js";
import {
  deleteBookFromAPI,
  extractLibFromID,
  getLibraryAndPageFromBookID,
  genThumbnailLink,
  genPDFLink,
  genBookstoreLink,
  genZIPLink,
  genPubFilesLink,
  genLMSFileLink,
  genPermalink,
} from "../util/bookutils.js";
import {
  downloadProjectFiles,
  updateTeamWorkbenchPermissions,
} from "../util/projectutils.js";
import { buildPeerReviewAggregation } from "../util/peerreviewutils.js";
import librariesAPI from "./libraries.js";
import authAPI from "./auth.js";
import projectsAPI from "./projects.js";
import alertsAPI from "./alerts.js";
import mailAPI from "./mail.js";
import collectionsAPI from "./collections.js";
import axios, { AxiosResponse } from "axios";
import {
  _generatePageImagesAltTextResObj,
  BookSortOption,
  PageFile,
  PageFileProperty,
  PageImagesRes,
  TableOfContents,
  TableOfContentsDetailed,
} from "../types/Book.js";
import { isBookSortOption } from "../util/typeHelpers.js";
import { z } from "zod";
import {
  addPageProperty,
  CXOneFetch,
  generateBookPathAndURL,
  generateChapterOnePath,
  getPageID,
} from "../util/librariesclient.js";
import MindTouch from "../util/CXOne/index.js";
import { conductor400Err, conductor500Err } from "../util/errorutils.js";
import { ZodReqWithUser } from "../types/Express.js";
import User from "../models/user.js";
import centralIdentity from "./central-identity.js";
const defaultImagesURL = "https://cdn.libretexts.net/DefaultImages";
import { PipelineStage } from "mongoose";
import {
  createBookSchema,
  deleteBookSchema,
  getCommonsCatalogSchema,
  getMasterCatalogSchema,
  getWithBookIDParamSchema,
  getWithBookIDBodySchema,
  downloadBookFileSchema,
  updatePageDetailsSchema,
  batchGenerateAIMetadataSchema,
  batchUpdateBookMetadataSchema,
  bulkUpdatePageTagsSchema,
  getWithPageIDParamAndCoverPageIDSchema,
  GeneratePageImagesAltTextSchema,
} from "./validators/book.js";
import BookService from "./services/book-service.js";
import { randomUUID } from "crypto";
import * as cheerio from "cheerio";
import AIService from "./services/ai-service.js";
import { method } from "bluebird";

const BOOK_PROJECTION: Partial<Record<keyof BookInterface, number>> = {
  _id: 0,
  __v: 0,
  createdAt: 0,
  updatedAt: 0,
};

/**
 * Accepts a library shortname and returns the LibreTexts API URL for the current
 * Bookshelves listings in that library.
 * @param {String} lib - the standard shortened library identifier
 * @returns {String} the URL of the library's Bookshelves listings
 */
const generateBookshelvesURL = (lib: string) => {
  if (lib !== "espanol") {
    return `https://api.libretexts.org/DownloadsCenter/${lib}/Bookshelves.json`;
  } else {
    return `https://api.libretexts.org/DownloadsCenter/${lib}/home.json`;
  }
};

/**
 * Accepts a library shortname and returns the LibreTexts API URL for the current
 * Courses listings in that library.
 * @param {String} lib - the standard shortened library identifier
 * @returns {String} the URL of the library's Courses listings
 */
const generateCoursesURL = (lib: string) => {
  return `https://api.libretexts.org/DownloadsCenter/${lib}/Courses.json`;
};

/**
 * Sorts two strings after normalizing them to contain only letters.
 * @param {String} a
 * @param {String} b
 * @returns {Number} the sort order of the two strings
 */
const normalizedSort = (a: string, b: string) => {
  var normalizedA = String(a)
    .toLowerCase()
    .replace(/[^a-zA-Z]/gm, "");
  var normalizedB = String(b)
    .toLowerCase()
    .replace(/[^a-zA-Z]/gm, "");
  if (normalizedA < normalizedB) {
    return -1;
  }
  if (normalizedA > normalizedB) {
    return 1;
  }
  return 0;
};

/**
 * Accepts an array of Books and the sorting choice and returns the sorted array.
 *
 * @param {object[]} books - The array of Book objects to sort
 * @param {string} [sortChoice] - The sort choice, either 'random', 'author', or 'title' (default).
 * @returns {object[]} The sorted array of Books.
 */
function sortBooks(books: BookInterface[], sortChoice: BookSortOption) {
  if (Array.isArray(books) && sortChoice) {
    if (sortChoice === "random") {
      let shuffleArr = [...books];
      for (let i = shuffleArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleArr[i], shuffleArr[j]] = [shuffleArr[j], shuffleArr[i]];
      }
      return shuffleArr;
    }

    const collator = new Intl.Collator("en-US", {
      numeric: true,
      sensitivity: "base",
      ignorePunctuation: true,
    });
    return books.sort((a, b) => {
      let aKey = "";
      let bKey = "";
      if (sortChoice === "author") {
        aKey = a.author || "";
        bKey = b.author || "";
      } else {
        // default Sort by Title
        aKey = a.title;
        bKey = b.title;
      }
      return collator.compare(aKey, bKey);
    });
  }
  return books;
}

/**
 * Checks that a new book object has the required fields to be imported.
 * @param {Object} book - The information about the book to be imported.
 * @returns {Boolean} True if ready for import, false otherwise (logged).
 */
const checkValidImport = (book: BookInterface) => {
  var isValidImport = true;
  var validationFails = [];
  var expectedLib = extractLibFromID(book.zipFilename);
  if (
    book.zipFilename === undefined ||
    book.zipFilename === null ||
    isEmptyString(book.zipFilename)
  ) {
    isValidImport = false;
    validationFails.push("bookID");
  }
  if (
    book.title === undefined ||
    book.title === null ||
    isEmptyString(book.title)
  ) {
    isValidImport = false;
    validationFails.push("title");
  }
  if (isEmptyString(expectedLib)) {
    isValidImport = false;
    validationFails.push("library");
  }
  if (book.id === undefined || book.id === null || isEmptyString(book.id)) {
    isValidImport = false;
    validationFails.push("coverPageID");
  }
  if (!isValidImport && validationFails.length > 0) {
    var debugString =
      "Not importing 1 book — missing fields: " + validationFails.join(",");
    debugCommonsSync(debugString);
  }
  return isValidImport;
};

/**
 * Updates system-managed Collections for specified OER programs.
 *
 * @returns {Promise<number|boolean>} The number of collections updated, or
 *  false if error encountered.
 */
const autoGenerateCollections = () => {
  const bookQueries = [];
  const collOps = [];
  let collections = [];
  return Collection.find({ autoManage: true })
    .lean()
    .then((autoColls) => {
      collections = autoColls;
      /* Find books for auto-managed program collections */
      for (let i = 0, n = autoColls.length; i < n; i += 1) {
        const currColl = autoColls[i];
        if (
          typeof currColl.program === "string" &&
          currColl.program.length > 0
        ) {
          bookQueries.push(
            Book.aggregate([
              {
                $match: {
                  program: currColl.program,
                  location: {
                    $in: currColl.locations,
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  bookID: 1,
                  location: 1,
                  program: 1,
                },
              },
            ])
          );
        }
      }
      return Promise.all(bookQueries);
    })
    .then((bookQueryRes) => {
      /* Sort books into their auto-managed collection */
      let allBooksFound = [];
      for (let i = 0, n = bookQueryRes.length; i < n; i += 1) {
        allBooksFound = [...allBooksFound, ...bookQueryRes[i]];
      }
      for (let i = 0, n = allBooksFound.length; i < n; i += 1) {
        const currBook = allBooksFound[i];
        const collIdx = collections.findIndex(
          (coll) => coll.program === currBook.program
        );
        if (collIdx > -1) {
          const resourcesById =
            collections[collIdx].resources
              ?.map((item) => {
                if (item.resourceType === "resource") {
                  return item.resourceID;
                }
                return null;
              })
              .filter((i) => !!i) || [];
          if (!Array.isArray(collections[collIdx].newListings)) {
            collections[collIdx].newListings = [];
          }
          if (!resourcesById.includes(currBook.bookID)) {
            collections[collIdx].newListings.push({
              resourceType: "resource",
              resourceID: currBook.bookID,
            });
          }
        }
      }
      /* Assembles updates for collections (if necessary) */
      for (let i = 0, n = collections.length; i < n; i += 1) {
        const currColl = collections[i];
        if (
          Array.isArray(currColl.newListings) &&
          currColl.newListings.length > 0
        ) {
          collOps.push({
            updateOne: {
              filter: {
                collID: currColl.collID,
              },
              update: {
                $addToSet: {
                  resources: {
                    $each: currColl.newListings,
                  },
                },
              },
            },
          });
        }
      }
      if (collOps.length < 1) {
        return {};
      }
      return Collection.bulkWrite(collOps, { ordered: false });
    })
    .then((updateRes) => {
      if (typeof updateRes.nModified === "number") {
        return updateRes.nModified;
      }
      return 0;
    })
    .catch((err) => {
      console.error(err);
      return false;
    });
};

/**
 * Retrieve prepared books from the LibreTexts API and process &
 * import them to the Conductor database for use in Commons.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const syncWithLibraries = async (_req: Request, res: Response) => {
  let importCount = 0; // final count of imported books
  let didGenExports = false; // If KB Export files were generated
  let shelvesRequests: Promise<AxiosResponse>[] = []; // requests from Bookshelves
  let coursesRequests: Promise<AxiosResponse>[] = []; // requests from Campus Bookshelves
  let allRequests = []; // all requests to be made
  let allBooks: BookInterface[] = []; // all books returned from LT API
  let processedBooks: BookInterface[] = []; // all books processed for DB save
  let bookOps = []; // update/insert operations to perform with Mongoose
  let existingBooks = []; // existing books in the DB
  let existingProjects = []; // existing projects (tied to books) in the DB
  let bookIDs: string[] = []; // all (unique) bookIDs returned from LT API
  let projectsToCreate = []; // projects to be created to track books from LT API
  let newBookDBIds = []; // upserted MongoDb id's
  let generatedProjects = false; // did create new projects
  let updatedCollections = false; // did update auto-managed Collections

  // Build list(s) of HTTP requests to be performed
  const libs = await librariesAPI.getLibraryNameKeys(false, false);
  if (Array.isArray(libs)) {
    libs.forEach((l) => {
      shelvesRequests.push(axios.get(generateBookshelvesURL(l)));
      coursesRequests.push(axios.get(generateCoursesURL(l)));
    });
  } else {
    return res.send({
      err: true,
      errMsg: conductorErrors.err16,
    });
  }

  allRequests = shelvesRequests.concat(coursesRequests);

  // Execute requests
  Promise.all(allRequests)
    .then((booksRes) => {
      // Extract books from responses
      booksRes.forEach((axiosRes) => {
        allBooks = allBooks.concat(axiosRes.data.items);
      });
      // Process books and prepare for DB save
      allBooks.forEach((book) => {
        // check if book is valid & unique, otherwise ignore
        if (checkValidImport(book) && !bookIDs.includes(book.zipFilename)) {
          let link = "";
          let author = "";
          let affiliation = "";
          let license = "";
          let summary = "";
          let subject = "";
          let course = "";
          let location = "";
          let program = "";
          let lastUpdated = "";
          let libraryTags = [];
          if (Array.isArray(book.tags)) {
            if (book.tags.includes("coverpage:nocommons")) {
              return; // don't continue processing this entry
            }
            book.tags.forEach((tag) => {
              if (tag.includes("license:")) {
                license = tag.replace("license:", "");
              }
              if (tag.includes("program:")) {
                program = tag.replace("program:", "");
              }
            });
            libraryTags = book.tags;
          }
          if (book.link) {
            link = book.link;
            if (String(book.link).includes("/Bookshelves/")) {
              location = "central";
              let baseURL = `https://${extractLibFromID(
                book.zipFilename
              )}.libretexts.org/Bookshelves/`;
              let isolated = String(book.link).replace(baseURL, "");
              let splitURL = isolated.split("/");
              if (splitURL.length > 0) {
                let shelfRaw = splitURL[0];
                subject = shelfRaw.replace(/_/g, " ");
              }
            }
            if (String(book.link).includes("/Courses/")) {
              location = "campus";
              let baseURL = `https://${extractLibFromID(
                book.zipFilename
              )}.libretexts.org/Courses/`;
              let isolated = String(book.link).replace(baseURL, "");
              let splitURL = isolated.split("/");
              if (splitURL.length > 0) {
                let courseRaw = splitURL[0];
                course = courseRaw.replace(/_/g, " ");
              }
            }
          }
          if (book.author) author = book.author;
          if (typeof book.summary === "string") summary = book.summary;
          if (book.institution) affiliation = book.institution; // Affiliation is referred to as "Institution" in LT API
          if (typeof book.lastModified === "string")
            lastUpdated = book.lastModified;

          bookIDs.push(book.zipFilename); // duplicate mitigation
          processedBooks.push({
            author,
            affiliation,
            subject, // TODO: Improve algorithm
            location,
            course, // TODO: Improve algorithm
            program,
            license,
            summary,
            bookID: book.zipFilename,
            title: book.title,
            library: extractLibFromID(book.zipFilename),
            thumbnail: genThumbnailLink(
              extractLibFromID(book.zipFilename),
              book.id
            ),
            links: {
              online: link,
              pdf: genPDFLink(book.zipFilename),
              buy: genBookstoreLink(book.zipFilename),
              zip: genZIPLink(book.zipFilename),
              files: genPubFilesLink(book.zipFilename),
              lms: genLMSFileLink(book.zipFilename),
            },
            lastUpdated,
            libraryTags,
          });
        }
      });
      let booksQuery = Book.aggregate([
        {
          $project: {
            _id: 0,
            bookID: 1,
          },
        },
      ]);
      let projsQuery = Project.aggregate([
        {
          $match: {
            $and: [
              { libreLibrary: { $ne: null } },
              { libreCoverID: { $ne: null } },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            projectID: 1,
            projectURL: 1,
            libreLibrary: 1,
            libreCoverID: 1,
          },
        },
      ]);
      return Promise.all([booksQuery, projsQuery]);
    })
    .then((queryResults) => {
      if (queryResults.length === 2) {
        if (Array.isArray(queryResults[0])) {
          existingBooks = queryResults[0]
            .map((existBook) => {
              if (typeof existBook.bookID === "string") return existBook.bookID;
              return null;
            })
            .filter((item) => item !== null);
        }
        if (Array.isArray(queryResults[1])) existingProjects = queryResults[1];
      }
      processedBooks.forEach((book) => {
        /* check if project needs to be created */
        let [bookLib, bookCoverID] = getLibraryAndPageFromBookID(book.bookID);
        if (typeof bookLib === "string" && typeof bookCoverID === "string") {
          let foundProject = existingProjects.find((project) => {
            if (
              project.libreLibrary === bookLib &&
              project.libreCoverID === bookCoverID
            ) {
              return project;
            }
            return null;
          });
          if (foundProject === undefined) {
            projectsToCreate.push({
              title: book.title,
              library: bookLib,
              coverID: bookCoverID,
              url: book.links?.online,
              author: book.author,
            });
          }
        }
        /* insert or update books */
        bookOps.push({
          updateOne: {
            filter: {
              bookID: book.bookID,
            },
            update: {
              $setOnInsert: {
                bookID: book.bookID,
              },
              $set: {
                title: book.title,
                author: book.author,
                affiliation: book.affiliation,
                library: book.library,
                subject: book.subject,
                location: book.location,
                course: book.course,
                program: book.program,
                license: book.license,
                thumbnail: book.thumbnail,
                summary: book.summary,
                links: book.links,
                lastUpdated: book.lastUpdated,
                libraryTags: book.libraryTags,
              },
            },
            upsert: true,
          },
        });
      });
      existingBooks.forEach((book) => {
        /* check if book needs to be deleted */
        let foundProcessed = processedBooks.find(
          (processed) => book === processed.bookID
        );
        if (foundProcessed === undefined) {
          // book not found in new batch, needs to be deleted
          bookOps.push({
            deleteOne: {
              filter: {
                bookID: book,
              },
            },
          });
        }
      });
      return Book.bulkWrite(bookOps, {
        ordered: false,
      });
    })
    .catch((writeErr) => {
      debugError(writeErr);
      /* Catch intermediate errors with bulkWrite, try to recover */
      if (writeErr.result?.nMatched > 0) {
        // Some imports failed (silent)
        debugCommonsSync(
          `Updated only ${writeErr.result.nMatched} books when ${allBooks.length} books were expected.`
        );
        return null; // Continue to auto-generate Program Collections
      } else {
        // All imports failed
        throw new Error("bulkwrite");
      }
    })
    .then((writeRes) => {
      if (typeof writeRes.result?.nMatched === "number") {
        importCount = writeRes.result.nMatched;
      }
      if (typeof writeRes.upsertedIds === "object") {
        Object.keys(writeRes.upsertedIds).forEach((key) => {
          newBookDBIds.push(writeRes.upsertedIds[key]);
        });
      }
      // All imports succeeded, continue to update auto-managed Collections
      return autoGenerateCollections();
    })
    .then((autoCollsRes) => {
      updatedCollections = autoCollsRes;
      // Program Collections updated, continue to generate KB Export files
      return generateKBExport();
    })
    .then((generated) => {
      if (generated === true) {
        didGenExports = true;
      }
      if (projectsToCreate.length > 0) {
        // Continue to autogenerate new Projects
        return projectsAPI.autoGenerateProjects(projectsToCreate);
      }
      debugCommonsSync("No new projects to create.");
      return 0;
    })
    .then((projectsGen) => {
      generatedProjects = projectsGen;
      if (newBookDBIds.length > 0) {
        return alertsAPI.processInstantBookAlerts(newBookDBIds);
      }
      return true;
    })
    .then(() => {
      // ignore return value of processing Alerts
      let msg = `Imported ${importCount} books from the Libraries.`;
      if (typeof updatedCollections == "number") {
        msg += ` ${updatedCollections} system-managed Collections updated.`;
      } else if (
        typeof updatedCollections === "boolean" &&
        !updatedCollections
      ) {
        msg += ` FAILED to update system-managed collections. Check server logs.`;
      }
      if (didGenExports) {
        msg += ` Successfully generated export files for 3rd-party content services.`;
      } else {
        msg += ` FAILED to generate export files for 3rd-party content services. Check server logs.`;
      }
      if (typeof generatedProjects === "number") {
        msg += ` ${generatedProjects} new Projects were autogenerated.`;
      } else if (typeof generatedProjects === "boolean" && !generatedProjects) {
        msg += ` FAILED to autogenerate new Projects. Check server logs.`;
      }
      debugCommonsSync(msg);
      return res.send({
        err: false,
        msg: msg,
      });
    })
    .catch((err) => {
      debugError(err);
      if (err.message === "bulkwrite") {
        // all imports failed
        return res.send({
          err: true,
          msg: conductorErrors.err13,
        });
      } else if (err.code === "ENOTFOUND") {
        // issues connecting to LT API
        return res.send({
          err: true,
          errMsg: conductorErrors.err16,
        });
      } else {
        // other errors
        debugError(err);
        return res.send({
          err: true,
          errMsg: conductorErrors.err6,
        });
      }
    });
};

/**
 * Runs the Sync with Libraries job via on trigger from an automated requester (e.g. schedule service).
 * @param {object} req - The Express.js request object.
 * @param {object} res - The Express.js response object.
 */
const runAutomatedSyncWithLibraries = (req: Request, res: Response) => {
  debugServer(
    `Received automated request to sync Commons with Libraries ${new Date().toLocaleString()}`
  );
  return syncWithLibraries(req, res);
};

/**
 * Accepts a standard Organization-model object and generates an array of strings of all
 * known variations of the Organization's name, including full, short, abbreviation, and
 * possible aliases.
 * INTERNAL USE ONLY.
 * @param {Object} orgData - An Organization information object.
 * @returns {String[]} An array of known Organization names.
 */
const buildOrganizationNamesList = (orgData: OrganizationInterface) => {
  if (orgData) {
    let campusNames: string[] = []; // stores all variations of the organization name
    let normNames: string[] = []; // temporarily stores the normalized variations
    if (orgData.name && !isEmptyString(orgData.name)) {
      if (!campusNames.includes(orgData.name)) {
        campusNames.push(orgData.name);
      }
    }
    if (orgData.shortName && !isEmptyString(orgData.shortName)) {
      if (!campusNames.includes(orgData.shortName)) {
        campusNames.push(orgData.shortName);
      }
    }
    if (orgData.abbreviation && !isEmptyString(orgData.abbreviation)) {
      if (!campusNames.includes(orgData.abbreviation)) {
        campusNames.push(orgData.abbreviation);
      }
    }
    if (
      orgData.aliases &&
      Array.isArray(orgData.aliases) &&
      orgData.aliases.length > 0
    ) {
      campusNames = campusNames.concat(orgData.aliases);
    }
    // Normalize the names to remove common punctuation, then add to campusNames list
    campusNames.forEach((name) => {
      let normed = String(name)
        .replace(/,/g, "")
        .replace(/-/g, "")
        .replace(/:/g, "")
        .replace(/'/g, "");
      if (!normNames.includes(normed) && !campusNames.includes(normed)) {
        normNames.push(normed);
      }
      let lowerNormed = String(normed).toLowerCase();
      if (
        !normNames.includes(lowerNormed) &&
        !campusNames.includes(lowerNormed)
      ) {
        normNames.push(lowerNormed);
      }
    });
    if (normNames.length > 0) {
      campusNames = campusNames.concat(normNames);
    }
    return campusNames;
  } else {
    return [];
  }
};

/**
 * Returns the Commons Catalog results according to request filters, search parameters,
 * and sort options.
 *
 * @param {z.infer<typeof getCommonsCatalogSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing resposne object.
 */
async function getCommonsCatalog(
  req: z.input<typeof getCommonsCatalogSchema>,
  res: Response
) {
  try {
    const orgID = process.env.ORG_ID;
    const activePage = req.query.activePage
      ? parseInt(req.query.activePage.toString())
      : 1;
    const limit = req.query.limit ? parseInt(req.query.limit.toString()) : 10;

    let sortObj = {};
    if (req.query.sort && req.query.sort === "author") {
      sortObj = {
        author: 1,
      };
    }
    if (req.query.sort && req.query.sort === "title") {
      sortObj = {
        title: 1,
      };
    }

    const searchQueries = [];

    // Find books associated with projects
    const projectWithAssociatedBookQuery = {
      $expr: {
        $and: [
          { $eq: ["$orgID", orgID] },
          { $ne: [{ $type: "$libreLibrary" }, "missing"] },
          { $gt: [{ $strLenBytes: "$libreLibrary" }, 0] },
          { $ne: [{ $type: "$libreCoverID" }, "missing"] },
          { $gt: [{ $strLenBytes: "$libreCoverID" }, 0] },
        ],
      },
    };
    const projectWithAssociatedBookProjection = {
      _id: 0,
      libreLibrary: 1,
      libreCoverID: 1,
    };

    const projResults =
      (await Project.aggregate([
        {
          $match: projectWithAssociatedBookQuery,
        },
        {
          $project: projectWithAssociatedBookProjection,
        },
      ])) ?? [];

    const projBookIDs = projResults.map(
      (proj) => `${proj.libreLibrary}-${proj.libreCoverID}`
    );
    const idMatchObj = { bookID: { $in: projBookIDs } };

    const pipeline: PipelineStage[] = [
      {
        $match: idMatchObj,
      },
      { $project: BOOK_PROJECTION },
    ];

    if (Object.keys(sortObj).length > 0) {
      pipeline.push({ $sort: sortObj });
    }

    searchQueries.push(Book.aggregate(pipeline));

    // Find books in org's custom catalog
    if (orgID !== "libretexts") {
      const orgData = await Organization.findOne(
        { orgID },
        {
          _id: 0,
          orgID: 1,
          name: 1,
          shortName: 1,
          abbreviation: 1,
          aliases: 1,
          catalogMatchingTags: 1,
        }
      ).lean();

      const customCatalog = await CustomCatalog.findOne(
        { orgID },
        {
          _id: 0,
          orgID: 1,
          resources: 1,
        }
      ).lean();

      if (orgData && Object.keys(orgData).length > 0) {
        const institutionOptions = [];
        const campusNames = buildOrganizationNamesList(orgData);
        if (campusNames.length > 0) {
          institutionOptions.push({ publisher: { $in: campusNames } });
          institutionOptions.push({ course: { $in: campusNames } });
          institutionOptions.push({ program: { $in: campusNames } });
          institutionOptions.push({ affiliation: { $in: campusNames } });
        }

        const hasCustomEntries =
          customCatalog &&
          Array.isArray(customCatalog.resources) &&
          customCatalog.resources.length > 0;
        const hasCatalogMatchingTags =
          Array.isArray(orgData?.catalogMatchingTags) &&
          orgData?.catalogMatchingTags.length > 0;

        if (hasCustomEntries || hasCatalogMatchingTags) {
          let searchAreaObj = {};
          const idMatchObj = { bookID: { $in: customCatalog?.resources } };
          const tagMatchObj = {
            libraryTags: { $in: orgData.catalogMatchingTags },
          };

          if (
            hasCustomEntries &&
            hasCatalogMatchingTags &&
            campusNames.length > 0
          ) {
            searchAreaObj = {
              $or: [idMatchObj, tagMatchObj, ...institutionOptions],
            };
          } else if (
            hasCustomEntries &&
            !hasCatalogMatchingTags &&
            campusNames.length > 0
          ) {
            searchAreaObj = {
              $or: [idMatchObj, ...institutionOptions],
            };
          } else if (
            !hasCustomEntries &&
            hasCatalogMatchingTags &&
            campusNames.length > 0
          ) {
            searchAreaObj = {
              $or: [tagMatchObj, ...institutionOptions],
            };
          } else if (
            hasCustomEntries &&
            hasCatalogMatchingTags &&
            campusNames.length === 0
          ) {
            searchAreaObj = {
              $or: [idMatchObj, tagMatchObj],
            };
          } else if (
            hasCustomEntries &&
            !hasCatalogMatchingTags &&
            campusNames.length === 0
          ) {
            searchAreaObj = idMatchObj;
          } else {
            searchAreaObj = tagMatchObj;
          }

          searchQueries.push(
            Book.aggregate([
              { $match: searchAreaObj },
              { $project: BOOK_PROJECTION },
            ])
          );
        } else {
          searchQueries.push(
            Book.aggregate([
              { $match: { $or: institutionOptions } },
              { $project: BOOK_PROJECTION },
            ])
          );
        }
      }
    }

    const results = await Promise.all(searchQueries);

    const aggResults = results.reduce((acc, curr) => {
      if (Array.isArray(curr)) {
        return acc.concat(curr);
      }
      return acc;
    }, []);

    // Ensure no duplicates
    const resultBookIDs = new Set<string>();
    const resultBooks = aggResults.filter((book) => {
      if (!resultBookIDs.has(book.bookID)) {
        resultBookIDs.add(book.bookID);
        return true;
      }
      return false;
    });

    const totalNumBooks = resultBooks.length;
    const offset = getRandomOffset(totalNumBooks, limit);

    const upperBound = () => {
      if (offset + limit > totalNumBooks) {
        return totalNumBooks;
      } else {
        return offset + limit;
      }
    };

    const randomized = resultBooks.slice(offset, upperBound());

    // Check if the associated project has any public or instructor only files
    const publicOrInstructorSearch = await _getBookPublicOrInstructorAssetsCount(randomized.map((r) => r.bookID) || []);

    // Add the publicOrInstructorAssets field to each book
    randomized.forEach((book) => {
      const bookID = book.bookID;
      const found = publicOrInstructorSearch.find((b) => b.bookID === bookID);
      book.publicAssets = found?.publicAssets || 0;
      book.instructorAssets = found?.instructorAssets || 0;
    });

    return res.send({
      err: false,
      numTotal: totalNumBooks,
      books: randomized,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

const _buildSearchQueryFromProjectResults = async (
  matchObj: object,
  optionsArr: any[]
): Promise<any[]> => {
  const projResults = await Project.aggregate([
    {
      $match: matchObj,
    },
    {
      $project: {
        _id: 0,
        libreLibrary: 1,
        libreCoverID: 1,
      },
    },
  ]);

  if (!Array.isArray(projResults) || projResults.length === 0) {
    return [];
  }

  const projBookIDs = projResults.map(
    (proj) => `${proj.libreLibrary}-${proj.libreCoverID}`
  );

  const idMatchObj = { bookID: { $in: projBookIDs } };
  let projBookMatch = {};
  if (optionsArr.length > 0) {
    projBookMatch = {
      $and: [...optionsArr, idMatchObj],
    };
  } else {
    projBookMatch = idMatchObj;
  }

  return [
    Book.aggregate([{ $match: projBookMatch }, { $project: BOOK_PROJECTION }]),
  ];
};

/**
 * Returns the master list of Commons Catalog
 * items with limited filtering and sorting.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'getMasterCatalog'
 */
const getMasterCatalog = (
  req: z.infer<typeof getMasterCatalogSchema>,
  res: Response
) => {
  var sortedBooks: BookInterface[] = [];
  var orgData = {};
  var sortChoice: BookSortOption = "title"; // default to Sort by Title
  var matchObj = {};
  if (
    req.query.sort &&
    !isEmptyString(req.query.sort) &&
    isBookSortOption(req.query.sort)
  ) {
    sortChoice = req.query.sort;
  }
  if (req.query.search && !isEmptyString(req.query.search)) {
    matchObj["$text"] = {
      $search: req.query.search,
    };
  }
  Book.aggregate([
    {
      $match: matchObj,
    },
    {
      $project: {
        _id: 0,
        __v: 0,
        createdAt: 0,
        updatedAt: 0,
      },
    },
  ])
    .then((books) => {
      sortedBooks = sortBooks(books, sortChoice);
      if (process.env.ORG_ID !== "libretexts") {
        return Organization.findOne({
          orgID: process.env.ORG_ID,
        });
      } else {
        return {}; // LibreCommons — don't need to lookup Organization
      }
    })
    .then((orgDataRes) => {
      if (Object.keys(orgDataRes).length > 0) {
        orgData = orgDataRes;
      }
      if (process.env.ORG_ID !== "libretexts") {
        return CustomCatalog.findOne(
          {
            orgID: process.env.ORG_ID,
          },
          {
            _id: 0,
            orgID: 1,
            resources: 1,
          }
        );
      } else {
        return {}; // LibreCommons — don't need to lookup Custom Catalog
      }
    })
    .then((customCatalogRes) => {
      // Check if book has been enabled via Custom Catalog
      if (
        customCatalogRes !== null &&
        Object.keys(customCatalogRes).length > 0
      ) {
        if (
          customCatalogRes.resources &&
          Array.isArray(customCatalogRes.resources)
        ) {
          sortedBooks.forEach((book) => {
            if (customCatalogRes.resources.includes(book.bookID)) {
              book.isCustomEnabled = true;
            }
          });
        }
      }
      // Check if book originated from the Organization
      if (Object.keys(orgData).length > 0) {
        var campusNames = buildOrganizationNamesList(orgData);
        sortedBooks.forEach((book) => {
          var isCampusBook = campusNames.some((item) => {
            if (book.course && !isEmptyString(book.course)) {
              return (
                String(book.course).includes(item) ||
                String(book.course) === item
              );
            } else if (book.program && !isEmptyString(book.program)) {
              return (
                String(book.program).includes(item) ||
                String(book.program) === item
              );
            } else if (book.affiliation && !isEmptyString(book.affiliation)) {
              return (
                String(book.affiliation).includes(item) ||
                String(book.affiliation) === item
              );
            } else {
              return false;
            }
          });
          if (isCampusBook) book.isCampusBook = true;
        });
      }
      return res.send({
        err: false,
        books: sortedBooks,
      });
    })
    .catch((err) => {
      debugError(err);
      return res.send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    });
};

/**
 * Returns the current options for dynamic filters in Commons Catalog(s).
 *
 * @param {express.Request} _req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getCatalogFilterOptions(_req: Request, res: Response) {
  try {
    const orgID = process.env.ORG_ID;
    const uniqueAuthors = new Set();
    const uniqueSubjects = new Set();
    const uniqueAffiliations = new Set();
    const uniqueCourses = new Set();
    const uniquePrograms = new Set();
    let matchObj = {};

    if (orgID !== "libretexts") {
      const [orgData, customCatalog] = await Promise.all([
        Organization.findOne(
          { orgID },
          {
            _id: 0,
            orgID: 1,
            name: 1,
            shortName: 1,
            abbreviation: 1,
            aliases: 1,
          }
        ).lean(),
        CustomCatalog.findOne(
          { orgID },
          {
            _id: 0,
            orgID: 1,
            resources: 1,
          }
        ).lean(),
      ]);
      const campusNames = buildOrganizationNamesList(orgData);
      if (
        customCatalog &&
        Array.isArray(customCatalog.resources) &&
        customCatalog.resources.length > 0
      ) {
        matchObj["$or"] = [
          { bookID: { $in: customCatalog.resources } },
          { course: { $in: campusNames } },
          { program: { $in: campusNames } },
        ];
      } else {
        matchObj["$or"] = [
          { course: { $in: campusNames } },
          { program: { $in: campusNames } },
        ];
      }
    }

    const [foundBooks, cidResults] = await Promise.all([
      Book.aggregate([
        {
          $match: matchObj,
        },
        {
          $project: {
            _id: 0,
            author: 1,
            subject: 1,
            affiliation: 1,
            course: 1,
            program: 1,
          },
        },
      ]),
      CIDDescriptor.aggregate([
        {
          $sort: {
            descriptor: 1,
          },
        },
        {
          $project: {
            _id: 0,
            __v: 0,
            createdAt: 0,
            updatedAt: 0,
            title: 0,
            description: 0,
            approved: 0,
            expires: 0,
          },
        },
      ]),
    ]);

    foundBooks.forEach((book) => {
      if (book.author && !isEmptyString(book.author)) {
        uniqueAuthors.add(book.author);
      }
      if (book.subject && !isEmptyString(book.subject)) {
        uniqueSubjects.add(book.subject);
      }
      if (book.affiliation && !isEmptyString(book.affiliation)) {
        uniqueAffiliations.add(book.affiliation);
      }
      if (book.course && !isEmptyString(book.course)) {
        uniqueCourses.add(book.course);
      }
      if (book.program && !isEmptyString(book.program)) {
        uniquePrograms.add(book.program);
      }
    });

    const authors = Array.from(uniqueAuthors).sort(normalizedSort);
    const subjects = Array.from(uniqueSubjects).sort(normalizedSort);
    const affiliations = Array.from(uniqueAffiliations).sort(normalizedSort);
    const courses = Array.from(uniqueCourses).sort(normalizedSort);
    const programs = Array.from(uniquePrograms).sort(normalizedSort);
    const cids = cidResults
      .map((item) => item.descriptor)
      .filter((item) => item !== undefined);

    return res.send({
      authors,
      subjects,
      affiliations,
      courses,
      programs,
      cids,
      err: false,
    });
  } catch (e) {
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Creates a new book with default features in a library Workbench area.
 *
 * @param {express.Request} req - Incoming request.
 * @param {express.Response} res - Outgoing response.
 */
async function createBook(
  req: ZodReqWithUser<z.infer<typeof createBookSchema>>,
  res: Response
) {
  try {
    const { library, title, projectID } = req.body;
    const { uuid: userID } = req.user.decoded;

    const user = await User.findOne({ uuid: userID }).orFail();
    const project = await Project.findOne({ projectID }).orFail();

    const libraryApp = await centralIdentity.getApplicationById(library);
    if (!libraryApp) {
      throw new Error("badlibrary");
    }

    const subdomain = getSubdomainFromUrl(libraryApp.main_url);
    if (!subdomain) {
      throw new Error("badlibrary");
    }

    // Check project permissions
    const canCreate = projectsAPI.checkProjectMemberPermission(project, user);
    if (!canCreate) {
      throw new Error(conductorErrors.err8);
    }

    const hasLibAccess =
      await centralIdentity.checkUserApplicationAccessInternal(
        user.centralID,
        libraryApp.id
      );
    if (!hasLibAccess) {
      throw new Error(conductorErrors.err8);
    }

    // Create book coverpage
    const [bookPath, bookURL] = generateBookPathAndURL(subdomain, title);
    const createBookRes = await CXOneFetch({
      scope: "page",
      path: bookPath,
      api: MindTouch.API.Page.POST_Contents_Title(title),
      subdomain,
      options: {
        method: "POST",
        body: MindTouch.Templates.POST_CreateBook,
      },
      query: { abort: "exists" },
    }).catch((e) => {
      const err = new Error(conductorErrors.err86);
      err.name = "CreateBookError";
      throw err;
    });

    // createBookRes didn't throw, but didn't return a successful response
    if (!createBookRes.ok) {
      throw new Error(`Error creating Workbench book: "${title}"`);
    }

    await Promise.all([
      addPageProperty(subdomain, bookPath, "WelcomeHidden", true),
      addPageProperty(subdomain, bookPath, "SubPageListing", "simple"),
    ]);

    const imageRes = await fetch(`${defaultImagesURL}/default.png`);
    const defaultBookImage = await imageRes.blob();
    await CXOneFetch({
      scope: "page",
      path: bookPath,
      api: MindTouch.API.Page.PUT_File_Default_Thumbnail,
      subdomain,
      options: { method: "PUT", body: defaultBookImage },
      //silentFail: true,
    }).catch((e) => {
      // Warn, but don't throw error
      console.warn("[createBook] Error setting coverpage thumbnail:");
      console.warn(e);
    });

    // Create first chapter
    const chapterOnePath = generateChapterOnePath(bookPath);
    await CXOneFetch({
      scope: "page",
      path: chapterOnePath,
      api: MindTouch.API.Page.POST_Contents_Title("1: First Chapter"),
      subdomain,
      options: {
        method: "POST",
        body: MindTouch.Templates.POST_CreateBookChapter,
      },
    });

    await Promise.all([
      addPageProperty(subdomain, chapterOnePath, "WelcomeHidden", true),
      addPageProperty(subdomain, chapterOnePath, "GuideDisplay", "single"),
      addPageProperty(
        subdomain,
        chapterOnePath,
        "GuideTabs",
        MindTouch.Templates.PROP_GuideTabs
      ),
    ]);

    await CXOneFetch({
      scope: "page",
      path: chapterOnePath,
      api: MindTouch.API.Page.PUT_File_Default_Thumbnail,
      subdomain,
      options: { method: "PUT", body: defaultBookImage },
      //silentFail: true,
    }).catch((e) => {
      // Warn, but don't throw error
      console.warn("[createBook] Error setting Chapter 1 thumbnail:");
      console.warn(e);
    });

    // Create Front & Back Matter
    const matterRes = fetch(
      `https://batch.libretexts.org/print/Libretext=${bookURL}?createMatterOnly=true`,
      {
        headers: { origin: "commons.libretexts.org" },
      }
    ); // Don't wait for response, no-op if fails

    sleep(1500); // let CXone catch up with page creations

    const newBookID = await getPageID(bookPath, subdomain);
    if (!newBookID) {
      throw new Error(`Error saving book ID for Workbench book: "${title}":`);
    }

    // Update Project with new book info
    project.libreLibrary = subdomain;
    project.libreCoverID = newBookID;
    project.didCreateWorkbench = true;
    await project.save();

    const permsUpdated = await updateTeamWorkbenchPermissions(
      projectID,
      subdomain,
      newBookID
    );

    if (!permsUpdated) {
      console.log(
        `[createBook] Failed to update permissions for ${projectID}.`
      ); // Silent fail
    }

    console.log(`[createBook] Created ${bookPath}.`);
    return res.send({
      err: false,
      path: bookPath,
      url: bookURL,
    });
  } catch (err: any) {
    if (err.name === "DocumentNotFoundError" || err.name === "badlibrary") {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    debugError(err);
    if (["CreateBookError", "badlibrary"].includes(err.name)) {
      return res.status(400).send({
        err: true,
        errMsg: err.message,
      });
    }
    return conductor500Err(res);
  }
}

/**
 * Deletes a book (and its related resources) from both the Conductor DB and LibreTexts central listings.
 *
 * @param {express.Request} req - Incoming request.
 * @param {express.Response} res - Outgoing response.
 */
async function deleteBook(
  req: ZodReqWithUser<z.infer<typeof deleteBookSchema>>,
  res: Response
) {
  try {
    const deleteProject = !!req.query?.deleteProject;
    const bookID = req.params.bookID;
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    if (!lib || !coverID) {
      return conductor400Err(res);
    }

    const foundBook = await Book.findOne({ bookID });
    if (!foundBook || !foundBook?.links?.online) {
      return conductor400Err(res);
    }

    // <find and delete project and associated resources>
    const attachedProject = await Project.findOne({
      libreCoverID: coverID,
      libreLibrary: lib,
    });
    if (attachedProject) {
      const projectID = attachedProject.projectID;
      await PeerReview.deleteMany({ projectID });
      if (deleteProject) {
        debug(`[Delete Book]: Deleting project ${projectID}`);
        const projDelRes = await projectsAPI.deleteProjectInternal(projectID);
        if (!projDelRes) {
          return conductor500Err(res);
        }
      }
    }
    // </find and delete project and associated resources>

    await Promise.allSettled([
      AdoptionReport.deleteMany({ "resource.id": bookID }),
      collectionsAPI.removeResourceFromAnyCollectionInternal(bookID),
    ]);

    // <delete from central API>
    try {
      if (process.env.NODE_ENV === "production") {
        await deleteBookFromAPI(bookID);
        debug(`Book ${bookID} deleted from API.`);
      } else {
        debug("Simulating book deletion from API.");
      }
    } catch (err: any) {
      debugError(`[Delete Book] ${err.toString()}`);
      return conductor500Err(res);
    }
    // </delete from central API>

    await Book.deleteOne({ bookID });
    return res.send({
      err: false,
      msg: "Book successfully deleted.",
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Returns a Book object given a book ID.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookDetail'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookDetail(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response
) {
  try {
    const { bookID } = req.params;
    const bookRes = await Book.aggregate([
      {
        $match: { bookID },
      },
      {
        $addFields: {
          coverID: {
            $arrayElemAt: [{ $split: ["$bookID", "-"] }, 1],
          },
        },
      },
      {
        $lookup: {
          from: "projects",
          let: {
            lib: "$library",
            coverID: "$coverID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$$lib", "$libreLibrary"] },
                    { $eq: ["$$coverID", "$libreCoverID"] },
                    { $eq: ["$visibility", "public"] },
                  ],
                },
              },
            },
          ],
          as: "project",
        },
      },
      {
        $addFields: {
          project: {
            $arrayElemAt: ["$project", 0],
          },
        },
      },
      {
        $lookup: {
          from: "peerreviews",
          let: {
            projectID: "$project.projectID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$projectID", "$$projectID"],
                },
              },
            },
          ],
          as: "peerReviews",
        },
      },
      {
        $addFields: {
          projectID: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$project.projectID", false] },
                  { $gt: [{ $strLenBytes: "$project.projectID" }, 0] },
                ],
              },
              "$project.projectID",
              "$projectID", // undefined
            ],
          },
          hasReaderResources: {
            $and: [
              { $ifNull: ["$readerResources", false] },
              { $gt: [{ $size: "$readerResources" }, 0] },
            ],
          },
          allowAnonPR: {
            $and: [
              { $ne: [{ $type: "$project.allowAnonPR" }, "missing"] },
              { $ne: ["$project.allowAnonPR", false] },
            ],
          },
          hasPeerReviews: {
            $and: [
              { $ifNull: ["$peerReviews", false] },
              { $gt: [{ $size: "$peerReviews" }, 0] },
            ],
          },
          hasAdaptCourse: {
            $and: [
              { $ifNull: ["$project.adaptCourseID", false] },
              { $gt: [{ $strLenBytes: "$project.adaptCourseID" }, 0] },
            ],
          },
          adaptCourseID: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$project.adaptCourseID", false] },
                  { $gt: [{ $strLenBytes: "$project.adaptCourseID" }, 0] },
                ],
              },
              "$project.adaptCourseID",
              "$adaptCourseID", // undefined
            ],
          },
          isbn: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$isbn", false] },
                  { $gt: [{ $strLenBytes: "$isbn" }, 0] },
                ],
              },
              "$isbn",
              "$project.isbn", // undefined
            ],
          },
          doi: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$doi", false] },
                  { $gt: [{ $strLenBytes: "$doi" }, 0] },
                ],
              },
              "$doi",
              "$project.doi", // undefined
            ],
          },
          sourceOriginalPublicationDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceOriginalPublicationDate", false] },
                  {
                    $gt: [
                      { $strLenBytes: "$sourceOriginalPublicationDate" },
                      0,
                    ],
                  },
                ],
              },
              "$sourceOriginalPublicationDate",
              "$project.sourceOriginalPublicationDate", // undefined
            ],
          },
          sourceHarvestDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceHarvestDate", false] },
                  { $gt: [{ $strLenBytes: "$sourceHarvestDate" }, 0] },
                ],
              },
              "$sourceHarvestDate",
              "$project.sourceHarvestDate", // undefined
            ],
          },
          sourceLastModifiedDate: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceLastModifiedDate", false] },
                  { $gt: [{ $strLenBytes: "$sourceLastModifiedDate" }, 0] },
                ],
              },
              "$sourceLastModifiedDate",
              "$project.sourceLastModifiedDate", // undefined
            ],
          },
          sourceLanguage: {
            $cond: [
              {
                $and: [
                  { $ifNull: ["$sourceLanguage", false] },
                  { $gt: [{ $strLenBytes: "$sourceLanguage" }, 0] },
                ],
              },
              "$sourceLanguage",
              "$project.sourceLanguage", // undefined
            ],
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
          createdAt: 0,
          updatedAt: 0,
          materials: 0,
          project: 0,
          peerReviews: 0,
          readerResources: {
            _id: 0,
          },
        },
      },
    ]);
    if (bookRes.length < 1) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }
    return res.send({
      err: false,
      book: bookRes[0],
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Checks if a Book has an associated Project, if it allows anonymous Peer Reviews,
 *  and the current Peer Reviews available.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookPeerReviews'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookPeerReviews(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response
) {
  try {
    let allowsAnon = true;
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    if (isEmptyString(lib) || isEmptyString(coverID)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const project = await Project.findOne({
      $and: [
        { libreLibrary: lib },
        { libreCoverID: coverID },
        { visibility: "public" },
      ],
    }).lean();
    if (!project) {
      return res.send({
        err: false,
        msg: "No Projects associated with this resource.",
      });
    }

    if (project.allowAnonPR === false) {
      allowsAnon = false; // true by default
    }
    const peerReviews = await PeerReview.aggregate(
      buildPeerReviewAggregation(project.projectID)
    );
    return res.send({
      err: false,
      projectID: project.projectID,
      reviews: peerReviews,
      allowsAnon,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Adds the Book specified by @bookID in the request
 * body to the Custom Catalog for the organization
 * handled by the current server instance.
 * If the Book is already in the Custom Catalog,
 * no change is made (unique entries).
 * If the Custom Catalog record does not already
 * exists, it is created.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'addBookToCustomCatalog'
 */
const addBookToCustomCatalog = (
  req: z.infer<typeof getWithBookIDBodySchema>,
  res: Response
) => {
  CustomCatalog.updateOne(
    { orgID: process.env.ORG_ID },
    {
      $setOnInsert: {
        orgID: process.env.ORG_ID,
      },
      $addToSet: {
        resources: req.body.bookID,
      },
    },
    {
      upsert: true,
    }
  )
    .then((catalogRes) => {
      if (catalogRes.matchedCount === 1 && catalogRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Resource successfully added to Catalog.",
        });
      } else if (catalogRes.n === 0) {
        throw new Error("notfound");
      } else {
        throw new Error("updatefailed");
      }
    })
    .catch((err) => {
      if (err.message === "notfound") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      } else {
        debugError(err);
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err6,
        });
      }
    });
};

/**
 * Removes the Book specified by @bookID in the request
 * body from the Custom Catalog for the organization
 * handled by the current server instance. If the
 * book is not in the Custom Catalog, no change is
 * made. All instances of the @bookID are removed from
 * the Custom Catalog to combat duplicate entries.
 * NOTE: This function should only be called AFTER
 *  the validation chain.
 * VALIDATION: 'removeBookFromCustomCatalog'
 */
const removeBookFromCustomCatalog = (
  req: z.infer<typeof getWithBookIDBodySchema>,
  res: Response
) => {
  CustomCatalog.updateOne(
    { orgID: process.env.ORG_ID },
    {
      $pullAll: {
        resources: [req.body.bookID],
      },
    }
  )
    .then((catalogRes) => {
      if (catalogRes.matchedCount === 1 && catalogRes.modifiedCount === 1) {
        return res.send({
          err: false,
          msg: "Resource successfully removed from Catalog.",
        });
      } else if (catalogRes.n === 0) {
        throw new Error("notfound");
      } else {
        throw new Error("updatefailed");
      }
    })
    .catch((err) => {
      if (err.message === "notfound") {
        return res.status(400).send({
          err: true,
          errMsg: conductorErrors.err11,
        });
      } else {
        debugError(err);
        return res.status(500).send({
          err: true,
          errMsg: conductorErrors.err6,
        });
      }
    });
};

/**
 * Makes a request to a Book's respective Project to retrieve a signed download URL for a given file
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookFiles'
 *
 * @param {express.Request} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function downloadBookFile(
  req: z.infer<typeof downloadBookFileSchema>,
  res: Response
) {
  try {
    const [lib, coverID] = getLibraryAndPageFromBookID(req.params.bookID);
    const fileID = req.params.fileID;
    if (isEmptyString(lib) || isEmptyString(coverID)) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    }

    const project = await Project.findOne({
      $and: [
        { libreLibrary: lib },
        { libreCoverID: coverID },
        { visibility: "public" },
      ],
    }).lean();
    if (!project) {
      return res.send({
        err: false,
        msg: "No Projects associated with this resource.",
      });
    }

    const downloadURLs = await downloadProjectFiles(
      project.projectID,
      [fileID],
      true,
      "",
      true
    );

    if (
      !downloadURLs ||
      !Array.isArray(downloadURLs) ||
      downloadURLs.length < 1
    ) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err63,
      });
    }

    return res.send({
      err: false,
      msg: "Successfully generated download link!",
      url: downloadURLs[0], // only first index because only one file requested
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a Book's Table of Contents via an internal call to the LibreTexts API.
 * NOTE: This function should only be called AFTER the validation chain.
 * VALIDATION: 'getBookTOC'
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getBookTOC(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response
) {
  try {
    const bookService = new BookService({ bookID: req.params.bookID });
    const toc = await bookService.getBookTOCNew();
    return res.send({
      err: false,
      toc,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Retrieves a Book's Content Licensing Report from the LibreTexts API
 * Server and returns the data, if it exists.
 *
 * @param {z.infer<typeof getWithBookIDParamSchema>} req - Incoming request object.
 * @param {express.Response} res - Outgoing response object.
 */
async function getLicenseReport(
  req: z.infer<typeof getWithBookIDParamSchema>,
  res: Response
) {
  const notFoundResponse = {
    err: false,
    found: false,
    msg: "Couldn't find a Content Licensing Report for that resource.",
  };
  try {
    const { bookID } = req.params;
    let notFound = false;
    const licRep = await axios
      .get(`https://api.libretexts.org/licensereports/${bookID}.json`)
      .catch((err) => {
        if (err.response?.status === 404) {
          notFound = true;
        } else {
          throw err;
        }
      });
    if (notFound || !licRep.data?.id) {
      return res.send(notFoundResponse);
    }

    return res.send({
      err: false,
      found: true,
      msg: `Found Content Licensing Report for ${bookID}.`,
      data: licRep.data,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getBookPagesDetails(
  req: ZodReqWithUser<z.infer<typeof getWithBookIDParamSchema>>,
  res: Response
) {
  try {
    const { bookID } = req.params;

    const bookService = new BookService({ bookID });
    const toc = await bookService.getBookTOCNew();

    const [overviews, tags] = await Promise.all([
      bookService.getAllPageOverviews(toc),
      bookService.getAllPageTags(toc),
    ]);

    // Loop through table of contents and add overviews and tags to each page (based on ID)
    // Table of contents is a nested array, so we need to loop through each level
    const addOverviewsAndTags = (
      toc: TableOfContents
    ): TableOfContentsDetailed => {
      const pageOverview = overviews.find((o) => o.id === toc.id);
      const pageTags = tags.find((t) => t.id === toc.id)?.tags || [];

      const page: TableOfContentsDetailed = {
        ...toc,
        overview: pageOverview?.overview || "",
        tags: pageTags,
        children: toc.children.map(addOverviewsAndTags),
      };

      return page;
    };

    const detailedToc = addOverviewsAndTags(toc);

    return res.send({
      err: false,
      toc: detailedToc,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getPageDetail(
  req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
  res: Response
) {
  try {
    const { pageID: fullPageID } = req.params;
    const { coverPageID } = req.query;
    const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

    // Check if the user has access to the page. If not, check if they are a superadmin first before returning 403.
    const canAccess = await _canAccessPage(coverPageID, req.user.decoded.uuid);
    if (!canAccess) {
      const isSuperadmin = authAPI.checkHasRole(req.user, "libretexts", "superadmin", true);
      if (!isSuperadmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const bookService = new BookService({ bookID: coverPageID });
    const details = await bookService.getPageDetails(pageID);
    if (!details) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    return res.send({
      err: false,
      overview: details.overview,
      tags: details.tags,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getPageAISummary(
  req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
  res: Response
) {
  try {
    const { pageID: fullPageID } = req.params;
    const { coverPageID } = req.query;
    const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

    // Check if the user has access to the page. If not, check if they are a superadmin first before returning 403.
    const canAccess = await _canAccessPage(coverPageID, req.user.decoded.uuid);
    if (!canAccess) {
      const isSuperadmin = authAPI.checkHasRole(req.user, "libretexts", "superadmin", true);
      if (!isSuperadmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const bookService = new BookService({ bookID: coverPageID });
    const [error, summary] = await _generatePageAISummary(
      bookService,
      pageID,
      true
    );

    if (error) {
      return _handleAIErrorResponse(res, error);
    }

    return res.send({
      err: false,
      summary,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function getPageAITags(
  req: ZodReqWithUser<z.infer<typeof getWithPageIDParamAndCoverPageIDSchema>>,
  res: Response
) {
  try {
    const { pageID: fullPageID } = req.params;
    const { coverPageID } = req.query;
    const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

    // Check if the user has access to the page. If not, check if they are a superadmin first before returning 403.
    const canAccess = await _canAccessPage(coverPageID, req.user.decoded.uuid);
    if (!canAccess) {
      const isSuperadmin = authAPI.checkHasRole(req.user, "libretexts", "superadmin", true);
      if (!isSuperadmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const bookService = new BookService({ bookID: coverPageID });
    const [error, tags] = await _generatePageAITags(bookService, pageID, true);
    if (error) {
      return _handleAIErrorResponse(res, error);
    }

    return res.send({
      err: false,
      tags,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function generatePageImagesAltText(
  req: ZodReqWithUser<z.infer<typeof GeneratePageImagesAltTextSchema>>,
  res: Response
) {
  try {
    const { pageID: fullPageID } = req.params;
    const { coverPageID } = req.query;
    const { overwrite } = req.body;
    const [_, pageID] = getLibraryAndPageFromBookID(fullPageID);

    // Check if the user has access to the page. If not, check if they are a superadmin first before returning 403.
    const canAccess = await _canAccessPage(coverPageID, req.user.decoded.uuid);
    if (!canAccess) {
      const isSuperadmin = authAPI.checkHasRole(req.user, "libretexts", "superadmin", true);
      if (!isSuperadmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const bookService = new BookService({ bookID: coverPageID });
    const [error, success, modified_count] =
      await _generateAndApplyPageImagesAltText(bookService, pageID, overwrite);

    if (error) {
      return _handleAIErrorResponse(res, error);
    }

    return res.send({
      err: false,
      success,
      modified_count,
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

function _handleAIErrorResponse(res: Response, error: string) {
  switch (error) {
    case "location":
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err2,
      });
    case "env":
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    case "empty":
      return res.send({
        err: true,
        errMsg:
          "No summary available for this page. There may be insufficient content.",
      });
    case "badres":
      return res.status(400).send({
        err: true,
        errMsg: "Error generating page summary.",
      });
    case "internal":
    default:
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
  }
}

async function batchGenerateAIMetadata(
  req: ZodReqWithUser<z.infer<typeof batchGenerateAIMetadataSchema>>,
  res: Response
) {
  try {
    const [coverPageLibrary, coverPageID] = getLibraryAndPageFromBookID(
      req.params.bookID
    );

    const project = await Project.findOne({
      libreCoverID: coverPageID,
      libreLibrary: coverPageLibrary,
    });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }


    const user = await User.findOne({ uuid: req.user.decoded.uuid }).orFail();
    if (!user || !user.email) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err9,
      });
    }

    const canAccess = await _canAccessPage(
      req.params.bookID,
      req.user.decoded.uuid
    );

    // If user can't access page, check if they are superadmin. If not, deny access.
    if (!canAccess) {
      const isSuperAdmin = authAPI.checkHasRole(user, "libretexts", "superadmin", true);
      if (!isSuperAdmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const activeJob = project.batchUpdateJobs?.filter((j) =>
      ["pending", "running"].includes(j.status)
    );
    if (activeJob && activeJob.length > 0) {
      return res.status(400).send({
        err: true,
        errMsg: "A batch AI summaries job is already running for this project.",
      });
    }

    const generateResources: ProjectBookBatchUpdateJob["generateResources"] = {
      summaries: req.body.summaries,
      tags: req.body.tags,
      alttext: req.body.alttext,
    };
    const jobType: ProjectBookBatchUpdateJob["type"] = [];
    console.log("GENERATE RESOURCES", generateResources);
    if (generateResources.summaries?.generate) jobType.push("summaries");
    if (generateResources.tags?.generate) jobType.push("tags");
    if (generateResources.alttext?.generate) jobType.push("alttext");

    if (!jobType.length) {
      return res.status(400).send({
        err: true,
        errMsg: "No job type provided.",
      });
    }

    const job: ProjectBookBatchUpdateJob = {
      jobID: randomUUID(),
      type: jobType,
      status: "pending",
      dataSource: "generated",
      generateResources: generateResources,
      startTimestamp: new Date(),
      ranBy: req.user.decoded.uuid,
    };

    await Project.updateOne(
      {
        projectID: project.projectID,
      },
      {
        $push: {
          batchUpdateJobs: job,
        },
      }
    );

    _runBulkUpdateJob(
      job.jobID,
      job.type,
      project.projectID,
      req.params.bookID,
      job.dataSource,
      {
        summaries: req.body.summaries,
        tags: req.body.tags,
        alttext: req.body.alttext,
      },
      [user.email]
    ); // Don't await, send response immediately

    return res.send({
      err: false,
      msg: "Batch AI summaries generation started.",
    });
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function batchUpdateBookMetadata(
  req: ZodReqWithUser<z.infer<typeof batchUpdateBookMetadataSchema>>,
  res: Response
) {
  try {
    const newPageData = req.body.pages;
    if (!newPageData || !Array.isArray(newPageData) || newPageData.length < 1) {
      return res.status(400).send({
        err: true,
        errMsg: "No page data provided.",
      });
    }

    const [coverPageLibrary, coverPageID] = getLibraryAndPageFromBookID(
      req.params.bookID
    );

    const project = await Project.findOne({
      libreCoverID: coverPageID,
      libreLibrary: coverPageLibrary,
    });
    if (!project) {
      return res.status(404).send({
        err: true,
        errMsg: conductorErrors.err11,
      });
    }

    const user = await User.findOne({ uuid: req.user.decoded.uuid }).orFail();
    if (!user || !user.email) {
      return res.status(400).send({
        err: true,
        errMsg: conductorErrors.err9,
      });
    }

    const canAccess = await _canAccessPage(
      req.params.bookID,
      req.user.decoded.uuid
    );

    // If user can't access page, check if they are superadmin. If not, deny access.
    if (!canAccess) {
      const isSuperAdmin = authAPI.checkHasRole(user, "libretexts", "superadmin", true);
      if (!isSuperAdmin) {
        return res.status(403).send({
          err: true,
          errMsg: conductorErrors.err8,
        });
      }
    }

    const activeJob = project.batchUpdateJobs?.filter((j) =>
      ["pending", "running"].includes(j.status)
    );
    if (activeJob && activeJob.length > 0) {
      return res.status(400).send({
        err: true,
        errMsg: "A batch AI summaries job is already running for this project.",
      });
    }

    // If there are more than 10 pages, start a batch update job, otherwise update pages immediately
    if (newPageData.length > 10) {
      const job: ProjectBookBatchUpdateJob = {
        jobID: randomUUID(),
        type: ["summaries", "tags"], // Default to summaries+tags for user data source
        status: "pending",
        dataSource: "user",
        successfulMetaPages: 0,
        failedMetaPages: 0,
        startTimestamp: new Date(),
        ranBy: req.user.decoded.uuid,
      };

      await Project.updateOne(
        {
          projectID: project.projectID,
        },
        {
          $push: {
            batchUpdateJobs: job,
          },
        }
      );

      _runBulkUpdateJob(
        job.jobID,
        job.type,
        project.projectID,
        req.params.bookID,
        job.dataSource,
        undefined,
        [user.email],
        newPageData
      ); // Don't await, send response immediately

      return res.send({
        err: false,
        msg: "Bulk update job initiated succesfully!",
      });
    } else {
      const bookService = new BookService({
        bookID: `${coverPageLibrary}-${coverPageID}`,
      });
      let successful = 0;
      const errors = {
        location: 0,
        internal: 0,
      };

      const promises: ReturnType<typeof bookService.updatePageDetails>[] = [];

      for (const page of newPageData) {
        promises.push(
          bookService.updatePageDetails(page.id, page.summary, page.tags)
        );
      }

      for (const updateRes of await Promise.allSettled(promises)) {
        if (updateRes.status === "rejected") {
          errors.internal++;
        } else {
          if (updateRes.value[0] !== null) {
            if (updateRes.value[0] === "location") {
              errors.location++;
            }
            if (updateRes.value[0] === "internal") {
              errors.internal++;
            }
          } else {
            successful++;
          }
        }
      }

      const buildResultsString = () => {
        if (successful === newPageData.length) {
          return "All pages updated successfully.";
        }
        return `${successful} pages updated successfully. ${errors.internal} pages failed to update due to internal errors. ${errors.location} pages failed to update because they could not be found.`;
      };

      return res.send({
        err: false,
        msg: buildResultsString(),
      });
    }
  } catch (e) {
    debugError(e);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Updates a Project's Book's metadata (overview, tags, or image alt text) in bulk.
 * NOTE: We purposefully do most of the async calls one by one to avoid rate limiting.
 * Using Promise.all (even with delay) will generally exceed limits for either MindTouch or OpenAI
 * @param jobID - The job ID to run
 * @param jobType - The type of job to run (summaries, tags, alttext, or any combination)
 * @param projectID - The project ID
 * @param bookID - The id of the connected book
 * @param dataSource - The data source (user or generated). User means the data is provided in the request, generated means we will use AI to generate it
 * @param emailsToNotify - The emails to notify when the job is complete
 * @param data - The data to update (only for user data source)
 */
async function _runBulkUpdateJob(
  jobID: string,
  jobType: ProjectBookBatchUpdateJob["type"],
  projectID: string,
  bookID: string,
  dataSource: ProjectBookBatchUpdateJob["dataSource"],
  generateResources: ProjectBookBatchUpdateJob["generateResources"],
  emailsToNotify: string[],
  data?: { id: string; summary?: string; tags?: string[] }[] // Only for user data source
): Promise<void> {
  try {
    // Outer catch-block will catch errors with updating a failed job
    try {
      // Inner catch-block will catch any errors and update job status
      if (!data && dataSource === "user") {
        throw new Error("No data provided for user data source");
      }

      if (!generateResources && dataSource === "generated") {
        throw new Error(
          "Resource generation not specified for generated data source"
        );
      }

      console.log(`JOB ${jobID} STARTED.`);

      // Create book service and get table of contents
      const bookService = new BookService({ bookID });
      const toc = await bookService.getBookTOCNew();
      const pageIDs: string[] = [];
      const content = toc.children; // skip root pages

      // recursively get all page IDs
      const getIDs = (content: TableOfContents[]) => {
        content.forEach((item) => {
          pageIDs.push(item.id);
          if (item.children) {
            getIDs(item.children);
          }
        });
      };
      getIDs(content);

      // Update job with initial details
      await Project.updateOne(
        {
          projectID,
        },
        {
          $set: {
            "batchUpdateJobs.$[job].status": "running",
          },
        },
        {
          arrayFilters: [{ "job.jobID": jobID }],
        }
      );

      // Job error tracking
      const errors = {
        meta: {
          location: 0,
          empty: 0,
          internal: 0,
        },
        images: {
          location: 0,
          empty: 0,
          internal: 0,
        },
      };
      let successfulImages = 0;
      let failedImages = 0;

      // Initialize new page details array
      // page overview and tags can be updated in the same call, gather both as necessary before updating page
      let newPageDetails: {
        id: string;
        summary?: string;
        tags?: string[];
        error?: string;
      }[] = [];
      if (dataSource === "user") {
        newPageDetails = data || [];
      }

      // If data source is generated, get page text content and generate tags and/or summaries
      if (dataSource === "generated") {
        // Get pages text content
        const pageTextPromises = pageIDs.map((p) => {
          // Generate a random delay between 0 and 1s to avoid rate limiting
          const delay = Math.floor(Math.random() * 1000);
          return new Promise<string>((resolve) => {
            setTimeout(async () => {
              resolve(await bookService.getPageTextContent(p));
            }, delay);
          });
        });

        const pageTexts = await Promise.allSettled(pageTextPromises);
        const pageTextsMap = new Map<string, string>();
        pageIDs.forEach((p, i) => {
          if (pageTexts[i].status === "fulfilled") {
            console.log("Collected page text for", p);
            pageTextsMap.set(p, pageTexts[i].value);
          }
        });

        // Do alt-text updates
        if (generateResources?.alttext?.generate) {
          // Purposefully doing this one-by-one because of strict rate limits
          for (const page of pageTextsMap) {
            const [errCode, success, modifiedCount] =
              await _generateAndApplyPageImagesAltText(
                bookService,
                page[0],
                generateResources.alttext.overwrite ?? false
              ).catch((e) => {
                debugError(e);
                return ["internal", false, 0];
              });
            console.log(
              `Generated alt text for ${page[0]} with success: ${success} and error: ${errCode}`
            );
            if (!success) {
              if (errCode === "location") {
                errors.images.location++;
              }
              if (errCode === "empty") {
                errors.images.empty++;
              }
              if (errCode === "internal") {
                errors.images.internal++;
              }
            } else {
              if (typeof modifiedCount === "number") {
                successfulImages += modifiedCount;
              }
            }
          }

          // update job status
          await Project.updateOne(
            {
              projectID,
            },
            {
              $set: {
                "batchUpdateJobs.$[job].successfulImagePages": successfulImages,
                "batchUpdateJobs.$[job].failedImagePages": failedImages,
                "batchUpdateJobs.$[job].imageResults": errors.images,
              },
            },
            {
              arrayFilters: [{ "job.jobID": jobID }],
            }
          );
        }

        // Create AI summary for each page
        if (generateResources?.summaries?.generate) {
          const aiSummaryPromises = [];
          for (const page of pageTextsMap) {
            aiSummaryPromises.push(
              _generatePageAISummary(
                bookService,
                page[0],
                generateResources.summaries.overwrite ?? false,
                page[1]
              )
            );
          }

          const aiSummaryResults = await Promise.allSettled(aiSummaryPromises);
          for (let i = 0; i < aiSummaryResults.length; i++) {
            const pageID = Array.from(pageTextsMap.keys())[i] || null;
            if (!pageID) {
              continue;
            }
            const aiSummaryRes = aiSummaryResults[i];
            if (aiSummaryRes.status === "fulfilled") {
              newPageDetails.push({
                id: pageID,
                summary: aiSummaryRes.value[1],
              });
            } else {
              switch (aiSummaryRes.reason) {
                case "location":
                  errors.meta.location++;
                  break;
                case "empty":
                  errors.meta.empty++;
                  break;
                case "internal":
                default:
                  errors.meta.internal++;
                  break;
              }

              newPageDetails.push({
                id: pageID,
                summary: "",
                error: aiSummaryRes.reason,
              });
            }
          }
        }

        if (generateResources?.tags?.generate) {
          const aiTagsResults: (["empty" | "internal" | null, string[]])[] = [];
          for (const page of pageTextsMap) {
            const result = await _generatePageAITags(
              bookService,
              page[0],
              generateResources.tags.overwrite ?? false,
              page[1]
            ).catch((e) => {
              debugError(e);
              return ["internal", [] as string[]];
            });
            // @ts-ignore
            aiTagsResults.push(result)
          }

          for (let i = 0; i < aiTagsResults.length; i++) {
            const pageID = Array.from(pageTextsMap.keys())[i] || null;
            const pageTagsRes = aiTagsResults[i];
            console.log(`AI TAG RES FOR PAGE ${pageID}:`, pageTagsRes);

            if (!pageID) {
              continue;
            }

            const found = newPageDetails.find((p) => p.id === pageID);
            if (pageTagsRes[0] !== null) {
              if (pageTagsRes[0] === "empty") {
                errors.meta.empty++;
              } else {
                errors.meta.internal++;
              }

              // Update existing page details with error
              if (found) {
                found.error = pageTagsRes[0];
                continue;
              }

              // Add new page details entry with error
              newPageDetails.push({
                id: pageID,
                error: pageTagsRes[0],
              });

              continue;
            }

            // Update existing page details with tags
            if (found) {
              found.tags = pageTagsRes[1];
              continue;
            }

            // Otherwise, add new page details entry with tags
            newPageDetails.push({
              id: pageID,
              tags: pageTagsRes[1],
            });
          }
        }
      }

      // Do final page details updates
      let successfulMeta = 0;
      let failedMeta = 0;

      const withoutErrors = newPageDetails.reduce((acc, curr) => {
        if (curr.error) {
          switch (curr.error) {
            case "empty":
              errors.meta.empty++;
              break;
            case "internal":
            default:
              errors.meta.internal++;
              break;
          }
          return acc;
        }
        return [...acc, curr];
      }, [] as { id: string; summary?: string; tags?: string[] }[]);

      for (const page of withoutErrors) {
        const updateRes = await bookService.updatePageDetails(
          page.id,
          page.summary,
          page.tags
        );
        if (updateRes[0] !== null) {
          failedMeta++;
          if (updateRes[0] === "location") {
            errors.meta.location++;
          }
          if (updateRes[0] === "internal") {
            errors.meta.internal++;
          }
        } else {
          successfulMeta++;
        }
      }

      // Delay job for 1 minute to allow caching to update
      await new Promise((resolve) => setTimeout(resolve, 60000));

      console.log(
        `JOB ${jobID} FINISHED: ${successfulMeta} pages succeeded, failed ${failedMeta}.`
      );

      // Final update
      await Project.updateOne(
        {
          projectID,
        },
        {
          $set: {
            "batchUpdateJobs.$[job].status": "completed",
            "batchUpdateJobs.$[job].endTimestamp": new Date(),
            "batchUpdateJobs.$[job].imageResults": errors.images,
            "batchUpdateJobs.$[job].successfulImagePages": successfulImages,
            "batchUpdateJobs.$[job].failedImagePages": failedImages,
            "batchUpdateJobs.$[job].metaResults": errors.meta,
            "batchUpdateJobs.$[job].successfulMetaPages": successfulMeta,
            "batchUpdateJobs.$[job].failedMetaPages": failedMeta,
          },
        },
        {
          arrayFilters: [{ "job.jobID": jobID }],
        }
      );

      const parsedMetaResults: Record<string, any> = Object.entries(
        errors.meta || {}
      ).filter(([_, value]) => value !== 0);
      const metaResultsString: string = parsedMetaResults
        .map(([key, value]: [string, any]) => {
          return `${value} pages failed with error: ${key}`;
        })
        .join(", ");

      const parsedImageResults: Record<string, any> = Object.entries(
        errors.images || {}
      ).filter(([_, value]) => value !== 0);
      const imageResultsString: string = parsedImageResults
        .map(([key, value]: [string, any]) => {
          return `${value} pages with images failed with error: ${key}`;
        })
        .join(", ");

      const resultsString = [metaResultsString, imageResultsString]
        .filter((r) => r.length > 0)
        .join("; ");

      const book = await bookService.getBookRecord();
      const bookTitle = book?.title || "Unknown Book";

      if (dataSource === "generated") {
        const jobTypeString = jobType.map((t) => t).join(" and ");
        await mailAPI.sendBatchBookAIMetadataFinished(
          emailsToNotify,
          projectID,
          jobID,
          jobTypeString,
          successfulMeta,
          successfulImages,
          resultsString,
          bookTitle
        );
      } else {
        await mailAPI.sendBatchBookUpdateFinished(
          emailsToNotify,
          projectID,
          jobID,
          successfulMeta,
          resultsString,
          bookTitle
        );
      }
    } catch (e: any) {
      // Catch any errors and update job status
      await Project.updateOne(
        {
          projectID,
        },
        {
          $set: {
            "batchUpdateJobs.$[job].status": "failed",
            "batchUpdateJobs.$[job].endTimestamp": new Date(),
            "batchUpdateJobs.$[job].error": e.message
              ? e.message
              : e.toString(),
          },
        },
        {
          arrayFilters: [{ "job.jobID": jobID }],
        }
      );
    }
  } catch (err: any) {
    debugError(err);
  }
}

/**
 * Internal function to generate an AI summary for a page.
 * @param pageID - The page ID to generate a summary for.
 * @param overwrite - Whether to overwrite an existing summary.
 * @param _pageText - Text content of the page. Optional, and will be fetched if not provided.
 * @returns [error, summary] - Error message or null, and the generated summary.
 */
async function _generatePageAISummary(
  bookService: BookService,
  pageID: number | string,
  overwrite: boolean,
  _pageText?: string
): Promise<["empty" | "internal" | null, string]> {
  let error = null;
  let summary = "";
  let pageText = _pageText;
  try {
    // If existing summary and not overwriting, return it
    const { overview: existing } = await bookService.getPageOverview(
      pageID.toString()
    );
    if (existing && !overwrite) {
      return [null, existing];
    }

    // If no page text provided, fetch it
    if (!pageText) {
      pageText = await bookService.getPageTextContent(pageID.toString());
    }
    if (!pageText) {
      throw new Error("empty");
    }

    const aiService = new AIService();
    const chunks = await aiService.chunkText(pageText, 2000);
    if (chunks.length === 0) {
      throw new Error("empty");
    }

    const aiSummaryOutput = await aiService.generatePageOverview(chunks);

    if (aiSummaryOutput === "empty") {
      throw new Error("empty");
    } else if (aiSummaryOutput === "internal") {
      throw new Error("internal");
    } else {
      summary = aiSummaryOutput;
    }
  } catch (err: any) {
    error = err.message ?? "internal";
  }
  return [error, summary];
}

/**
 * Internal function to generate AI tags for a page.
 * @param pageID - The page ID to generate tags for.
 * @param overwrite - Whether to overwrite existing tags.
 * @param _pageText - Text content of the page. Optional, and will be fetched if not provided.
 * @returns [error, tags] - Error message or null, and the generated tags.
 */
async function _generatePageAITags(
  bookService: BookService,
  pageID: number | string,
  overwrite: boolean,
  _pageText?: string
): Promise<["empty" | "internal" | null, string[]]> {
  let error = null;
  let tags: string[] = [];
  let pageText = _pageText;
  try {
    const existing = await bookService.getPageTags(pageID.toString());
    const nonSystemTags = existing.filter((t) => !bookService.DISABLED_PAGE_TAG_PREFIXES.some((p) => t["@value"].startsWith(p)));
    if (nonSystemTags?.length > 0 && !overwrite) {
      return [null, []];
    }

    if (!pageText) {
      pageText = await bookService.getPageTextContent(pageID.toString());
    }
    if (!pageText) {
      throw new Error("empty");
    }

    const aiService = new AIService();
    const chunks = await aiService.chunkText(pageText, 2000);
    if (chunks.length === 0) {
      throw new Error("empty");
    }

    const tagsRes = await aiService.generatePageTags(chunks);
    if (tagsRes === "empty") {
      throw new Error("empty");
    }
    if (tagsRes === "error" || !Array.isArray(tagsRes)) {
      throw new Error("internal");
    }

    tags = tagsRes;
  } catch (err: any) {
    error = err.message ?? "internal";
  }
  return [error, tags];
}

/**
 * Internal function to generate AI tags for a page.
 * @param bookService - The BookService instance to use.
 * @param pageID - The page ID to generate tags for.
 * @param overwrite - Whether to overwrite existing tags.
 * @returns {[string|null, boolean, number]} - A tuple containing of [error message, success status, modified count], or undefined if an error occurred.
 */
async function _generateAndApplyPageImagesAltText(
  bookService: BookService,
  pageID: number | string,
  overwrite: boolean
): Promise<["empty" | "internal" | null, boolean, number]> {
  let error = null;
  let success = false;
  let modifiedCount = 0;
  try {
    const pageImageData = await bookService.getPageImages(pageID.toString());
    if (!pageImageData) {
      return [null, true, 0]; // If page doesn't have images, return success
    }

    const calcImages = (imagesRes: PageImagesRes): PageFile[] => {
      let arr = [];
      if (Array.isArray(imagesRes.file)) {
        arr = imagesRes.file;
      } else {
        arr = [imagesRes.file];
      }

      if (!overwrite) {
        arr = arr.filter((f) => {
          if (!f.properties || !f.properties.property) return true; // no properties, include

          // Only include images that don't have an "alt" property
          if (Array.isArray(f.properties.property)) {
            return !f.properties.property.some(
              (p) => p["@name"] === "alt" && p.contents["#text"]
            );
          }
          return !(
            f.properties.property["@name"] === "alt" &&
            f.properties.property.contents["#text"]
          );
        });
      }

      return arr;
    };

    const imageData = calcImages(pageImageData);

    const fileContentsPromises: Promise<string>[] = [];
    for (let i = 0; i < imageData.length; i++) {
      const fileID = imageData[i]["@id"];
      fileContentsPromises.push(
        bookService.getFileContent(pageID.toString(), fileID, "thumb")
      );
    }

    const fileContentsResults = await Promise.allSettled(fileContentsPromises);
    const fileContents: { fileID: string; contents: string }[] =
      fileContentsResults.map((r, idx) => {
        const fileID = imageData[idx]["@id"];
        if (r.status === "fulfilled") {
          return { fileID, contents: r.value };
        }
        return { fileID, contents: "" };
      });

    // Initialize final results array
    const altTexts: _generatePageImagesAltTextResObj[] = [];

    const aiService = new AIService();

    // Purposely not using Promise.all here to avoid rate limiting issues (images use lots of tokens)
    for (let i = 0; i < imageData.length; i++) {
      const fileID = imageData[i]["@id"];
      const fileType = imageData[i]["contents"]["@type"];
      const fileSrc = imageData[i]["contents"]["@href"];
      const content = fileContents.find((f) => f.fileID === fileID)?.contents;

      if (!content) {
        altTexts.push({
          fileID,
          src: fileSrc,
          altText: "",
          error: "fetcherror",
        });
        continue;
      }

      const completion = await aiService.generateImageAltText(
        fileType,
        content,
        1000
      );

      if (["empty", "error", "unsupported"].includes(completion)) {
        altTexts.push({
          fileID,
          src: fileSrc,
          altText: "",
          error: completion,
        });
        continue;
      }

      const findProperties = (): PageFileProperty[] => {
        const properties = imageData[i].properties?.property;
        if (!properties) return [];
        return Array.isArray(properties) ? properties : [properties];
      };

      const fileProperties = findProperties();
      const foundAlt = fileProperties.find((p) => p["@name"] === "alt");
      if (foundAlt) {
        if (overwrite) {
          foundAlt.contents["#text"] = completion;
        }
      } else {
        // Add new alt property
        fileProperties.push({
          "@revision": "",
          "@href": "",
          "@resid": "",
          "@resource-is-deleted": "",
          "@resource-rev-is-deleted": "",
          "@etag": "",
          "date.modified": "",
          "@name": "alt",
          contents: {
            "@type": "text",
            "@href": "",
            "@size": "0",
            "#text": completion,
          },
        });
      }

      altTexts.push({
        fileID,
        src: fileSrc,
        altText: completion,
        properties: fileProperties,
      });
    }

    // Get page content and parse for image elements
    const pageContent = await bookService.getPageContent(
      pageID.toString(),
      "json"
    );
    // const decodedContent = decodeURIComponent(pageContent);
    const cheerioContent = cheerio.load(pageContent);
    const imageElements = cheerioContent("img");

    if (!imageElements || imageElements.length === 0) {
      return [null, true, 0]; // If we couldn't detect any images, return success
    }

    // Need to update file properties
    for (let i = 0; i < altTexts.length; i++) {
      const file = altTexts[i];
      if (file.error || !file.altText) {
        console.log("No alt text for image: ", file.fileID, file.error);
        continue;
      }

      if (!file.properties) continue;

      const mappedProperties = file.properties.map((p) => ({
        etag: p["@etag"],
        name: p["@name"],
        value: p.contents["#text"],
      }));

      const res = await CXOneFetch({
        scope: "files",
        path: file.fileID,
        api: MindTouch.API.File.PUT_File_Properties,
        subdomain: bookService.library,
        options: {
          method: "PUT",
          body: MindTouch.Templates.PUT_FileProperties(mappedProperties),
          headers: {
            "Content-Type": "application/xml",
          },
        },
      }).catch((e) => {
        console.error(
          "Error updating file properties for file: ",
          file.fileID,
          e
        );
        return { status: 500 };
      });

      if (res.status !== 200) {
        console.log("Error updating file properties for file: ", file.fileID);
      }
    }

    let didModify = false;
    for (let i = 0; i < altTexts.length; i++) {
      const file = altTexts[i];

      if (file.error || !file.altText) {
        continue;
      }

      // Query params may vary between the file response and what is actually in the content
      // So we need to get the base src URL for comparison
      const baseSrc = new URL(file.src).pathname;

      const found = imageElements.filter((_, el) => {
        const src = cheerioContent(el).attr("src");
        if (!src) return false;
        return src.includes(baseSrc);
      });

      if (!found || found.length === 0) {
        continue;
      }

      // Set new alt text
      found.each((_, el) => {
        const currElementAltText = el.attribs["alt"];
        if (overwrite) {
          cheerioContent(el).attr("alt", file.altText); // If overwrite is true, always update the alt text
        } else if (["", " "].includes(currElementAltText)) {
          // If the alt text is empty, update it, regardless of overwrite (For some reason many img's have " " as alt text, so don't consider those as existing alt text)
          cheerioContent(el).attr("alt", file.altText);
        } else if (
          aiService.supportedFileExtensions.some((ext) =>
            currElementAltText.endsWith(`.${ext}`)
          )
        ) {
          // If the alt text ends with one of the supported file extensions, update it
          // MindTouch sets the default alt text to the file name, so we'll consider it as junk and update it
          cheerioContent(el).attr("alt", file.altText);
        }
        // If the alt text is not empty and overwrite is false, don't update it
      });
      didModify = true;
      modifiedCount++;
    }

    if (!didModify) {
      return [null, true, 0]; // If we didn't modify any images, return success
    }

    const modifiedContentXML = cheerioContent.xml();
    if (!modifiedContentXML) {
      return ["internal", false, 0];
    }

    const updateSuccess = await bookService.updatePageContent(
      pageID.toString(),
      modifiedContentXML
    );
    if (!updateSuccess) {
      throw new Error("internal");
    }

    success = true;
  } catch (err: any) {
    error = err.message ?? "internal";
  }
  return [error, success, modifiedCount];
}

async function updatePageDetails(
  req: ZodReqWithUser<z.infer<typeof updatePageDetailsSchema>>,
  res: Response
) {
  try {
    const { pageID } = req.params;
    const { coverPageID } = req.query;
    const { summary, tags } = req.body;

    const canAccess = await _canAccessPage(coverPageID, req.user.decoded.uuid);
    if (!canAccess) {
      return res.status(403).send({
        err: true,
        errMsg: conductorErrors.err8,
      });
    }

    const bookService = new BookService({ bookID: coverPageID });
    const [error, success] = await bookService.updatePageDetails(
      pageID,
      summary,
      tags
    );

    if (error) {
      switch (error) {
        case "location":
          return res.status(404).send({
            err: true,
            errMsg: conductorErrors.err2,
          });
        case "internal":
          return res.status(500).send({
            err: true,
            errMsg: conductorErrors.err6,
          });
      }
    }

    if (!success) {
      return res.status(500).send({
        err: true,
        errMsg: conductorErrors.err6,
      });
    }

    return res.send({
      err: false,
      msg: "Page details updated successfully.",
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

async function bulkUpdatePageTags(
  req: ZodReqWithUser<z.infer<typeof bulkUpdatePageTagsSchema>>,
  res: Response
) {
  try {
    const { bookID } = req.params;
    const { pages } = req.body;

    const bookService = new BookService({ bookID });

    const updatePromises = [];
    for (let i = 0; i < pages.length; i++) {
      const promise = new Promise((resolve, reject) => {
        setTimeout(async () => {
          const page = pages[i];
          const [error, success] = await bookService.updatePageDetails(
            page.id,
            undefined,
            page.tags
          );
          if (error) {
            reject(error);
          }
          resolve({ error, success });
        }, 1000);
      });
      updatePromises.push(promise);
    }

    const results = await Promise.allSettled(updatePromises);
    const failed = results.filter((r) => r.status === "rejected").length;
    const processed = results.filter((r) => r.status === "fulfilled").length;

    return res.send({
      err: false,
      failed,
      processed,
    });
  } catch (err) {
    debugError(err);
    return res.status(500).send({
      err: true,
      errMsg: conductorErrors.err6,
    });
  }
}

/**
 * Generates a JSON file containing Commons Books listings for use by 3rd parties.
 * @returns {boolean} True if export creation succeeded, false otherwise.
 */
const generateKBExport = () => {
  let kbExport = {
    date: new Date().toISOString(),
    titles: [],
  };
  return new Promise((resolve, _reject) => {
    resolve(
      Book.aggregate([
        {
          $addFields: {
            coverID: {
              $arrayElemAt: [{ $split: ["$bookID", "-"] }, 1],
            },
          },
        },
        {
          $lookup: {
            from: "projects",
            let: {
              lib: "$library",
              coverID: "$coverID",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$$lib", "$libreLibrary"] },
                      { $eq: ["$$coverID", "$libreCoverID"] },
                      { $eq: ["$visibility", "public"] },
                    ],
                  },
                },
              },
            ],
            as: "project",
          },
        },
        {
          $addFields: {
            project: {
              $arrayElemAt: ["$project", 0],
            },
          },
        },
        {
          $addFields: {
            isbn: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$isbn", false] },
                    { $gt: [{ $strLenBytes: "$isbn" }, 0] },
                  ],
                },
                "$isbn",
                "$project.isbn", // undefined
              ],
            },
            sourceOriginalPublicationDate: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$sourceOriginalPublicationDate", false] },
                    {
                      $gt: [
                        { $strLenBytes: "$sourceOriginalPublicationDate" },
                        0,
                      ],
                    },
                  ],
                },
                "$sourceOriginalPublicationDate",
                "$project.sourceOriginalPublicationDate", // undefined
              ],
            },
          },
        },
        {
          $project: {
            _id: 0,
            bookID: 1,
            title: 1,
            author: 1,
            library: 1,
            license: 1,
            summary: 1,
            thumbnail: 1,
            isbn: 1,
            sourceOriginalPublicationDate: 1,
            lastUpdated: 1,
          },
        },
      ])
    );
  })
    .then((commonsBooks) => {
      if (Array.isArray(commonsBooks)) {
        kbExport.expected = commonsBooks.length;
        commonsBooks.forEach((item) => {
          let bookOut = {
            publication_title: String(item.title)
              .trim()
              .replace(/\\n/gi, " ")
              .replace("Book: ", ""),
            title_id: item.bookID,
            title_url: genPermalink(item.bookID),
            coverage_depth: "fulltext",
            access_type: "F",
            publisher_name: "LibreTexts",
          };
          if (
            typeof item.thumbnail === "string" &&
            !isEmptyString(item.thumbnail)
          ) {
            bookOut.thumbnail_url = item.thumbnail;
          }
          if (
            typeof item.license === "string" &&
            !isEmptyString(item.license)
          ) {
            bookOut.license = item.license;
          }
          if (typeof item.isbn === "string" && !isEmptyString(item.isbn)) {
            bookOut.print_identifier = item.isbn;
          }
          if (item.sourceOriginalPublicationDate) {
            bookOut.date_monograph_published_online =
              item.sourceOriginalPublicationDate.toString();
          }
          if (typeof item.lastUpdated === "string") {
            const lastUpdateDate = new Date(item.lastUpdated);
            if (isValidDateObject(lastUpdateDate)) {
              bookOut.date_last_updated = item.lastUpdated;
            }
          }
          if (
            typeof item.summary === "string" &&
            !isEmptyString(item.summary)
          ) {
            bookOut.description = item.summary;
          }
          if (item.library === "espanol") {
            bookOut.language = "spanish";
          } else {
            bookOut.language = "english";
          }
          if (typeof item.author === "string" && !isEmptyString(item.author)) {
            let itemAuthors = [];
            let textmapMatch = item.author.match(/textmap/gi);
            if (textmapMatch === null) {
              // not a textmap, try to parse authors
              let authorsString = item.author.replace(/(&|\band\b)/gi, ",");
              let authors = authorsString.split(/,/gi);
              if (authors.length > 0) {
                authors.forEach((author) => {
                  let authorProcess = author.trim();
                  if (
                    authorProcess.toLowerCase() !==
                    "no attribution by request" &&
                    authorProcess.length > 0
                  ) {
                    itemAuthors.push(authorProcess);
                  }
                });
              }
            } else {
              // textmap, mark author as LibreTexts
              itemAuthors.push("LibreTexts");
            }
            if (itemAuthors.length > 0) bookOut.authors = itemAuthors;
          }
          kbExport.titles.push(bookOut);
        });
        return fs.ensureDir("./public");
      } else throw new Error("notarray");
    })
    .then(() => fs.writeJson("./public/kbexport.json", kbExport))
    .then(() => true)
    .catch((err) => {
      debugError(err);
      return false;
    });
};

/**
 * Attempts to retrieve the Knowledge Base export file(s) if available or generate them
 * immediately if not found.
 * @param {Object} req - The Express.js request object.
 * @param {Object} res - The Express.js response object.
 */
const retrieveKBExport = (_req: Request, res: Response) => {
  fs.pathExists("./public/kbexport.json")
    .then((exists) => {
      if (exists === true) return true;
      return generateKBExport(); // generate on-the-fly
    })
    .then((generated) => {
      if (generated === true) {
        return res
          .status(200)
          .sendFile("./public/kbexport.json", { root: "." });
      }
      throw new Error("kbexport-notfound");
    })
    .catch((err) => {
      debugError(err);
      return res.status(500).send({
        err: true,
        msg: conductorErrors.err45,
      });
    });
};

async function _canAccessPage(
  coverPageID: string,
  userID: string
): Promise<boolean> {
  try {
    const [lib, coverID] = getLibraryAndPageFromBookID(coverPageID);
    if (!lib || !coverID) {
      return false;
    }

    const project = await Project.findOne({
      libreLibrary: lib,
      libreCoverID: coverID,
    });

    if (!project) {
      return false;
    }

    return projectsAPI.checkProjectMemberPermission(project, userID);
  } catch (err) {
    debugError(err);
    return false;
  }
}

export async function _getBookPublicOrInstructorAssetsCount(ids: string[]): Promise<{
  bookID: string;
  publicAssets: number;
  instructorAssets: number;
}[]> {
  return Book.aggregate([{
    $match: {
      bookID: { $in: ids },
    }
  },
  {
    $lookup: {
      from: "projects",
      let: {
        bookIdParts: {
          $split: ["$bookID", "-"]
        }
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                {
                  $eq: [
                    "$libreLibrary",
                    {
                      $arrayElemAt: [
                        "$$bookIdParts",
                        0
                      ]
                    }
                  ]
                },
                {
                  $eq: [
                    "$libreCoverID",
                    {
                      $arrayElemAt: [
                        "$$bookIdParts",
                        1
                      ]
                    }
                  ]
                }
              ]
            }
          }
        },
        {
          $project: {
            projectID: 1
          }
        }
      ],
      as: "projectDetails"
    }
  },
  {
    $addFields: {
      project: {
        $first: "$projectDetails"
      }
    }
  },
  {
    $match: {
      "project.projectID": {
        $exists: true,
        $ne: ""
      }
    }
  },
  {
    $lookup: {
      from: "projectfiles",
      localField: "project.projectID",
      foreignField: "projectID",
      as: "projectFiles"
    }
  },
  {
    $project: {
      bookID: "$bookID",
      publicAssets: {
        $size: {
          $filter: {
            input: "$projectFiles",
            as: "file",
            cond: {
              $eq: [
                "$$file.access",
                "public"
              ]
            }
          }
        }
      },
      instructorAssets: {
        $size: {
          $filter: {
            input: "$projectFiles",
            as: "file",
            cond: {
              $eq: [
                "$$file.access",
                "instructors"
              ]
            }
          }
        }
      }
    }
  }]);
}

export default {
  syncWithLibraries,
  runAutomatedSyncWithLibraries,
  getCommonsCatalog,
  getMasterCatalog,
  createBook,
  deleteBook,
  getBookDetail,
  getBookPeerReviews,
  getCatalogFilterOptions,
  addBookToCustomCatalog,
  removeBookFromCustomCatalog,
  downloadBookFile,
  getBookTOC,
  getLicenseReport,
  getBookPagesDetails,
  getPageDetail,
  getPageAISummary,
  generatePageImagesAltText,
  batchGenerateAIMetadata,
  batchUpdateBookMetadata,
  getPageAITags,
  updatePageDetails,
  bulkUpdatePageTags,
  retrieveKBExport,
  _getBookPublicOrInstructorAssetsCount
};
