import Promise from "bluebird";
import User from "../models/user.js";
import Project from "../models/project.js";
import Book from "../models/book.js";
import Homework from "../models/homework.js";
import conductorErrors from "../conductor-errors.js";
import { debugError } from "../debug.js";
import { getPaginationOffset, isValidDateObject } from "../util/helpers.js";
import projectAPI from "./projects.js";
import { ZodReqWithOptionalUser } from "../types/Express.js";
import { Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { FileInterface } from "../models/file.js";
import { z } from "zod";
import {
  conductorSearchQuerySchema,
  conductorSearchSchema,
} from "./validators/search.js";
import AssetTag from "../models/assettag.js";
import { getSchemaWithDefaults } from "../util/typeHelpers.js";

/**
 * Performs a global search across multiple Conductor resource types (e.g. Projects, Books, etc.)
 */
async function performSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof conductorSearchSchema>>,
  res: Response
) {
  try {
    req.query = getSchemaWithDefaults(req.query, conductorSearchQuerySchema);
    console.log(req.query);

    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
          $regex: query,
          $options: "i",
        }
      : undefined;

    // Get pagination offsets
    const {
      booksLimit,
      booksOffset,
      assetsLimit,
      assetsOffset,
      projectsLimit,
      projectsOffset,
      homeworkLimit,
      homeworkOffset,
      usersLimit,
      usersOffset,
    } = _generateOffsetsAndLimits(req);

    const projectMatchObj = _generateProjectMatchObj({
      projLocation: req.query.projLocation || undefined,
      projStatus: req.query.projStatus || undefined,
      projVisibility: req.query.projVisibility || undefined,
      queryRegex,
      userUUID: req.user?.decoded.uuid || undefined,
      origin: req.query.origin || "commons",
    });

    const projectFilesMatchObj = _generateProjectFilesMatchObj({
      queryRegex,
    });

    const projectFilesSubQuery = _generateProjectFilesSubMatchObj({
      queryRegex,
      fileTypeFilter: req.query.assetFileType || undefined,
      licenseFilter: req.query.assetLicense || undefined,
      licenseVersionFilter: req.query.assetLicenseVersion || undefined,
    });

    const aggregations = [];
    aggregations.push(
      Project.aggregate([
        {
          $match: projectMatchObj,
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
        .skip(projectsOffset)
        .limit(projectsLimit)
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
        .skip(booksOffset)
        .limit(booksLimit)
    );
    aggregations.push(
      // Search project files for names that match the query
      Project.aggregate([
        {
          $match: projectFilesMatchObj,
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
            preserveNullAndEmptyArrays: false,
          },
        },
        {
          $match: projectFilesSubQuery,
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
            as: "tags",
          },
        },
        {
          $lookup: {
            from: "assettags",
            localField: "tags.tags",
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
          //filter asset tags where isDeleted = true
          $set: {
            tags: {
              $filter: {
                input: "$tags",
                as: "tag",
                cond: {
                  $ne: ["$$tag.isDeleted", true],
                },
              },
            },
          },
        },
      ])
    );

    aggregations.push(
      AssetTag.aggregate([
        {
          $match: _generateAssetTagsMatchObj(query),
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
                $match: projectFilesSubQuery,
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
        {
          $lookup: {
            from: "fileassettags",
            localField: "_id",
            foreignField: "fileID",
            as: "tags",
          },
        },
        {
          $lookup: {
            from: "assettags",
            localField: "tags.tags",
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
          //filter asset tags where isDeleted = true
          // TODO: Is this necessary? We already filter out deleted tags in the asset tag search
          $set: {
            tags: {
              $filter: {
                input: "$tags",
                as: "tag",
                cond: {
                  $ne: ["$$tag.isDeleted", true],
                },
              },
            },
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
        .skip(homeworkOffset)
        .limit(homeworkLimit)
    );

    // Only search for users if origin is conductor
    if (req.query.origin === "conductor") {
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
          .skip(usersOffset)
          .limit(usersLimit)
      );
    }

    const aggregateResults = await Promise.all(aggregations);
    const results = {
      projects: aggregateResults[0],
      books: aggregateResults[1],
      files: aggregateResults[2],
      filesFromTags: aggregateResults[3],
      homework: aggregateResults[4],
      users: aggregateResults[5] || [],
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

    // 'Paginate' results since we can't use skip/limit since there are two aggregations
    results.files = results.files.slice(
      assetsOffset,
      assetsOffset + assetsLimit
    );

    //Sort projects
    results.projects.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.projSort === "title") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.projSort === "classification") {
        aData = _transformToCompare(a.classification);
        bData = _transformToCompare(b.classification);
      } else if (req.query.projSort === "visibility") {
        aData = _transformToCompare(a.visibility);
        bData = _transformToCompare(b.visibility);
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
      if (req.query.bookSort === "title") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.bookSort === "author") {
        aData = _transformToCompare(a.author);
        bData = _transformToCompare(b.author);
      } else if (req.query.bookSort === "library") {
        aData = _transformToCompare(a.library);
        bData = _transformToCompare(b.library);
      } else if (req.query.bookSort === "subject") {
        aData = _transformToCompare(a.subject);
        bData = _transformToCompare(b.subject);
      } else if (req.query.bookSort === "affiliation") {
        aData = _transformToCompare(a.affiliation);
        bData = _transformToCompare(b.affiliation);
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
      if (req.query.homeworkSort === "name") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.homeworkSort === "description") {
        aData = _transformToCompare(a.description);
        bData = _transformToCompare(b.description);
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
      if (req.query.userSort === "first") {
        aData = _transformToCompare(a.firstName);
        bData = _transformToCompare(b.firstName);
      } else if (req.query.userSort === "last") {
        aData = _transformToCompare(a.lastName);
        bData = _transformToCompare(b.lastName);
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

function _generateProjectMatchObj({
  projLocation,
  projStatus,
  projVisibility,
  queryRegex,
  userUUID,
  origin,
}: {
  projLocation?: string;
  projStatus?: string;
  projVisibility?: "public" | "private";
  queryRegex?: object;
  userUUID?: string;
  origin?: "commons" | "conductor";
}) {
  const projectFilters = [];
  let projectFiltersOptions = {};

  // If project location is not 'any', add it to the filters
  if (projLocation === "local") {
    projectFilters.push({ orgID: process.env.ORG_ID });
  }

  // If project status is not 'any', add it to the filters
  if (projStatus && projectAPI.projectStatusOptions.includes(projStatus)) {
    projectFilters.push({ status: projStatus });
  }

  // Generate visibility query
  let visibilityQuery = {};
  // if (origin === "conductor" && userUUID && projVisibility === "private") {
  //   const teamMemberQuery =
  //     projectAPI.constructProjectTeamMemberQuery(userUUID);

  //   const privateProjectQuery = {
  //     $and: [{ visibility: "private" }, { $or: teamMemberQuery }],
  //   };

  //   visibilityQuery = {
  //     ...privateProjectQuery,
  //   };
  // } else {
  //   visibilityQuery = { visibility: "public" };
  // }
  // projectFilters.push(visibilityQuery);
  projectFilters.push({ visibility: "public" }); // TODO: handle showing private projects when logged in

  // If multiple filters, use $and, otherwise just use the filter
  if (projectFilters.length > 1) {
    projectFiltersOptions = { $and: projectFilters };
  } else {
    projectFiltersOptions = { ...projectFilters[0] };
  }

  // Combine all filters and return
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
          { associatedOrgs: queryRegex },
        ],
      },
      {
        ...projectFiltersOptions,
      },
    ],
  };
  return projectMatchOptions;
}

function _generateProjectFilesMatchObj({
  queryRegex,
}: {
  queryRegex?: object;
}) {
  const andQuery: Record<string, any>[] = [
    {
      orgID: process.env.ORG_ID,
    },
    {
      visibility: "public",
    },
  ];

  // TODO: revisit this
  // if (queryRegex) {
  //   // If query regex is provided, search for projects that have matching associatedOrgs
  //   andQuery.push({
  //     $or: [{ associatedOrgs: queryRegex }],
  //   });
  // }

  return {
    $and: andQuery,
  };
}

function _generateProjectFilesSubMatchObj({
  queryRegex,
  fileTypeFilter,
  licenseFilter,
  licenseVersionFilter,
}: {
  queryRegex?: object;
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
}) {
  const andQuery: Record<string, any>[] = [
    {
      "files.access": "public",
    },
  ];

  if (fileTypeFilter) {
    const parsed = fileTypeFilter.includes("*")
      ? fileTypeFilter.split("/")[0]
      : fileTypeFilter;

    const fileTypeRegex = {
      $regex: parsed,
      $options: "i",
    };

    // Push to outer $and query, we want this to be 'strict'
    andQuery.push(
      {
        "files.mimeType": fileTypeRegex,
      },
      {
        "files.storageType": "file",
      }
    );
  }

  if (licenseFilter) {
    const licenseRegex = {
      $regex: licenseFilter,
      $options: "i",
    };

    // Push to outer $and query, we want this to be 'strict'
    andQuery.push({
      "files.license.name": licenseRegex,
    });
  }

  if (licenseVersionFilter) {
    const licenseVersionRegex = {
      $regex: licenseVersionFilter,
      $options: "i",
    };

    // Push to outer $and query, we want this to be 'strict'
    andQuery.push({
      "files.license.version": licenseVersionRegex,
    });
  }

  if (queryRegex) {
    andQuery.push({
      $or: [{ "files.name": queryRegex }, { "files.description": queryRegex }],
    });
  }

  let subQuery = {};
  if (andQuery.length > 1) {
    subQuery = {
      $and: andQuery,
    };
  } else {
    subQuery = andQuery[0];
  }

  return subQuery;
}

function _generateAssetTagsMatchObj(query?: string) {
  if (query) {
    return {
      $and: [
        {
          $text: {
            $search: query,
          },
        },
        { isDeleted: false },
      ],
    };
  }
  return {};
}

function _generateOffsetsAndLimits(req: z.infer<typeof conductorSearchSchema>) {
  const queryObj = req.query;

  const booksPage = parseInt(req.query.booksPage?.toString()) || 1;
  const booksLimit = parseInt(req.query.booksLimit?.toString()) || 25;
  const booksOffset = getPaginationOffset(booksPage, queryObj.booksLimit);

  const assetsPage = parseInt(req.query.assetsPage?.toString()) || 1;
  const assetsLimit = parseInt(req.query.assetsLimit?.toString()) || 25;
  const assetsOffset = getPaginationOffset(assetsPage, queryObj.assetsLimit);

  const projectsPage = parseInt(req.query.projectsPage?.toString()) || 1;
  const projectsLimit = parseInt(req.query.projectsLimit?.toString()) || 25;
  const projectsOffset = getPaginationOffset(
    projectsPage,
    queryObj.projectsLimit
  );

  const homeworkPage = parseInt(req.query.homeworkPage?.toString()) || 1;
  const homeworkLimit = parseInt(req.query.homeworkLimit?.toString()) || 25;
  const homeworkOffset = getPaginationOffset(
    homeworkPage,
    queryObj.homeworkLimit
  );

  const usersPage = parseInt(req.query.usersPage?.toString()) || 1;
  const usersLimit = parseInt(req.query.usersLimit?.toString()) || 25;
  const usersOffset = getPaginationOffset(usersPage, queryObj.usersLimit);

  return {
    booksLimit,
    booksOffset,
    assetsLimit,
    assetsOffset,
    projectsLimit,
    projectsOffset,
    homeworkLimit,
    homeworkOffset,
    usersLimit,
    usersOffset,
  };
}

function _transformToCompare(val: any) {
  return String(val)
    .toLowerCase()
    .replace(/[^A-Za-z]+/g, "");
}

function _buildFilesFilter({
  fileTypeFilter,
  licenseFilter,
  licenseVersionFilter,
}: {
  fileTypeFilter?: string;
  licenseFilter?: string;
  licenseVersionFilter?: string;
}){
  const andQuery: Record<string, any>[] = [
    {
      "files.access": "public",
    },
    {
      "files.storageType": 'file',
    },
  ];

  if(fileTypeFilter){
    andQuery.push({
      "files.mimeType": fileTypeFilter,
    })
  }

  if(licenseFilter){
    andQuery.push({
      "files.license.name": licenseFilter,
    })
  }

  if(licenseVersionFilter){
    andQuery.push({
      "files.license.version": licenseVersionFilter,
    })
  }

  return {
    $and: andQuery,
  };
}

export async function assetsSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof conductorSearchSchema>>,
  res: Response
) {
  try {
    req.query = getSchemaWithDefaults(req.query, conductorSearchQuerySchema);
    
    const mongoSearchQueryTerm = req.query.searchQuery;
    if(!mongoSearchQueryTerm) {
      throw new Error("No search query provided");
    }

    const matchObj = _buildFilesFilter({
      fileTypeFilter: req.query.assetFileType || undefined,
      licenseFilter: req.query.assetLicense || undefined,
      licenseVersionFilter: req.query.assetLicenseVersion || undefined,
    });

    const results = await Project.aggregate([
      {
        $search: {
          embeddedDocument: {
            path: "files",
            operator: {
              text: {
                query: mongoSearchQueryTerm,
                path: {'wildcard': 'files.*'}
              }
            },
          },
          scoreDetails: true,
        },
      },
      {
        $project: {
          files: 1,
          projectID: 1,
          source: 1,
          score: { $meta: "searchScore" },
        },
      },
      {
        $unwind: {
          path: "$files",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: matchObj,
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectID: "$projectID",
              },
              {
                score: "$score",
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
          as: "tags",
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "tags.tags",
          foreignField: "_id",
          pipeline: [
            {
              $match: {
                $expr: {
                  $ne: ["isDeleted", true],
                },
              },
            },
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
    ]).limit(100);

    res.send({
      err: false,
      results: {
        files: results,
      },
    })

  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

export default {
  performSearch,
  assetsSearch,
};
