import Promise from "bluebird";
import User from "../models/user.js";
import Project from "../models/project.js";
import Book from "../models/book.js";
import Homework from "../models/homework.js";
import { debugError } from "../debug.js";
import { getPaginationOffset } from "../util/helpers.js";
import projectAPI from "./projects.js";
import { ZodReqWithOptionalUser } from "../types/Express.js";
import { Request, Response } from "express";
import { conductor500Err } from "../util/errorutils.js";
import { ProjectFileInterface } from "../models/projectfile.js";
import { z } from "zod";
import AssetTag from "../models/assettag.js";
import {
  assetSearchSchema,
  authorsSearchSchema,
  autocompleteSchema,
  bookSearchSchema,
  homeworkSearchSchema,
  miniReposSearchSchema,
  projectSearchSchema,
  userSearchSchema,
} from "./validators/search.js";
import ProjectFile from "../models/projectfile.js";
import authAPI from "./auth.js";
import Author from "../models/author.js";
import Fuse from "fuse.js";
import Organization from "../models/organization.js";
import AssetTagFramework from "../models/assettagframework.js";
import authorsAPI from "./authors.js";
import SearchQuery, {
  SearchQueryInterface_Raw,
} from "../models/searchquery.js";
import Tag from "../models/tag.js";
import { _getBookPublicOrInstructorAssetsCount } from "./books.js";

const searchQueryCache: SearchQueryInterface_Raw[] = []; // in-memory cache for search queries

/**
 * Performs a global search across multiple Conductor resource types (e.g. Projects, Books, etc.)
 */
