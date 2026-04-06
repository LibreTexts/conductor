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

    public async getAllAuthors(): Promise<AuthorInterface[]> {
        const authors = await Author.find({ orgID: process.env.ORG_ID }).lean();
        return authors as unknown as AuthorInterface[];
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

    public async getAuthorByNameKey(nameKey: string): Promise<AuthorInterface | null> {
        const aggRes = await Author.aggregate([
            {
                $match: {
                    nameKey: nameKey,
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

    public formatAuthorsForTemplate(authors: AuthorInterface[]): string {
        const seen = new Set<string>();
        const result: Record<string, unknown> = {};

        for (const author of authors) {
            if (!author.nameKey || seen.has(author.nameKey)) continue;
            seen.add(author.nameKey);

            const filtered = Object.fromEntries(
                AuthorService.KEYS_TO_INCLUDE_FOR_TEMPLATE
                    .filter((key) => {
                        if (key === "nameKey") return false; // nameKey is used as the root key and should not be nested within the author object
                        if (!(key in author) || author[key] === undefined || author[key] === "") return false; // exlude keys that are not present or have empty values
                        if (key === "pictureCircle") return author[key] === "no"; // only include pictureCircle if it's "no" to indicate non-circular pictures, since "yes" is the default assumption in the template
                        return true;
                    })
                    .map((key) => [key, this.sanitizeValue(author[key])])
            );

            result[author.nameKey.toLowerCase()] = this.toLowercaseKeys(filtered as Record<string, unknown>);
        }

        return JSON.stringify(result, null, 2);
    }

    /**
    * Only these keys from the Author data should be included in the template.
    * If the key isn't present in the Author's data, simply omit it from the output JSON.
    * The 'nameKey' serves as the key for each author object in the JSON, and it is required.
    * The rest of the keys are optional and can be included if the data is available for that author.
    */
    private static readonly KEYS_TO_INCLUDE_FOR_TEMPLATE: (keyof AuthorInterface)[] = [
        "nameKey",
        "name",
        "nameTitle",
        "nameURL",
        "note",
        "noteURL",
        "companyName",
        "companyURL",
        "pictureCircle",
        "pictureURL",
        "programName",
        "programURL",
        "attributionPrefix",
    ]

    private sanitizeAuthorData(data: Partial<z.infer<typeof CreateAuthorValidator>['body']>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            if (value !== "" && value !== undefined) {
                result[key] = value;
            }
        }

        return result;
    }

    /**
    * Remove invalid escape sequences from string values before they enter the JSON output.
    * Collapses one or more backslashes immediately before an apostrophe into just the apostrophe,
    * mirroring the fix applied during the author import migration.
    * All other escaping is handled correctly by JSON.stringify.
    */
    private sanitizeValue(value: unknown): unknown {
        if (typeof value !== "string") return value;
        return value.replace(/\\+'(?!')/g, "'");
    }

    private toLowercaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
        return Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
                key.toLowerCase(),
                value !== null && typeof value === "object" && !Array.isArray(value)
                    ? this.toLowercaseKeys(value as Record<string, unknown>)
                    : value,
            ])
        );
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
