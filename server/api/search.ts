import Promise from "bluebird";
import { query } from "express-validator";
import User from "../models/user.js";
import Project from "../models/project.js";
import Book from "../models/book.js";
import Homework from "../models/homework.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { isValidDateObject } from "../util/helpers.js";
import projectAPI from "./projects.js";
import authAPI from "./auth.js";
import {
  TypedReqQueryWithUser,
  ZodReqWithOptionalUser,
  ZodReqWithUser,
} from "../types/Express.js";
import { Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { Mongoose } from "mongoose";
import { FileInterface } from "../models/file.js";
import { TypeOf, z } from "zod";
import { conductorSearchSchema } from "./validators/search.js";
import AssetTag from "../models/assettag.js";

export const projectSortOptions = [
  "title",
  "progress",
  "classification",
  "visibility",
  "lead",
  "updated",
] as const;
export const bookSortOptions = [
  "title",
  "author",
  "library",
  "subject",
  "affiliation",
] as const;
export const homeworkSortOptions = ["name", "description"] as const;
export const userSortOptions = ["first", "last"] as const;

/**
 * Performs a global search across multiple Conductor resource types (e.g. Projects, Books, etc.)
 */
async function performSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof conductorSearchSchema>>,
  res: Response
) {
  try {
    console.log(req.query);
    const query = req.query.searchQuery;
    const queryRegex = {
      $regex: query,
      $options: "i",
    };
    const projSortOption = req.query?.projSort || "title";
    const bookSortOption = req.query?.bookSort || "title";
    const homeworkSortOption = req.query?.hwSort || "name";
    const userSortOption = req.query?.userSort || "first";
    let projectFilters = [];
    let projectFiltersOptions = {};

    const isSuperAdmin = req.user
      ? authAPI.checkHasRole(req.user, "libretexts", "superadmin")
      : false;

    /* Project Location Filter, only needed if 'local' */
    if (
      typeof req.query.projLocation === "string" &&
      req.query.projLocation === "local"
    ) {
      projectFilters.push({ orgID: process.env.ORG_ID });
    }
    /* Project Status Filter, only needed if not 'any' */
    if (
      typeof req.query.projStatus === "string" &&
      projectAPI.projectStatusOptions.includes(req.query.projStatus)
    ) {
      projectFilters.push({ status: req.query.projStatus });
    }
    /* Project Visibility Filter, only needed if not 'any' */
    const teamMemberQuery = projectAPI.constructProjectTeamMemberQuery(
      req.user?.decoded.uuid || ""
    );
    const privateProjectQueryParts: Record<any, any>[] = [
      { visibility: "private" },
    ];
    if (!isSuperAdmin) {
      privateProjectQueryParts.push({ $or: teamMemberQuery });
    }
    const privateProjectQuery = { $and: privateProjectQueryParts };
    const publicProjectQuery = { visibility: "public" };
    // PUBLIC OR (PRIVATE AND [TEAM] INCLUDES USER)
    const anyVisibilityQuery = {
      $or: [publicProjectQuery, privateProjectQuery],
    };
    if (typeof req.query.projVisibility === "string") {
      if (req.query.projVisibility === "public") {
        projectFilters.push(publicProjectQuery);
      } else if (req.query.projVisibility === "private") {
        projectFilters.push(privateProjectQuery);
      } else {
        projectFilters.push(anyVisibilityQuery);
      }
    } else {
      projectFilters.push(anyVisibilityQuery);
    }
    if (projectFilters.length > 1) {
      projectFiltersOptions = { $and: projectFilters };
    } else {
      projectFiltersOptions = { ...projectFilters[0] };
    }
    const projectMatchOptions = {
      $and: [
        {
          $or: [
            { title: queryRegex },
            { author: queryRegex },
            { libreLibrary: queryRegex },
            { libreCoverID: queryRegex },
            { libreShelf: queryRegex },
            { libreCampus: queryRegex },
          ],
        },
        {
          ...projectFiltersOptions,
        },
      ],
    };

    const aggregations = [];
    aggregations.push(
      Project.aggregate([
        {
          $match: projectMatchOptions,
        },
        {
          $lookup: {
            from: "users",
            let: {
              leads: "$leads",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ["$uuid", "$$leads"],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  uuid: 1,
                  firstName: 1,
                  lastName: 1,
                  avatar: 1,
                },
              },
            ],
            as: "leads",
          },
        },
        {
          $project: {
            _id: 0,
            orgID: 1,
            projectID: 1,
            title: 1,
            status: 1,
            visibility: 1,
            currentProgress: 1,
            peerProgress: 1,
            a11yProgress: 1,
            classification: 1,
            leads: 1,
            author: 1,
            updatedAt: 1,
          },
        },
      ])
    );
    aggregations.push(
      Book.aggregate([
        {
          $match: {
            $or: [
              { title: queryRegex },
              { author: queryRegex },
              { affiliation: queryRegex },
              { library: queryRegex },
              { subject: queryRegex },
              { course: queryRegex },
              { program: queryRegex },
              { summary: queryRegex },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            __v: 0,
          },
        },
      ])
    );
    aggregations.push(
      // Search project files for names that match the query
      Project.aggregate([
        {
          $match: {
            visibility: "public",
          },
        },
        {
          $project: {
            files: 1,
            projectID: 1,
          },
        },
        {
          $unwind: {
            path: "$files",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            "files.access": "public",
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                {
                  projectID: "$projectID",
                },
                "$files",
              ],
            },
          },
        },
        {
          $lookup: {
            from: "fileassettags",
            localField: "_id",
            foreignField: "fileID",
            as: "foundTags",
          },
        },
        {
          $unwind: {
            path: "$foundTags",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                "$$ROOT",
                {
                  foundTags: "$foundTags.tags",
                },
              ],
            },
          },
        },
        {
          $lookup: {
            from: "assettags",
            localField: "foundTags",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "assettagframeworks",
                  localField: "framework",
                  foreignField: "_id",
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
            ],
            as: "tags",
          },
        },
        {
          $project: {
            foundTags: 0,
          },
        },
      ])
    );
    aggregations.push(
      AssetTag.aggregate([
        {
          $match: {
            $text: {
              $search: query,
            },
          },
        },
        {
          $lookup: {
            from: "fileassettags",
            localField: "_id",
            foreignField: "tags",
            as: "matchingFileAssetTags",
          },
        },
        {
          $lookup: {
            from: "projects",
            as: "matchingProjectFiles",
            let: {
              fileIDs: "$matchingFileAssetTags.fileID",
            },
            pipeline: [
              {
                $match: {
                  orgID: process.env.ORG_ID,
                  visibility: "public",
                },
              },
              {
                $unwind: {
                  path: "$files",
                },
              },
              {
                $replaceRoot: {
                  newRoot: {
                    $mergeObjects: [
                      {
                        projectID: "$projectID",
                      },
                      "$files",
                    ],
                  },
                },
              },
              {
                $match: {
                  $and: [
                    {
                      access: "public",
                    },
                    {
                      $expr: {
                        $in: ["$_id", "$$fileIDs"],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          $unwind: {
            path: "$matchingProjectFiles",
          },
        },
        {
          $replaceRoot: {
            newRoot: "$matchingProjectFiles",
          },
        },
      ])
    );
    aggregations.push(
      Homework.aggregate([
        {
          $match: {
            $or: [
              { title: queryRegex },
              { kind: queryRegex },
              { description: queryRegex },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            __v: 0,
          },
        },
      ])
    );
    aggregations.push(
      User.aggregate([
        {
          $match: {
            $and: [
              {
                $or: [{ firstName: queryRegex }, { lastName: queryRegex }],
              },
              { $expr: { $not: "$isSystem" } },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            uuid: 1,
            firstName: 1,
            lastName: 1,
            avatar: 1,
          },
        },
      ])
    );

    const aggregateResults = await Promise.all(aggregations);
    const results = {
      projects: aggregateResults[0],
      books: aggregateResults[1],
      files: aggregateResults[2],
      filesFromTags: aggregateResults[3],
      homework: aggregateResults[3],
      users: aggregateResults[4],
    };

    // Merge files from text search and files from tags
    results.files = [...results.files, ...results.filesFromTags].filter(
      (file) => {
        // Remove files that don't have a projectID
        return file.projectID && file.fileID;
      }
    );

    // Remove duplicate files
    const fileIDs = results.files.map((file: FileInterface) => file.fileID);
    results.files = results.files.filter(
      (file: FileInterface, index: number) => {
        return !fileIDs.includes(file.fileID, index + 1);
      }
    );

    const resultsCount =
      results.projects.length +
      results.books.length +
      results.files.length +
      results.homework.length +
      results.users.length;

    //Sort projects
    results.projects.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (projSortOption === "title") {
        aData = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (projSortOption === "classification") {
        aData = String(a.classification)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.classification)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (projSortOption === "visibility") {
        aData = String(a.visibility)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.visibility)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (projSortOption === "lead") {
        if (Array.isArray(a.leads) && a.leads.length > 0) {
          aData = String(a.leads[0]?.firstName)
            .toLowerCase()
            .replace(/[^A-Za-z]+/g, "");
        } else {
          aData = "";
        }
        if (Array.isArray(b.leads) && b.leads.length > 0) {
          bData = String(b.leads[0]?.firstName)
            .toLowerCase()
            .replace(/[^A-Za-z]+/g, "");
        } else {
          bData = "";
        }
      } else if (projSortOption === "progress") {
        aData = a.currentProgress;
        bData = b.currentProgress;
      } else if (projSortOption === "updated") {
        if (a.updatedAt) {
          let aUpdated = new Date(a.updatedAt);
          if (isValidDateObject(aUpdated)) aData = aUpdated;
        } else {
          aData = 0;
        }
        if (b.updatedAt) {
          let bUpdated = new Date(b.updatedAt);
          if (isValidDateObject(bUpdated)) bData = bUpdated;
        } else {
          aData = 0;
        }
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    // Sort books
    results.books.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (bookSortOption === "title") {
        aData = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (bookSortOption === "author") {
        aData = String(a.author)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.author)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (bookSortOption === "library") {
        aData = String(a.library)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.library)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (bookSortOption === "subject") {
        aData = String(a.subject)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.subject)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (bookSortOption === "affiliation") {
        aData = String(a.affiliation)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.affiliation)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    // Sort files
    results.files.sort((a: FileInterface, b: FileInterface) => {
      if (!a.name || !b.name) return 0;
      if (a.name > b.name) return 1;
      if (a.name < b.name) return -1;
      return 0;
    });

    // Sort homework
    results.homework.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (homeworkSortOption === "name") {
        aData = String(a.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.title)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (homeworkSortOption === "description") {
        aData = String(a.description)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.description)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    // Sort users
    results.users.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (userSortOption === "first") {
        aData = String(a.firstName)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.firstName)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      } else if (userSortOption === "last") {
        aData = String(a.lastName)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
        bData = String(b.lastName)
          .toLowerCase()
          .replace(/[^A-Za-z]+/g, "");
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: resultsCount,
      // don't send filesFromTags, its merged into files
      results: {
        projects: results.projects,
        books: results.books,
        files: results.files,
        homework: results.homework,
        users: results.users,
      },
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

export default {
  performSearch,
};