async function projectsSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof projectSearchSchema>>,
  res: Response
) {
  try {
    const sort = req.query.sort || "relevance";
    const includeLeads =
      req.query.leads === true || req.query.leads?.toString() === "true";
    const includePIs =
      req.query.principalInvestigators === true ||
      req.query.principalInvestigators?.toString() === "true";

    const query = req.query.searchQuery;
    if (query) {
      addToSearchQueryCache(query, "projects"); // don't await
    }

    // Get pagination offsets
    const projectsPage = parseInt(req.query.page?.toString()) || 1;
    const projectsLimit = parseInt(req.query.limit?.toString()) || 25;
    const projectsOffset = getPaginationOffset(projectsPage, req.query.limit);

    let isSuperAdmin = false;

    if (req.user?.decoded?.uuid) {
      const user = await User.findOne({ uuid: req.user?.decoded?.uuid });
      if (user) {
        isSuperAdmin = authAPI.checkHasRole(
          user,
          "libretexts",
          "superadmin",
          true
        );
      }
    }

    const projectMatchObjs = _generateProjectMatchObjs({
      projLocation: req.query.location,
      projStatus: req.query.status,
      projClassification: req.query.classification,
      queryString: query,
      userUUID: req.user?.decoded.uuid,
      isSuperAdmin: isSuperAdmin,
    });

    // @ts-ignore
    const results = await Project.aggregate([
      ...projectMatchObjs,
      ...(includeLeads
        ? [
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
        ]
        : []),
      ...(includePIs ? projectAPI.LOOKUP_PROJECT_PI_STAGES(false) : []),
      {
        $project: {
          _id: 0,
          orgID: 1,
          projectID: 1,
          title: 1,
          status: 1,
          visibility: 1,
          classification: 1,
          leads: 1,
          author: 1,
          thumbnail: 1,
          projectURL: 1,
          contentArea: 1,
          associatedOrgs: 1,
          description: 1,
          principalInvestigators: 1,
          coPrincipalInvestigators: 1,
          updatedAt: 1,
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          localField: "projectID",
          foreignField: "projectID",
          as: "files",
        },
      },
      {
        $addFields: {
          publicAssets: {
            $size: {
              $filter: {
                input: "$files",
                cond: { $eq: ["$$this.access", "public"] }
              }
            }
          },
          instructorAssets: {
            $size: {
              $filter: {
                input: "$files",
                cond: { $eq: ["$$this.access", "instructor"] }
              }
            }
          }
        },
      },
      {
        $project: {
          files: 0
        }
      },
      ...(sort === "relevance"
        ? [
          {
            $sort: {
              score: -1,
            },
          },
        ]
        : [
          {
            $sort: {
              ...(sort === "title" && { title: 1 }),
              ...(sort === "classification" && { classification: 1 }),
              ...(sort === "visibility" && { visibility: 1 }),
            },
          },
        ]),
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      projectsOffset,
      projectsOffset + projectsLimit
    );

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

/**
 * Performs a global search for Projects that have "mini-repo" classification
 */
async function miniReposSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof miniReposSearchSchema>>,
  res: Response
) {
  try {
    const sort = req.query.sort || "relevance";

    const query = req.query.searchQuery;
    if (query) {
      addToSearchQueryCache(query, "minirepos"); // don't await
    }

    // Get pagination offsets
    const reposPage = parseInt(req.query.page?.toString()) || 1;
    const reposLimit = parseInt(req.query.limit?.toString()) || 25;
    const reposOffset = getPaginationOffset(reposPage, req.query.limit);

    let isSuperAdmin = false;

    if (req.user?.decoded?.uuid) {
      const user = await User.findOne({ uuid: req.user?.decoded?.uuid });
      if (user) {
        isSuperAdmin = authAPI.checkHasRole(
          user,
          "libretexts",
          "superadmin",
          true
        );
      }
    }

    const reposMatchObjs = _generateMiniReposMatchObjs({
      projStatus: req.query.status,
      queryString: query,
      userUUID: req.user?.decoded.uuid,
      isSuperAdmin: isSuperAdmin,
    });

    // @ts-ignore
    const results = await Project.aggregate([
      ...reposMatchObjs,
      {
        $project: {
          _id: 0,
          orgID: 1,
          projectID: 1,
          title: 1,
          status: 1,
          visibility: 1,
          classification: 1,
          leads: 1,
          author: 1,
          thumbnail: 1,
          projectURL: 1,
          contentArea: 1,
          associatedOrgs: 1,
          description: 1,
          principalInvestigators: 1,
          coPrincipalInvestigators: 1,
          updatedAt: 1,
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          localField: "projectID",
          foreignField: "projectID",
          as: "files",
        },
      },
      {
        $addFields: {
          publicAssets: {
            $size: {
              $filter: {
                input: "$files",
                cond: { $eq: ["$$this.access", "public"] }
              }
            }
          },
          instructorAssets: {
            $size: {
              $filter: {
                input: "$files",
                cond: { $eq: ["$$this.access", "instructor"] }
              }
            }
          }
        },
      },
      {
        $project: {
          files: 0
        }
      },
      ...(sort === "relevance"
        ? [
          {
            $sort: {
              score: -1,
            },
          },
        ]
        : [
          {
            $sort: {
              ...(sort === "title" && { title: 1 }),
            },
          },
        ]),
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      reposOffset,
      reposOffset + reposLimit
    );

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function booksSearch(
  req: z.infer<typeof bookSearchSchema>,
  res: Response
) {
  try {
    const query = req.query.searchQuery;
    if (query) {
      addToSearchQueryCache(query, "books");
    }

    const booksPage = parseInt(req.query.page?.toString()) || 1;
    const booksLimit = parseInt(req.query.limit?.toString()) || 25;
    const booksOffset = getPaginationOffset(booksPage, booksLimit);

    const matchObj = _generateBookMatchObj({
      library: req.query.library,
      subject: req.query.subject,
      location: req.query.location,
      license: req.query.license,
      author: req.query.author,
      course: req.query.course,
      publisher: req.query.publisher,
      affiliation: req.query.affiliation,
      query,
    });

    // @ts-ignore
    const fromBooks = Book.aggregate([
      ...matchObj,
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    const fromProjectTags = Tag.aggregate([
      {
        $search: {
          text: {
            query,
            path: ["title"],
            fuzzy: {
              maxEdits: 1,
              maxExpansions: 50,
            },
          },
        },
      },
      {
        $match: {
          orgID: process.env.ORG_ID,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "tagID",
          foreignField: "tags",
          as: "matchingProjects",
        },
      },
      {
        $unwind: {
          path: "$matchingProjects",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $replaceRoot: {
          newRoot: "$matchingProjects",
        },
      },
      {
        $match: {
          libreCoverID: {
            $exists: true,
            $ne: "",
          },
          libreLibrary: {
            $exists: true,
            $ne: "",
          },
          visibility: "public",
        },
      },
      {
        $lookup: {
          from: "books",
          let: {
            library: "$libreLibrary",
            pageID: "$libreCoverID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: [
                    {
                      $and: [
                        {
                          $ne: ["$$library", ""],
                        },
                        {
                          $ne: ["$$pageID", ""],
                        },
                      ],
                    },
                    {
                      $eq: [
                        "$bookID",
                        {
                          $concat: ["$$library", "-", "$$pageID"],
                        },
                      ],
                    },
                    {
                      $eq: ["$bookID", false], // empty lookup
                    },
                  ],
                },
              },
            },
          ],
          as: "book",
        },
      },
      {
        $match: {
          book: { $ne: [] },
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $arrayElemAt: ["$book", 0],
          },
        },
      },
      {
        $project: {
          _id: 0,
          __v: 0,
        },
      },
    ]);

    const promises = [fromBooks];
    if (query) {
      promises.push(fromProjectTags);
    }

    const [booksResults, projectsResults] = await Promise.all(promises);

    let results = [...booksResults, ...(projectsResults ?? [])];

    results.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "title") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.sort === "author") {
        aData = _transformToCompare(a.author);
        bData = _transformToCompare(b.author);
      } else if (req.query.sort === "subject") {
        aData = _transformToCompare(a.course);
        bData = _transformToCompare(b.course);
      } else if (req.query.sort === "library") {
        aData = _transformToCompare(a.library);
        bData = _transformToCompare(b.library);
      } else if (req.query.sort === "affiliation") {
        aData = _transformToCompare(a.affiliation);
        bData = _transformToCompare(b.affiliation);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    const publicOrInstructorAssets = await _getBookPublicOrInstructorAssetsCount(
      results.map((book) => book.bookID)
    );

    // Add the publicOrInstructorAssets field to each book
    results.forEach((book) => {
      const bookID = book.bookID;
      const found = publicOrInstructorAssets.find((b) => b.bookID === bookID);
      book.publicAssets = found?.publicAssets || 0;
      book.instructorAssets = found?.instructorAssets || 0;
    });

    if (req.query.assets) {
      const assetsFilter = req.query.assets;
      if (assetsFilter === "public") {
        results = results.filter((book) => book.publicAssets > 0);
      } else if (assetsFilter === "instructors") {
        results = results.filter((book) => book.instructorAssets > 0);
      }
    }

    const totalCount = results.length;
    const paginated = results.slice(booksOffset, booksOffset + booksLimit);

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _generateBookMatchObj({
  library,
  subject,
  location,
  license,
  author,
  course,
  publisher,
  affiliation,
  query,
}: {
  library?: string;
  subject?: string;
  location?: "campus" | "central";
  license?: string;
  author?: string;
  course?: string;
  publisher?: string;
  affiliation?: string;
  query?: string;
}): Record<string, any>[] {
  const bookFilters = [];
  let bookFiltersOptions = {};

  if (library) {
    bookFilters.push({ library });
  }

  if (subject) {
    bookFilters.push({ subject });
  }

  if (location) {
    bookFilters.push({ location });
  }

  if (license) {
    bookFilters.push({ license });
  }

  if (author) {
    bookFilters.push({ author });
  }

  if (course) {
    bookFilters.push({ course });
  }

  if (publisher) {
    bookFilters.push({ program: publisher });
  }

  if (affiliation) {
    bookFilters.push({ affiliation });
  }

  // If multiple filters, use $and, otherwise just use the filter
  if (bookFilters.length > 1) {
    bookFiltersOptions = { $and: bookFilters };
  } else {
    bookFiltersOptions = { ...bookFilters[0] };
  }

  // Combine all filters and return
  const bookMatchOptions = {
    $and: [
      {
        ...bookFiltersOptions,
      },
    ],
  };

  const search = {
    text: {
      query,
      path: ["title", "author", "course"],
      fuzzy: {
        maxEdits: 2,
        maxExpansions: 50,
      },
    },
  };

  const steps: Record<string, any>[] = [
    {
      $match: bookMatchOptions,
    },
  ];

  if (query) {
    steps.unshift({ $search: search });
  }
  return steps;
}

function _generateProjectMatchObjs({
  projLocation,
  projStatus,
  projClassification,
  queryString,
  userUUID,
  isSuperAdmin,
}: {
  projLocation?: string;
  projStatus?: string;
  projClassification?: string;
  queryString?: string;
  userUUID?: string;
  isSuperAdmin?: boolean;
}): Record<string, any>[] {
  const projectFilters = [];
  let projectFiltersOptions = {};

  // If project location is not 'global', add it to the filters
  if (projLocation === "local") {
    projectFilters.push({ orgID: process.env.ORG_ID });
  }

  // If project classification is not 'any', add it to the filters
  if (projClassification && projClassification !== "any") {
    projectFilters.push({ classification: projClassification });
  }

  // If project status is not 'any', add it to the filters
  if (projStatus && projectAPI.projectStatusOptions.includes(projStatus)) {
    projectFilters.push({ status: projStatus });
  }

  // Generate visibility query
  let visibilityQuery = {};
  if (!isSuperAdmin) {
    // If user is not a super admin, add visibility query
    if (userUUID) {
      const teamMemberQuery =
        projectAPI.constructProjectTeamMemberQuery(userUUID);

      // If userUUID is provided, add query for private projects that the user is a member of
      const privateProjectQuery = {
        $and: [{ visibility: "private" }, { $or: teamMemberQuery }],
      };

      visibilityQuery = {
        $or: [privateProjectQuery, { visibility: "public" }],
      };
    } else {
      // If userUUID is not provided, only show public projects
      visibilityQuery = { visibility: "public" };
    }

    if (Object.keys(visibilityQuery).length > 0) {
      projectFilters.push(visibilityQuery);
    }
  }

  // If multiple filters, use $and, otherwise just use the filter
  if (projectFilters.length > 1) {
    projectFiltersOptions = { $and: projectFilters };
  } else {
    projectFiltersOptions = { ...projectFilters[0] };
  }

  if (!queryString) {
    return [{ $match: projectFiltersOptions }];
  }

  // Combine all filters and return
  return [
    {
      $search: {
        text: {
          query: queryString,
          path: [
            "title",
            "author",
            "libreShelf",
            "libreCampus",
            "associatedOrgs",
          ],
        },
        scoreDetails: true,
      },
    },
    {
      $addFields: {
        score: {
          $getField: {
            field: "value",
            input: {
              $meta: "searchScoreDetails",
            },
          },
        },
      },
    },
    {
      $match: {
        ...projectFiltersOptions,
      },
    },
  ];
}

function _generateMiniReposMatchObjs({
  projStatus,
  queryString,
  userUUID,
  isSuperAdmin,
}: {
  projStatus?: string;
  queryString?: string;
  userUUID?: string;
  isSuperAdmin?: boolean;
}): Record<string, any>[] {
  const projectFilters: Record<string, any>[] = [];
  let projectFiltersOptions: Record<string, any> = { $and: [] };

  // If project status is not 'any', add it to the filters
  if (projStatus && projectAPI.projectStatusOptions.includes(projStatus)) {
    projectFilters.push({ status: projStatus });
  }

  // Generate visibility query
  let visibilityQuery = {};
  if (!isSuperAdmin) {
    // If user is not a super admin, add visibility query
    if (userUUID) {
      const teamMemberQuery =
        projectAPI.constructProjectTeamMemberQuery(userUUID);

      // If userUUID is provided, add query for private projects that the user is a member of
      const privateProjectQuery = {
        $and: [{ visibility: "private" }, { $or: teamMemberQuery }],
      };

      visibilityQuery = {
        $or: [privateProjectQuery, { visibility: "public" }],
      };
    } else {
      // If userUUID is not provided, only show public projects
      visibilityQuery = { visibility: "public" };
    }

    if (Object.keys(visibilityQuery).length > 0) {
      projectFilters.push(visibilityQuery);
    }
  }

  // Add any applied filters to match obj
  projectFiltersOptions = {
    $and: [
      { orgID: process.env.ORG_ID },
      { classification: "minirepo" },
      ...projectFilters
    ]
  };

  if (!queryString) {
    return [{ $match: projectFiltersOptions }];
  }

  // Combine all filters and return
  return [
    {
      $search: {
        text: {
          query: queryString,
          path: [
            "title",
            "author",
            "libreShelf",
            "libreCampus",
            "associatedOrgs",
          ],
        },
        scoreDetails: true,
      },
    },
    {
      $addFields: {
        score: {
          $getField: {
            field: "value",
            input: {
              $meta: "searchScoreDetails",
            },
          },
        },
      },
    },
    {
      $match: {
        ...projectFiltersOptions,
      },
    },
  ];
}

export async function assetsSearch(
  req: ZodReqWithOptionalUser<z.infer<typeof assetSearchSchema>>,
  res: Response
) {
  try {
    const mongoSearchQueryTerm = req.query.searchQuery ?? "";
    const assetsPage = parseInt(req.query.page?.toString()) || 1;
    const assetsLimit = parseInt(req.query.limit?.toString()) || 25;
    const assetsOffset = getPaginationOffset(assetsPage, assetsLimit);

    if (mongoSearchQueryTerm) {
      addToSearchQueryCache(mongoSearchQueryTerm, "assets");
    }

    const projectFilesQuery = _buildAssetsSearchQuery({
      query: mongoSearchQueryTerm,
      type: "projectfiles",
    });

    const assetTagsQuery = _buildAssetsSearchQuery({
      query: mongoSearchQueryTerm,
      type: "assettags",
    });

    const projectsQuery = _buildAssetsSearchQuery({
      query: mongoSearchQueryTerm,
      type: "projects",
    });

    const matchObj = _buildFilesFilter({
      fileTypeFilter: req.query.fileType,
      licenseFilter: req.query.license,
    });

    const fromProjectFilesPromise = ProjectFile.aggregate([
      ...(projectFilesQuery.length > 0 ? projectFilesQuery : []),
      {
        $match: {
          $and: [
            {
              access: "public",
            },
            {
              storageType: "file",
            },
          ],
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
                visibility: "public",
                orgID: process.env.ORG_ID,
              },
            },
            {
              $project: {
                title: 1,
                thumbnail: 1,
                associatedOrgs: 1,
                description: 1,
                projectURL: 1,
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
        },
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
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
          },
        },
      },
      {
        $match: {
          // Filter where project was not public or does not exist, so projectInfo wasn't set
          projectInfo: {
            $exists: true,
            $ne: [null, {}],
          },
        },
      },
      {
        $match: matchObj,
      },
    ]);

    const fromAssetTagsPromise = AssetTag.aggregate([
      ...(assetTagsQuery.length > 0 ? assetTagsQuery : []),
      {
        $lookup: {
          from: "projectfiles",
          localField: "_id",
          foreignField: "tags",
          as: "matchingProjectFiles",
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "matchingProjectFiles.projectID",
          foreignField: "projectID",
          as: "projectInfo",
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectInfo: {
                  $arrayElemAt: ["$projectInfo", 0],
                },
              },
              "$matchingProjectFiles",
              { score: "$score" },
            ],
          },
        },
      },
      {
        $match: {
          "projectInfo.visibility": "public",
        },
      },
      {
        $project: {
          projectInfo: {
            _id: 0,
            projectID: 0,
            orgID: 0,
            status: 0,
            visibility: 0,
            currentProgress: 0,
            peerProgress: 0,
            a11yProgress: 0,
            leads: 0,
            liaisons: 0,
            members: 0,
            auditors: 0,
            tags: 0,
            allowAnonPR: 0,
            cidDescriptors: 0,
            a11yReview: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
            adaptCourseID: 0,
            adaptURL: 0,
            classification: 0,
            defaultFileLicense: 0,
            libreCampus: 0,
            libreLibrary: 0,
            libreShelf: 0,
            projectURL: 0,
            didCreateWorkbench: 0,
            didMigrateWorkbench: 0,
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
        },
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
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
          },
        },
      },
      {
        $match: matchObj,
      },
    ]);

    const fromAuthorsPromise = Author.aggregate([
      {
        $search: {
          text: {
            query: mongoSearchQueryTerm,
            path: ["firstName", "lastName", "email"],
            fuzzy: {
              maxEdits: 1,
              maxExpansions: 50,
            },
            score: { boost: { value: 3 } },
          },
        },
      },
      {
        $match: {
          orgID: process.env.ORG_ID,
        },
      },
      {
        $addFields: {
          score: { $meta: "searchScore" },
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          let: { authorId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $in: ["$$authorId", "$authors"],
                    }, // Check if the author id is in the authors array
                    {
                      $eq: ["$$authorId", "$primaryAuthor"],
                    }, // Check if the author id is equal to the primary author
                  ],
                },
              },
            },
          ],
          as: "matchingProjectFiles",
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "matchingProjectFiles.projectID",
          foreignField: "projectID",
          as: "projectInfo",
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectInfo: {
                  $arrayElemAt: ["$projectInfo", 0],
                },
              },
              "$matchingProjectFiles",
              { score: "$score" },
            ],
          },
        },
      },
      {
        $match: {
          "projectInfo.visibility": "public",
        },
      },
      {
        $project: {
          projectInfo: {
            _id: 0,
            projectID: 0,
            orgID: 0,
            status: 0,
            visibility: 0,
            currentProgress: 0,
            peerProgress: 0,
            a11yProgress: 0,
            leads: 0,
            liaisons: 0,
            members: 0,
            auditors: 0,
            tags: 0,
            allowAnonPR: 0,
            cidDescriptors: 0,
            a11yReview: 0,
            createdAt: 0,
            updatedAt: 0,
            __v: 0,
            adaptCourseID: 0,
            adaptURL: 0,
            classification: 0,
            defaultFileLicense: 0,
            libreCampus: 0,
            libreLibrary: 0,
            libreShelf: 0,
            projectURL: 0,
            didCreateWorkbench: 0,
            didMigrateWorkbench: 0,
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
        },
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
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
          },
        },
      },
      {
        $match: matchObj,
      },
    ]);

    const fromProjectsPromise = Project.aggregate([
      ...(projectsQuery.length > 0 ? projectsQuery : []),
      {
        $match: {
          visibility: "public",
        },
      },
      {
        $lookup: {
          from: "projectfiles",
          localField: "projectID",
          foreignField: "projectID",
          as: "matchingProjectFiles",
        },
      },
      {
        $unwind: {
          path: "$matchingProjectFiles",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              {
                projectInfo: {
                  title: "$title",
                  associatedOrgs: "$associatedOrgs",
                  thumbnail: "$thumbnail",
                  description: "$description",
                  projectURL: "$projectURL",
                },
              },
              "$matchingProjectFiles",
              {
                score: "$score",
              },
            ],
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
        },
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
        },
      },
      {
        $set: {
          correspondingAuthor: {
            $arrayElemAt: ["$correspondingAuthor", 0],
          },
        },
      },
      {
        $match: matchObj,
      },
    ]);

    const aggregations = [fromProjectFilesPromise];
    // Only add these if there is a search query
    if (mongoSearchQueryTerm) {
      aggregations.push(fromAssetTagsPromise);
      aggregations.push(fromAuthorsPromise);
      aggregations.push(fromProjectsPromise);
    }

    const aggregateResults = await Promise.all(aggregations);

    // Merge all results
    let allResults = aggregateResults.flat().filter((file) => {
      // Remove files that don't have a projectID
      return file.projectID && file.fileID;
    });

    if (mongoSearchQueryTerm) {
      allResults = allResults.map((file: any) =>
        _boostExactMatches(file, mongoSearchQueryTerm)
      );
      const minScore = _calculateLowerOutlierThreshold(
        allResults.map((file: any) => file.score)
      );
      allResults = allResults.filter((file: any) => file.score >= minScore);
    }

    // Filter by org if provided
    if (req.query.org) {
      allResults = allResults.filter((file) => {
        return file.projectInfo.associatedOrgs?.includes(req.query.org);
      });
    }

    // Filter by person if provided
    if (req.query.person) {
      const lowercased = req.query.person.toString().toLowerCase();
      allResults = allResults.filter((file) => {
        const primaryAuthor =
          `${file.primaryAuthor?.firstName} ${file.primaryAuthor?.lastName}`.toLowerCase();
        const correspondingAuthor =
          `${file.correspondingAuthor?.firstName} ${file.correspondingAuthor?.lastName}`.toLowerCase();

        // Check if the person is in authors array, primary author, or corresponding author
        return (
          file.authors.find((author: any) => {
            return `${author.firstName} ${author.lastName}`
              .toLowerCase()
              .includes(lowercased);
          }) ||
          primaryAuthor.includes(lowercased) ||
          correspondingAuthor.includes(lowercased)
        );
      });
    }

    if (req.query.customFilters) {
      const customFilters = req.query.customFilters;
      allResults = allResults.filter((file) => {
        let includeFile = true;
        for (const filter of customFilters) {
          if (!file.tags) {
            includeFile = false;
            break;
          }
          const matchingTags = file.tags.filter(
            (tag: any) => tag?.key?.title === filter.key
          );
          if (matchingTags.length === 0) {
            includeFile = false;
            break;
          }

          const matchingValues = matchingTags.filter((tag: any) => {
            if (typeof tag.value === "string") {
              return tag.value.toLowerCase() === filter.value.toLowerCase();
            }
            if (Array.isArray(tag.value)) {
              return tag.value
                .map((v: string) => v.toLowerCase())
                .includes(filter.value.toLowerCase());
            }
            return false;
          });

          if (matchingValues.length === 0) {
            includeFile = false;
            break;
          }
        }
        return includeFile;
      });
    }

    // Remove duplicate files
    const fileIDs = allResults.map((file: ProjectFileInterface) => file.fileID);
    const withoutDuplicates = Array.from(new Set(fileIDs)).map((fileID) => {
      return allResults.find(
        (file: ProjectFileInterface) => file.fileID === fileID
      );
    });

    // Sort results by score
    withoutDuplicates.sort((a, b) => {
      if (a.score < b.score) return 1;
      if (a.score > b.score) return -1;
      return 0;
    });

    const totalCount = withoutDuplicates.length;

    const paginated = withoutDuplicates.slice(
      assetsOffset,
      assetsOffset + assetsLimit
    );

    res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _buildFilesFilter({
  fileTypeFilter,
  licenseFilter,
}: {
  fileTypeFilter?: string;
  licenseFilter?: string;
}) {
  const andQuery: Record<string, any>[] = [
    {
      access: "public",
    },
    {
      storageType: "file",
    },
  ];

  if (fileTypeFilter) {
    const isWildCard = fileTypeFilter.includes("*");
    const parsedFileFilter = isWildCard
      ? fileTypeFilter.split("/")[0]
      : fileTypeFilter; // if mime type is wildcard, only use the first part of the mime type

    const wildCardRegex = {
      $regex: parsedFileFilter,
      $options: "i",
    };
    andQuery.push({
      mimeType: isWildCard ? wildCardRegex : parsedFileFilter,
    });
  }

  if (licenseFilter) {
    andQuery.push({
      "license.name": licenseFilter,
    });
  }

  return {
    $and: andQuery,
  };
}

