import { z } from "zod";
import {
    GetAuthorsValidator,
    CreateAuthorValidator,
    CreateAuthorGroupValidator,
    UpdateAuthorValidator,
    FindSimilarAuthorsValidator,
} from "../validators/authors.js";
import { BaseConductorInfiniteScrollResponse } from "../../types";
import Author, { AuthorInterface } from "../../models/author.js";
import { escapeRegEx, getPaginationOffset } from "../../util/helpers.js";
import { Types } from "mongoose";
import { createResponseCache } from "../../util/response-cache.js";
import {
    MEMBER_OVERRIDE_FIELDS,
    describeGroup,
    expandGroupMembers,
    isAuthorGroup,
    type GroupMemberRef,
} from "../../util/author-groups.js";
import { scoreNames } from "../../util/author-name-match.js";

/** Thrown when an author group is invalid or can't be changed. Surfaced to the client as a 4xx. */
export class AuthorGroupError extends Error {
    constructor(message: string, public readonly status: 400 | 409 = 400) {
        super(message);
        this.name = "AuthorGroupError";
    }
}

/** The fields exposed by the anonymous name-key lookups. */
const PUBLIC_AUTHOR_PROJECTION = {
    _id: 0,
    nameKey: 1,
    name: 1,
    nameURL: 1,
    campusName: 1,
    campusURL: 1,
    pictureURL: 1,
    pictureCircle: 1,
    attributionPrefix: 1,
    programName: 1,
    programURL: 1,
    groupMembers: 1,
    autoName: 1,
} as const;

type GroupMemberInput = z.infer<typeof CreateAuthorGroupValidator>["body"]["members"][number];

