import { z } from "zod";
import { GetAuthorsValidator, CreateAuthorValidator, UpdateAuthorValidator } from "../validators/authors.js";
import { BaseConductorInfiniteScrollResponse } from "../../types";
import Author, { AuthorInterface } from "../../models/author.js";
import { escapeRegEx, getPaginationOffset } from "../../util/helpers.js";
import { Types } from "mongoose";

export default class AuthorService {
    public async getAuthors(params: z.infer<typeof GetAuthorsValidator>['query']): Promise<BaseConductorInfiniteScrollResponse<AuthorInterface>> {
        let filter: any = { orgID: process.env.ORG_ID };

        if (params.query) {
            const queryRegex = new RegExp(escapeRegEx(params.query), "i");
            filter.$or = [{ name: queryRegex }, { nameKey: queryRegex }, { companyName: queryRegex }, { programName: queryRegex }];
        }

        const offset = getPaginationOffset(params.page, params.limit);

        const authors = await Author.find(filter).sort({ [params.sort]: 1 }).skip(offset).limit(params.limit).lean();
        const total = await Author.countDocuments(filter);

        const has_more = offset + params.limit < total;
        const next_page = has_more ? params.page + 1 : null;

        return {
            items: authors as unknown as AuthorInterface[],
            meta: {
                has_more,
                next_page,
                total_count: total,
            }
        };
    }

    public async getAuthorByID(id: string): Promise<AuthorInterface | null> {
        const convertedID = new Types.ObjectId(id);

        const aggRes = await Author.aggregate([
            {
                $match: {
                    _id: convertedID,
                    orgID: process.env.ORG_ID,
                },
            },
            AuthorService.LOOKUP_AUTHOR_PROJECTS_STAGE,
        ]);

        return aggRes.length > 0 ? aggRes[0] : null;
    }

    public async createAuthor(data: z.infer<typeof CreateAuthorValidator>['body']): Promise<AuthorInterface> {
        const author = await Author.create({
            ...this.sanitizeAuthorData(data),
            orgID: process.env.ORG_ID,
        });
        return author;
    }

    public async updateAuthor(id: string, data: z.infer<typeof UpdateAuthorValidator>['body']): Promise<AuthorInterface> {
        const toSet: Record<string, unknown> = {};
        const toUnset: Record<string, 1> = {};

        for (const [key, value] of Object.entries(this.sanitizeAuthorData(data))) {
            if (value !== undefined) {
                toSet[key] = value;
            }
        }

        // Unset fields that were explicitly cleared (empty string sent by client)
        for (const [key, value] of Object.entries(data)) {
            if (key !== 'pictureCircle' && value === "") {
                toUnset[key] = 1;
            }
        }

        await Author.updateOne(
            { _id: id, orgID: process.env.ORG_ID },
            {
                ...(Object.keys(toSet).length > 0 && { $set: toSet }),
                ...(Object.keys(toUnset).length > 0 && { $unset: toUnset }),
            }
        ).orFail();

        return await Author.findById(id).orFail().lean() as unknown as AuthorInterface;
    }

    public async deleteAuthor(id: string): Promise<void> {
        await Author.deleteOne({ _id: id, orgID: process.env.ORG_ID }).orFail();
    }

    private sanitizeAuthorData(data: Partial<z.infer<typeof CreateAuthorValidator>['body']>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            if (value !== "" && value !== undefined) {
                result[key] = value;
            }
        }

        return result;
    }

    static readonly LOOKUP_AUTHOR_PROJECTS_STAGE = {
        $lookup: {
            from: "projects",
            let: {
                authorID: "$_id",
            },
            pipeline: [
                {
                    $match: {
                        orgID: process.env.ORG_ID,
                        visibility: "public",
                    },
                },
                {
                    $match: {
                        $expr: {
                            $or: [
                                {
                                    $eq: ["$defaultPrimaryAuthorID", "$$authorID"],
                                },
                                {
                                    $eq: ["$defaultCorrespondingAuthorID", "$$authorID"],
                                },
                                {
                                    $in: [
                                        "$$authorID",
                                        {
                                            $cond: {
                                                if: {
                                                    $isArray: "$defaultSecondaryAuthorIDs",
                                                },
                                                then: "$defaultSecondaryAuthorIDs",
                                                else: [],
                                            },
                                        },
                                    ],
                                },
                                {
                                    $in: [
                                        "$$authorID",
                                        {
                                            $cond: {
                                                if: {
                                                    $isArray: "$principalInvestigatorIDs",
                                                },
                                                then: "$principalInvestigatorIDs",
                                                else: [],
                                            },
                                        },
                                    ],
                                },
                                {
                                    $in: [
                                        "$$authorID",
                                        {
                                            $cond: {
                                                if: {
                                                    $isArray: "$coPrincipalInvestigatorIDs",
                                                },
                                                then: "$coPrincipalInvestigatorIDs",
                                                else: [],
                                            },
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        projectID: 1,
                        title: 1,
                    },
                },
            ],
            as: "projects",
        },
    };
}