function _buildAssetsSearchQuery({
  query,
  type,
}: {
  query?: string;
  type: "projectfiles" | "assettags" | "projects";
}) {
  const SEARCH_FIELDS =
    type === "projectfiles"
      ? ["name", "description"]
      : type === "assettags"
        ? ["value"]
        : ["title", "associatedOrgs"];

  if (!query) {
    return [];
  }

  const [isExactMatchSearch, strippedQuery] = _checkIsExactMatchQuery(query);

  const innerQuery = isExactMatchSearch
    ? {
      phrase: {
        query: strippedQuery,
        path: SEARCH_FIELDS,
        score: { boost: { value: 3 } },
      },
    }
    : {
      text: {
        query,
        path: SEARCH_FIELDS,
        fuzzy: {
          maxEdits: 2,
          maxExpansions: 50,
        },
      },
    };

  return [
    {
      $search: innerQuery,
    },
    {
      $addFields: {
        score: { $meta: "searchScore" },
      },
    },
  ];
}

async function homeworkSearch(
  req: z.infer<typeof homeworkSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
        $regex: query,
        $options: "i",
      }
      : undefined;

    if (query) {
      addToSearchQueryCache(query, "homework"); // Don't await
    }

    const homeworkPage = parseInt(req.query.page?.toString()) || 1;
    const homeworkLimit = parseInt(req.query.limit?.toString()) || 25;
    const homeworkOffset = getPaginationOffset(homeworkPage, req.query.limit);

    const results = await Homework.aggregate([
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
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      homeworkOffset,
      homeworkOffset + homeworkLimit
    );

    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "name") {
        aData = _transformToCompare(a.title);
        bData = _transformToCompare(b.title);
      } else if (req.query.sort === "description") {
        aData = _transformToCompare(a.description);
        bData = _transformToCompare(b.description);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    return res.send({
      err: false,
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function usersSearch(
  req: z.infer<typeof userSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;
    const queryRegex = query
      ? {
        $regex: query,
        $options: "i",
      }
      : undefined;

    if (query) {
      addToSearchQueryCache(query, "users"); // Don't await
    }

    const usersPage = parseInt(req.query.page?.toString()) || 1;
    const usersLimit = parseInt(req.query.limit?.toString()) || 25;
    const usersOffset = getPaginationOffset(usersPage, req.query.limit);

    const results = await User.aggregate([
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
    ]);

    const totalCount = results.length;
    const paginated = results.slice(usersOffset, usersOffset + usersLimit);

    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "first") {
        aData = _transformToCompare(a.firstName);
        bData = _transformToCompare(b.firstName);
      } else if (req.query.sort === "last") {
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
      numResults: totalCount,
      results: paginated,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function authorsSearch(
  req: z.infer<typeof authorsSearchSchema>,
  res: Response
) {
  try {
    // Create regex for query
    const query = req.query.searchQuery;

    if (query) {
      addToSearchQueryCache(query, "authors"); // Don't await
    }

    const authorsPage = parseInt(req.query.page?.toString()) || 1;
    const authorsLimit = parseInt(req.query.limit?.toString()) || 25;
    const authorsOffset = getPaginationOffset(authorsPage, req.query.limit);

    const queryObj = _buildAuthorsSearchQuery({
      query,
    });

    const results = await Author.aggregate([
      ...(queryObj.length > 0 ? queryObj : []),
      {
        $match: {
          orgID: process.env.ORG_ID,
        },
      },
      authorsAPI.LOOKUP_AUTHOR_PROJECTS,
      {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          url: 1,
          primaryInstitution: 1,
          projects: 1,
          email: 1,
        },
      },
    ]);

    const totalCount = results.length;
    const paginated = results.slice(
      authorsOffset,
      authorsOffset + authorsLimit
    );

    paginated.sort((a, b) => {
      let aData = null;
      let bData = null;
      if (req.query.sort === "first") {
        aData = _transformToCompare(a.firstName);
        bData = _transformToCompare(b.firstName);
      } else if (req.query.sort === "last") {
        aData = _transformToCompare(a.lastName);
        bData = _transformToCompare(b.lastName);
      }
      if (aData !== null && bData !== null) {
        if (aData < bData) return -1;
        if (aData > bData) return 1;
      }
      return 0;
    });

    let filtered = paginated;
    if (req.query.primaryInstitution) {
      filtered = paginated.filter(
        (author) => author.primaryInstitution === req.query.primaryInstitution
      );
    }

    return res.send({
      err: false,
      numResults: req.query.primaryInstitution ? filtered.length : totalCount,
      results: filtered,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _buildAuthorsSearchQuery({ query }: { query?: string }) {
  const SEARCH_FIELDS = ["firstName", "lastName", "email"];

  if (!query) {
    return [];
  }

  const [isExactMatchSearch, strippedQuery] = _checkIsExactMatchQuery(query);

  const innerQuery = isExactMatchSearch
    ? {
      phrase: {
        query: strippedQuery,
        path: SEARCH_FIELDS,
        score: { boost: { value: 3 } },
      },
    }
    : {
      text: {
        query,
        path: SEARCH_FIELDS,
        fuzzy: {
          maxEdits: 2,
          maxExpansions: 50,
        },
      },
    };

  return [
    {
      $search: innerQuery,
    },
    {
      $addFields: {
        score: { $meta: "searchScore" },
      },
    },
  ];
}

async function getAutocompleteResults(
  req: z.infer<typeof autocompleteSchema>,
  res: Response
) {
  try {
    const query = req.query.query;
    const limit = req.query.limit || 5;

    const tagsResults = await AssetTag.aggregate([
      {
        $search: {
          index: "asset-tags-autocomplete",
          autocomplete: {
            query: query,
            path: "value",
          },
        },
      },
      {
        $project: {
          _id: 0,
          value: 1,
          score: { $meta: "searchScore" },
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
    ]).limit(limit);

    const authorsResults = await Author.aggregate([
      {
        $search: {
          index: "authors-autocomplete",
          compound: {
            should: [
              {
                autocomplete: {
                  query: query,
                  path: "firstName",
                },
              },
              {
                autocomplete: {
                  query: query,
                  path: "lastName",
                },
              },
            ],
          },
        },
      },
      {
        $match: {
          orgID: process.env.ORG_ID,
        },
      },
      {
        $project: {
          _id: 0,
          firstName: 1,
          lastName: 1,
          score: { $meta: "searchScore" },
        },
      },
      {
        $sort: {
          score: -1,
        },
      },
    ]).limit(limit);

    // Sort results by score
    tagsResults.sort((a, b) => {
      if (a.score < b.score) return 1;
      if (a.score > b.score) return -1;
      return 0;
    });

    authorsResults.sort((a, b) => {
      if (a.score < b.score) return 1;
      if (a.score > b.score) return -1;
      return 0;
    });

    const tagValues = tagsResults.map((tag) => tag.value);
    const authorValues = authorsResults.map(
      (author) => `${author.firstName} ${author.lastName}`
    );

    // Handle nested arrays
    const reduced = tagValues.reduce((acc, val) => {
      if (val instanceof Array) {
        val.forEach((v) => {
          acc.push(v);
        });
      } else {
        acc.push(val);
      }
      return acc;
    }, []);

    // Load custom org list
    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    });
    const customOrgs = org?.customOrgList || [];

    // Combine and remove duplicates
    const uniqueValues = [
      ...new Set<string>([...reduced, ...authorValues, ...customOrgs]),
    ];

    // Filter out values that are less than 3 characters (not useful enough to determine relevance)
    const filtered = uniqueValues.filter((val) => {
      return val.length > 3;
    });

    // We use Fuse here, because if any element in an array (ie when asset tag value is an array) matches, MongoDB will return the entire array
    // This is not useful for autocomplete, so we use Fuse to 'verify' and return only the truly matching elements (in terms of the query string).
    // Fuse allows us to still do lightweight fuzzy matching and return the matching (or near matching) results
    const fuse = new Fuse(filtered, {
      threshold: 0.3,
    });
    const searchResults = fuse.search(query).map((result) => result.item) ?? [];

    // Prevent duplicates where items differ only in case
    const caseInsensitiveSet = new Set<string>();
    const caseInsensitiveFiltered = searchResults.filter((val) => {
      const lowerCaseVal = val.toLowerCase();
      if (caseInsensitiveSet.has(lowerCaseVal)) {
        return false;
      }
      caseInsensitiveSet.add(lowerCaseVal);
      return true;
    });

    return res.send({
      err: false,
      numResults: caseInsensitiveFiltered.length,
      results: caseInsensitiveFiltered,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAssetFilterOptions(req: Request, res: Response) {
  try {
    const aggregations = [];

    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    }).orFail();

    const licensePromise = ProjectFile.aggregate([
      {
        $match: {
          "license.name": {
            $ne: "",
          },
        },
      },
      {
        $group: {
          _id: null,
          uniqueLicenseNames: {
            $addToSet: "$license.name",
          },
        },
      },
      {
        $project: {
          _id: 0,
          uniqueLicenseNames: 1,
        },
      },
    ]);

    aggregations.push(licensePromise);

    const fileTypePromise = ProjectFile.aggregate([
      { $match: { mimeType: { $exists: true, $ne: "" } } },
      { $group: { _id: "$mimeType" } },
    ]);
    aggregations.push(fileTypePromise);

    const assetTagsPromise = AssetTagFramework.aggregate([
      {
        $match: {
          "templates.enabledAsFilter": true,
          orgID: process.env.ORG_ID,
        },
      },
      {
        $project: {
          templates: {
            $filter: {
              input: "$templates",
              as: "template",
              cond: {
                $eq: ["$$template.enabledAsFilter", true],
              },
            },
          },
        },
      },
      {
        $unwind: {
          path: "$templates",
        },
      },
      {
        $lookup: {
          from: "assettagkeys",
          localField: "templates.key",
          foreignField: "_id",
          as: "foundKey",
        },
      },
      {
        $project: {
          key: {
            $arrayElemAt: ["$foundKey", 0],
          },
          valueType: "$templates.valueType",
          options: "$templates.options",
        },
      },
      {
        $lookup: {
          from: "assettags",
          localField: "key._id",
          foreignField: "key",
          as: "assetTags",
        },
      },
      {
        $project: {
          key: 1,
          valueType: 1,
          options: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $size: "$options" }, 0] },
                  { $eq: ["$valueType", "text"] },
                ],
              },
              then: {
                $setUnion: ["$assetTags.value"],
              },
              else: "$options",
            },
          },
        },
      },
    ]);
    aggregations.push(assetTagsPromise);

    // Find all people (authors)
    const authorsPromise = Author.find({
      firstName: { $exists: true, $ne: "" },
      lastName: { $exists: true, $ne: "" },
      orgID: process.env.ORG_ID,
    });
    aggregations.push(authorsPromise);

    const orgsPromise = Project.aggregate([
      {
        $group: {
          _id: null,
          associatedOrgs: {
            $addToSet: "$associatedOrgs",
          },
        },
      },
      {
        $unwind: "$associatedOrgs",
      },
      {
        $unwind: "$associatedOrgs",
      },
      {
        $group: {
          _id: null,
          associatedOrgs: {
            $addToSet: "$associatedOrgs",
          },
        },
      },
      {
        $project: {
          _id: 0,
        },
      },
    ]);

    const hasCustomOrgList = org.customOrgList && org.customOrgList.length > 0;

    // If org has no custom org list, add to aggregations
    if (!hasCustomOrgList) {
      aggregations.push(orgsPromise);
    }

    const results = await Promise.all(aggregations);
    const licenseNames = results[0][0]?.uniqueLicenseNames ?? [];
    const rawfileTypes = results[1] ?? [];
    const fileTypes = rawfileTypes.map((type: any) => type._id);
    const assetTags =
      results[2].map((a) => {
        return {
          title: a.key.title,
          options: a.options,
        };
      }) ?? [];
    const authors = results[3] ?? [];
    const orgs = hasCustomOrgList
      ? org.customOrgList
      : results[4][0]?.associatedOrgs ?? [];

    // Sort results
    licenseNames.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    fileTypes.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    orgs.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    authors.sort((a: any, b: any) =>
      `${a.firstName} ${a.lastName}`
        .toLowerCase()
        .localeCompare(`${b.firstName} ${b.lastName}`.toLowerCase())
    );

    return res.send({
      err: false,
      licenses: licenseNames,
      fileTypes: fileTypes,
      orgs: orgs,
      customFilters: assetTags ?? [],
      people: authors,
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getAuthorFilterOptions(req: Request, res: Response) {
  try {
    const primaryInstitutions = await Author.aggregate([
      {
        $match: {
          primaryInstitution: { $exists: true, $ne: "" },
          orgID: process.env.ORG_ID,
        },
      },
      { $group: { _id: "$primaryInstitution" } },
    ]);

    // Filter & sort results
    const mapped = primaryInstitutions.map((inst) => inst._id);
    const filtered = mapped.filter((inst) => !!inst);

    filtered.sort((a: string, b: string) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return res.send({
      err: false,
      primaryInstitutions: filtered ?? [],
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

async function getProjectFilterOptions(req: Request, res: Response) {
  try {
    return res.send({
      err: false,
      statuses: ["available", "open", "completed"],
    });
  } catch (err) {
    debugError(err);
    return conductor500Err(res);
  }
}

function _checkIsExactMatchQuery(query: string): [boolean, string] {
  let isExactMatchSearch = false;
  let strippedQuery = "";

  if (query.length > 2) {
    if (query.charAt(0) === '"' && query.charAt(query.length - 1) === '"') {
      isExactMatchSearch = true;
      strippedQuery = query.substring(1, query.length - 1);
    }
  }

  return [isExactMatchSearch, strippedQuery];
}

function _transformToCompare(val: any) {
  return String(val)
    .toLowerCase()
    .replace(/[^A-Za-z]+/g, "");
}

function _boostExactMatches(file: any, query: string) {
  const searchQuery = query.toLowerCase().split(" ");
  const name = file.name?.toLowerCase() ?? "";
  const description = file.description?.toLowerCase() ?? "";
  const authorFirsts =
    file.authors?.map((a: any) => {
      if (!a || typeof a !== "object") return null;
      if (!a.firstName) return null;
      if (typeof a.firstName === "string") return a.firstName.toLowerCase();
      return null;
    }) ?? [];
  const authorLasts =
    file.authors?.map((a: any) => {
      if (!a || typeof a !== "object") return null;
      if (!a.lastName) return null;
      if (typeof a.lastName === "string") return a.lastName.toLowerCase();
      return null;
    }) ?? [];
  const tags =
    (file.tags?.map((t: any) => {
      if (!t || typeof t !== "object") return null;
      if (!("value" in t)) return null;
      if (typeof t.value === "string") return t.value.toLowerCase();
      // if values is an array, map to lowercase and flatten
      if (Array.isArray(t.value))
        return t.value.map((v: string) => v.toLowerCase()).flat();
    }) as string[]) ?? [];

  if (searchQuery.some((substring) => (name as string).includes(substring))) {
    file.score = file.score * 2;
  }
  if (
    searchQuery.some((substring) => (description as string).includes(substring))
  ) {
    file.score = file.score * 2;
  }
  if (
    authorFirsts.some((firstName: string) => searchQuery.includes(firstName))
  ) {
    file.score = file.score * 2;
  }
  if (authorLasts.some((lastName: string) => searchQuery.includes(lastName))) {
    file.score = file.score * 2;
  }

  const boostByPrimaryOrCorresponding = () => {
    if (file.primaryAuthor) {
      const primaryAuthor = `${file.primaryAuthor.firstName} ${file.primaryAuthor.lastName}`;
      if (searchQuery.some((s) => primaryAuthor.toLowerCase().includes(s))) {
        file.score = file.score * 2;
        return; // don't boost corresponding author if primary author is a match
      }
    }
    if (file.correspondingAuthor) {
      const correspondingAuthor = `${file.correspondingAuthor.firstName} ${file.correspondingAuthor.lastName}`;
      if (
        searchQuery.some((s) => correspondingAuthor.toLowerCase().includes(s))
      ) {
        file.score = file.score * 2;
      }
    }
  };

  boostByPrimaryOrCorresponding();

  if (tags.length > 0) {
    const flattened = tags.flat();
    // split each tag into words and flatten
    const split = flattened.map((t) => t.toString().split(" "));
    const final = split.flat();
    if (final.some((t) => searchQuery.includes(t))) {
      // does this need to match all? (every)
      file.score = file.score * 2;
    }
  }
  return file;
}

function _calculateLowerOutlierThreshold(numbers: number[], k = 1.5) {
  // Step 1: Compute the mean
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;

  // Step 2: Calculate the standard deviation
  const squaredDifferences = numbers.map((num) => Math.pow(num - mean, 2));
  const variance =
    squaredDifferences.reduce((sum, squaredDiff) => sum + squaredDiff, 0) /
    numbers.length;
  const standardDeviation = Math.sqrt(variance);

  // Step 3: Determine the threshold for outliers
  const threshold = mean - k * standardDeviation;

  // Step 4: Return the threshold as absolute value
  return Math.abs(threshold);
}

async function addToSearchQueryCache(query: string, scope: string) {
  try {
    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    });

    if (!org?.FEAT_RecordSearchQueries) return true; // Check if feature flag is enabled

    searchQueryCache.push({
      query,
      scope,
      timestamp: new Date(),
    });

    // Flush the cache if it's too large
    if (searchQueryCache.length >= 100) {
      await flushSearchQueryCache();
    }

    return true;
  } catch (err) {
    debugError(err);
    return false;
  }
}

async function flushSearchQueryCache() {
  try {
    if (searchQueryCache.length === 0) return true;

    const org = await Organization.findOne({
      orgID: process.env.ORG_ID,
    });

    // @ts-ignore
    if (!org?.FEAT_RecordSearchQueries) return true; // Check if feature flag is enabled

    const localCopy = [...searchQueryCache]; // Copy so we can keep collecting queries while we flush
    searchQueryCache.splice(0, searchQueryCache.length); // Clear the cache

    // Write to the database
    await SearchQuery.insertMany(localCopy);
    console.log("[SYSTEM] Flushed search query cache to database");

    return true;
  } catch (err) {
    debugError(err);
    return false;
  }
}

setInterval(flushSearchQueryCache, 1000 * 60 * 60 * 3); // Flush every 3 hours

export default {
  assetsSearch,
  booksSearch,
  homeworkSearch,
  miniReposSearch,
  projectsSearch,
  usersSearch,
  authorsSearch,
  getAutocompleteResults,
  getAssetFilterOptions,
  getAuthorFilterOptions,
  getProjectFilterOptions,
};