export default class AuthorService {
    public async getAuthors(params: z.infer<typeof GetAuthorsValidator>['query']): Promise<BaseConductorInfiniteScrollResponse<AuthorInterface>> {
        let filter: any = { orgID: process.env.ORG_ID };

        if (params.query) {
            const queryRegex = new RegExp(escapeRegEx(params.query), "i");
            filter.$or = [{ name: queryRegex }, { nameKey: queryRegex }, { campusName: queryRegex }, { programName: queryRegex }];
        }

        const offset = getPaginationOffset(params.page, params.limit);

        const authors = await Author.find(filter).sort({ [params.sort]: 1 }).skip(offset).limit(params.limit).lean();
        const total = await Author.countDocuments(filter);

        const has_more = offset + params.limit < total;
        const next_page = has_more ? params.page + 1 : null;

        // Which groups each author on this page belongs to, in one query.
        const memberOf = await this.findParentGroupKeys(authors.map((a) => a.nameKey));
        const items = authors.map((a) => {
            const groups = memberOf.get(a.nameKey);
            return groups?.length ? { ...a, memberOfKeys: groups } : a;
        });

        return {
            items: items as unknown as AuthorInterface[],
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

        if (aggRes.length === 0) return null;

        const author = aggRes[0];
        const groups = author.nameKey
            ? (await this.findParentGroupKeys([author.nameKey])).get(author.nameKey)
            : undefined;
        return groups?.length ? { ...author, memberOfKeys: groups } : author;
    }

    /** For each key, the keys of the groups it is a member of. */
    private async findParentGroupKeys(nameKeys: Array<string | undefined>): Promise<Map<string, string[]>> {
        const result = new Map<string, string[]>();
        // Some older records have no key at all. They can't be anyone's member, and an
        // undefined entry in the $in would break the query for the whole page.
        const keys = nameKeys.filter((k): k is string => !!k);
        if (keys.length === 0) return result;

        const wanted = new Set(keys);
        const groups = await Author.find(
            { orgID: process.env.ORG_ID, "groupMembers.nameKey": { $in: keys } },
            { nameKey: 1, groupMembers: 1 }
        ).lean();

        for (const group of groups) {
            for (const member of group.groupMembers ?? []) {
                if (!wanted.has(member.nameKey)) continue;
                result.set(member.nameKey, [...(result.get(member.nameKey) ?? []), group.nameKey]);
            }
        }
        return result;
    }

    // This lookup is hit on nearly every MindTouch library page load, almost always
    // for the same handful of keys. Static so the cache is shared across requests:
    // the service itself is constructed per request.
    private static readonly BY_NAME_KEY_CACHE_TTL_SECONDS = 180;
    // Entries can carry an author's project list, so this is capped tighter than a
    // cache of scalars would be. It still comfortably exceeds the number of distinct
    // authors a library serves in a 3 minute window.
    private static readonly BY_NAME_KEY_CACHE_MAX_KEYS = 2000;
    private static readonly _byNameKeyCache = createResponseCache<AuthorInterface | null>({
        ttlSeconds: AuthorService.BY_NAME_KEY_CACHE_TTL_SECONDS,
        maxKeys: AuthorService.BY_NAME_KEY_CACHE_MAX_KEYS,
        name: "author-by-name-key",
    });

    public async getAuthorByNameKey(nameKey: string, includeProjects = false): Promise<AuthorInterface | null> {
        // `includeProjects` changes both the $lookup and the projection, so it is part of the key.
        const cacheKey = `${process.env.ORG_ID}:${nameKey}:${includeProjects ? 1 : 0}`;

        return AuthorService._byNameKeyCache.getOrLoad(cacheKey, async () => {
            const aggRes = await Author.aggregate([
                {
                    $match: {
                        nameKey: nameKey,
                        orgID: process.env.ORG_ID,
                    },
                },
                ...(includeProjects ? [AuthorService.LOOKUP_AUTHOR_PROJECTS_STAGE] : []),
                {
                    $project: {
                        ...PUBLIC_AUTHOR_PROJECTION,
                        ...(includeProjects ? { projects: 1 } : {}),
                    }
                }
            ]);

            const author = aggRes.length > 0 ? aggRes[0] : null;
            if (!isAuthorGroup(author)) return author;

            // A group is presented as a single author (derived name and campus) so readers
            // that only understand single authors render it sensibly; `members` is the extra
            // data for readers that understand groups.
            const byKey = await this.findPublicAuthors(
                author.groupMembers.map((m: { nameKey: string }) => m.nameKey)
            );
            const members = expandGroupMembers(author, (k) => byKey.get(k));
            return { ...author, ...describeGroup(author, members), members };
        });
    }

    private static readonly _byNameKeysCache = createResponseCache<{
        authors: AuthorInterface[];
        missing: string[];
    }>({
        ttlSeconds: AuthorService.BY_NAME_KEY_CACHE_TTL_SECONDS,
        maxKeys: AuthorService.BY_NAME_KEY_CACHE_MAX_KEYS,
        name: "authors-by-name-keys",
    });

    /**
     * Resolves several nameKeys in one query, in the order requested. Groups are replaced by
     * their members and duplicates are dropped, so a page tagged with both a group and one of
     * its members lists that author once. Keys with no author are returned in `missing`.
     */
    public async getAuthorsByNameKeys(
        nameKeys: string[]
    ): Promise<{ authors: AuthorInterface[]; missing: string[] }> {
        const keys = [...new Set(nameKeys)];
        const cacheKey = `${process.env.ORG_ID}:${keys.join(",")}`;

        return AuthorService._byNameKeysCache.getOrLoad(cacheKey, async () => {
            const found = await this.findPublicAuthors(keys);

            const memberKeys = [...found.values()].flatMap((a) =>
                (a.groupMembers ?? []).map((m) => m.nameKey)
            );
            const members = await this.findPublicAuthors(memberKeys.filter((k) => !found.has(k)));
            const lookup = (k: string) => found.get(k) ?? members.get(k);

            // The same person can be reached through several keys; the first occurrence wins.
            const authors: AuthorInterface[] = [];
            const seen = new Set<string>();
            const push = (a: AuthorInterface) => {
                if (!seen.has(a.nameKey)) {
                    seen.add(a.nameKey);
                    authors.push(a);
                }
            };

            for (const key of keys) {
                const author = found.get(key);
                if (!author) continue;
                if (isAuthorGroup(author)) {
                    expandGroupMembers(author, lookup).forEach(push);
                } else {
                    push(author);
                }
            }

            return { authors, missing: keys.filter((k) => !found.has(k)) };
        });
    }

    private async findPublicAuthors(nameKeys: string[]): Promise<Map<string, AuthorInterface>> {
        if (nameKeys.length === 0) return new Map();
        const docs = await Author.find(
            { orgID: process.env.ORG_ID, nameKey: { $in: nameKeys } },
            PUBLIC_AUTHOR_PROJECTION
        ).lean();
        return new Map((docs as unknown as AuthorInterface[]).map((a) => [a.nameKey, a]));
    }

    /** Drops blank overrides so a membership only stores what it actually changes. */
    private normalizeGroupMembers(members: GroupMemberRef[]): GroupMemberRef[] {
        return members.map((m) => {
            const out: GroupMemberRef = { nameKey: m.nameKey };
            for (const field of MEMBER_OVERRIDE_FIELDS) {
                if (m[field]) out[field] = m[field];
            }
            return out;
        });
    }

    /**
     * Checks that `members` can legally make up the group identified by `selfKey` (and
     * `selfID` when it already exists). Groups are one level deep: a member must be an
     * existing individual author, and an author that is itself a member of a group can't
     * become a group. Reusing one individual across many groups is fine.
     */
    private async assertValidGroupMembers(
        members: Array<{ nameKey: string }>,
        selfKey: string | undefined,
        selfID?: string
    ): Promise<void> {
        if (members.length === 0) return;
        const memberKeys = members.map((m) => m.nameKey);

        if (new Set(memberKeys).size !== memberKeys.length) {
            throw new AuthorGroupError("Group members must be unique.");
        }
        if (selfKey && memberKeys.includes(selfKey)) {
            throw new AuthorGroupError("An author can't be a member of itself.");
        }

        const found = await Author.find(
            { orgID: process.env.ORG_ID, nameKey: { $in: memberKeys } },
            { nameKey: 1, groupMembers: 1 }
        ).lean();

        const foundKeys = new Set(found.map((m) => m.nameKey));
        const missing = memberKeys.filter((k) => !foundKeys.has(k));
        if (missing.length > 0) {
            throw new AuthorGroupError(`Unknown author key(s): ${missing.join(", ")}.`);
        }
        const nested = found.filter((m) => isAuthorGroup(m)).map((m) => m.nameKey);
        if (nested.length > 0) {
            throw new AuthorGroupError(
                `Group members can't themselves be groups: ${nested.join(", ")}.`
            );
        }

        if (selfKey) {
            const parent = await Author.exists({
                orgID: process.env.ORG_ID,
                "groupMembers.nameKey": selfKey,
                ...(selfID && { _id: { $ne: new Types.ObjectId(selfID) } }),
            });
            if (parent) {
                throw new AuthorGroupError(
                    "This author is a member of a group, so it can't also be a group.",
                    409
                );
            }
        }
    }

    /** The members' current names, in order, joined the way a group's derived name is. */
    private async joinedMemberNames(members: Array<{ nameKey: string }>): Promise<string> {
        const byKey = await this.findPublicAuthors(members.map((m) => m.nameKey));
        return members
            .map((m) => byKey.get(m.nameKey)?.name)
            .filter(Boolean)
            .join(", ");
    }

    public async createAuthor(data: z.infer<typeof CreateAuthorValidator>['body']): Promise<AuthorInterface> {
        const groupMembers = data.groupMembers ? this.normalizeGroupMembers(data.groupMembers) : undefined;
        await this.assertValidGroupMembers(groupMembers ?? [], undefined);

        // Keys are always generated, never taken from the caller. A generated key can lose a
        // race with a parallel create; the unique index catches it, so retry.
        const maxAttempts = 3;

        for (let attempt = 1; ; attempt += 1) {
            try {
                return await Author.create({
                    ...this.sanitizeAuthorData(data),
                    ...(groupMembers?.length && { groupMembers, autoName: data.autoName ?? true }),
                    nameKey: await this.generateUniqueNameKey(data.name),
                    orgID: process.env.ORG_ID,
                });
            } catch (err: any) {
                if (err?.code === 11000 && attempt < maxAttempts) continue;
                throw err;
            }
        }
    }

    /**
     * Builds a nameKey from an author's name (e.g. "Jane Q. Doe" -> "jane-q-doe"),
     * appending the next free "-N" suffix when the base key is already taken in this org.
     */
    public async generateUniqueNameKey(name: string): Promise<string> {
        const base =
            name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 90)
                .replace(/-+$/g, "") || "author";

        const re = new RegExp(`^${escapeRegEx(base)}(?:-(\\d+))?$`);
        const existing = await Author.find(
            { orgID: process.env.ORG_ID, nameKey: re },
            { nameKey: 1 }
        ).lean();
        if (existing.length === 0) return base;

        const taken = new Set<number>(
            existing.map((a) => Number(String(a.nameKey).match(re)?.[1] ?? 1))
        );
        let n = 2;
        while (taken.has(n)) n += 1;
        return `${base}-${n}`;
    }

    public async updateAuthor(id: string, data: z.infer<typeof UpdateAuthorValidator>['body']): Promise<AuthorInterface> {
        const toSet: Record<string, unknown> = {};
        const toUnset: Record<string, 1> = {};

        const groupMembers = data.groupMembers ? this.normalizeGroupMembers(data.groupMembers) : undefined;
        const existing = await Author.findOne(
            { _id: id, orgID: process.env.ORG_ID },
            { nameKey: 1, name: 1 }
        ).orFail().lean();
        if (groupMembers?.length) {
            await this.assertValidGroupMembers(groupMembers, existing.nameKey || undefined, id);
        }

        for (const [key, value] of Object.entries(this.sanitizeAuthorData(data))) {
            if (value !== undefined) {
                toSet[key] = value;
            }
        }
        // A key is permanent: pages and groups refer to the author by it, so a caller can never
        // change it. A record that somehow has none (e.g. imported directly) gets one generated.
        delete toSet.nameKey;
        if (!existing.nameKey) {
            toSet.nameKey = await this.generateUniqueNameKey(data.name || existing.name);
        }

        if (groupMembers?.length) {
            toSet.groupMembers = groupMembers;
            // Keep the stored name in step with the members while it is derived, so the
            // admin table (which reads the stored name) doesn't show a stale one.
            const autoName = data.autoName ?? (await this.getStoredAutoName(id));
            toSet.autoName = autoName;
            if (autoName) toSet.name = await this.joinedMemberNames(groupMembers);
        }

        // An empty group is just an individual author: remove the fields rather than store [].
        if (Array.isArray(data.groupMembers) && data.groupMembers.length === 0) {
            delete toSet.groupMembers;
            delete toSet.autoName;
            toUnset.groupMembers = 1;
            toUnset.autoName = 1;
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

    /**
     * For each typed name, the existing individual authors it could be. Advisory: the admin
     * decides whether it really is the same person.
     */
    public async findSimilarAuthors(
        data: z.infer<typeof FindSimilarAuthorsValidator>["body"]
    ): Promise<Array<{ input: string; candidates: Array<Record<string, unknown>> }>> {
        const excluded = new Set(data.excludeKeys ?? []);
        // Groups are skipped (their name is just their members' names joined).
        const people = (await Author.find(
            { orgID: process.env.ORG_ID, groupMembers: { $exists: false } },
            { nameKey: 1, name: 1, nameURL: 1, campusName: 1 }
        ).lean()) as unknown as AuthorInterface[];

        return data.names.map((input) => ({
            input,
            candidates: people
                .filter((p) => !excluded.has(p.nameKey))
                .map((p) => ({
                    // Older records can lack a key, so the id is what always identifies one.
                    _id: String(p._id),
                    nameKey: p.nameKey,
                    name: p.name,
                    nameURL: p.nameURL,
                    campusName: p.campusName,
                    score: scoreNames(input, p.name),
                }))
                .filter((c) => c.score >= 0.7)
                .sort((a, b) => b.score - a.score)
                .slice(0, 5),
        }));
    }

    private async getStoredAutoName(id: string): Promise<boolean> {
        const existing = await Author.findOne(
            { _id: id, orgID: process.env.ORG_ID },
            { autoName: 1 }
        ).lean();
        return existing?.autoName !== false;
    }

    public async deleteAuthor(id: string): Promise<void> {
        const author = await Author.findOne(
            { _id: id, orgID: process.env.ORG_ID },
            { nameKey: 1 }
        ).orFail().lean();

        // Deleting someone who is still in a group would leave that group (and any page
        // tagged with it) silently one author short.
        const groups = await Author.find(
            { orgID: process.env.ORG_ID, "groupMembers.nameKey": author.nameKey },
            { nameKey: 1 }
        ).lean();
        if (groups.length > 0) {
            throw new AuthorGroupError(
                `This author is still a member of: ${groups.map((g) => g.nameKey).join(", ")}. Remove them from those groups first.`,
                409
            );
        }

        await Author.deleteOne({ _id: id, orgID: process.env.ORG_ID }).orFail();
    }

    /**
     * Creates a group and any brand-new individuals in it, in one call. New individuals are
     * created first (each with its own generated key); if the group then fails to save, only
     * the individuals created by this call are removed again.
     */
    public async createGroup(
        data: z.infer<typeof CreateAuthorGroupValidator>["body"]
    ): Promise<AuthorInterface> {
        const createdIDs: Types.ObjectId[] = [];
        try {
            const members: GroupMemberRef[] = [];
            for (const m of data.members as GroupMemberInput[]) {
                const overrides = Object.fromEntries(
                    MEMBER_OVERRIDE_FIELDS.map((f) => [f, m[f]])
                );
                if (m.new) {
                    const created = await this.createAuthor(
                        m.new as z.infer<typeof CreateAuthorValidator>["body"]
                    );
                    createdIDs.push(created._id as Types.ObjectId);
                    members.push({ ...overrides, nameKey: created.nameKey });
                } else {
                    members.push({ ...overrides, nameKey: m.nameKey as string });
                }
            }

            const customName = data.name || undefined;
            const name = customName ?? (await this.joinedMemberNames(members));
            // Everything on the entry other than the member list belongs to the group itself.
            const { members: _members, name: _name, ...shared } = data;
            return await this.createAuthor({
                ...shared,
                name,
                groupMembers: members,
                autoName: !customName,
            } as z.infer<typeof CreateAuthorValidator>["body"]);
        } catch (err) {
            if (createdIDs.length > 0) {
                await Author.deleteMany({ _id: { $in: createdIDs }, orgID: process.env.ORG_ID });
            }
            throw err;
        }
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
                            $eq: ["$defaultPrimaryAuthorID", "$$authorID"],
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
