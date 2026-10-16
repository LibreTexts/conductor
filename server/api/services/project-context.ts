import Project, { type ProjectInterface, type ProjectInterfaceRaw } from "../../models/project";
import type { HydratedDocument } from "mongoose";
import type { Response } from "express";
import { checkProjectGeneralPermission, checkProjectMemberPermission, checkProjectAdminPermission } from "../../util/project-permissions";
import { Prettify } from "../../types";
import { checkBookIDFormat } from "../../util/bookutils";
import { getSubdomainFromUrl } from "../../util/helpers";
import LibraryService from "./library-service";
import { LibraryInterfaceRaw } from "../../models/library";
import User, { UserInterface } from "../../models/user";
import { childLogger } from "../../logger";

const projectContextLog = childLogger("project-context");

// `as const satisfies` keeps the literal tuple type (so PermissionField is a
// precise union) while still validating every entry is a real Project key.
const PERMISSION_FIELDS = [
    "projectID",
    "leads",
    "liaisons",
    "members",
    "auditors",
    "visibility",
    "status",
    "libreLibrary", // Used for project-book permissions checks. Always load.
    "libreCoverID", // Used for project-book permissions checks. Always load.
    "projectURL", // Used for project-book permissions checks (legacy cases). Always load.
] as const satisfies readonly (keyof ProjectInterfaceRaw)[];

type PermissionField = (typeof PERMISSION_FIELDS)[number];

export type ProjectPermissionShape = Pick<ProjectInterfaceRaw, PermissionField>;

export const DEFAULT_TEAM_FIELDS = ['uuid', 'centralID', 'firstName', 'lastName'] as const;
type DefaultTeamField = (typeof DEFAULT_TEAM_FIELDS)[number];

// What a lean doc actually contains given the caller's `select`: the fields they
// asked for, plus the permission fields we always force-load.
type LoadedDoc<S extends keyof ProjectInterfaceRaw> = Prettify<Pick<ProjectInterfaceRaw, S | PermissionField>>;

export class ProjectError extends Error {
    constructor(public readonly code: "notfound" | "unauthorized") {
        super(code);

        let message = "";
        switch (code) {
            case "notfound":
                message = "Project not found";
                break;
            case "unauthorized":
                message = "Unauthorized access to project";
                break;
        }


        this.name = "ProjectError";
        this.message = message;
    }
}

export function returnProjectError(res: Response, err: ProjectError) {
    switch (err.code) {
        case "notfound":
            return res.status(404).send({ err: true, errMsg: err.message });
        case "unauthorized":
            return res.status(403).send({ err: true, errMsg: err.message });
        default:
            return res.status(500).send({ err: true, errMsg: "Internal server error" });
    }
}

export class ProjectContext<T = ProjectInterfaceRaw> {
    private constructor(readonly doc: T) { }

    // signature overloads for `load()`:
    // no select → full lean doc
    static load(
        projectID: string,
        opts?: { hydrate?: false }
    ): Promise<ProjectContext<ProjectInterfaceRaw>>;
    // select → narrowed lean doc. `const S` means callers don't write `as const`.
    static load<const S extends keyof ProjectInterfaceRaw>(
        projectID: string,
        opts: { select: readonly S[]; hydrate?: false }
    ): Promise<ProjectContext<LoadedDoc<S>>>;
    // hydrate → full Mongoose doc for mutation + .save() (select intentionally ignored)
    static load(
        projectID: string,
        opts: { hydrate: true }
    ): Promise<ProjectContext<HydratedDocument<ProjectInterface>>>;

    static async load(
        projectID: string,
        opts?: { select?: readonly (keyof ProjectInterfaceRaw)[]; hydrate?: boolean }
    ): Promise<ProjectContext<any>> {
        const id = String(projectID ?? "");
        if (!id) throw new ProjectError("notfound");

        /**
         * If opts.hydrate is true, we always load the full doc, regardless of opt.select.
         * If opts.hydrate is false and opts.select is specified, we load only the fields specified in opts.select, plus PERMISSION_FIELDS.
         * If opts.select is not specificed, we load all fields (but don't hydrate with Mongoose methods AKA lean query).
         */
        const projection = opts?.hydrate
            ? undefined
            : opts?.select
                ? Array.from(new Set([...PERMISSION_FIELDS, ...opts.select])).join(" ")
                : undefined;

        const query = Project.findOne({ projectID: { $eq: id } }, projection);

        const doc = opts?.hydrate ? await query.exec() : await query.lean().exec();
        if (!doc) throw new ProjectError("notfound");

        return new ProjectContext(doc);
    }

    canGeneral(this: ProjectContext<ProjectPermissionShape>, user: unknown): boolean {
        return checkProjectGeneralPermission(this.doc, user);
    }

    canMember(this: ProjectContext<ProjectPermissionShape>, user: unknown): boolean {
        return checkProjectMemberPermission(this.doc, user);
    }

    canAdmin(this: ProjectContext<ProjectPermissionShape>, user: unknown): boolean {
        return checkProjectAdminPermission(this.doc, user);
    }

    /**
     * Returns the linked book identifier in the format "libreLibrary-libreCoverID".
     * If either libreLibrary or libreCoverID is missing, or the resulting identifier is not in a valid format, returns null.
     * @param this The project context containing the project document.
     * @returns A string in the format "libreLibrary-libreCoverID", or null if either field is missing or the format is invalid.
     */
    getLinkedBook(this: ProjectContext<ProjectPermissionShape>): string | null {
        if (!this.doc.libreLibrary || !this.doc.libreCoverID) return null;
        const candidate = `${this.doc.libreLibrary}-${this.doc.libreCoverID}`;
        if (!checkBookIDFormat(candidate)) return null;
        return candidate;
    }

    /**
     * Retrieves the library associated with the project, optionally including hidden libraries.
     * Prefers the library explicitly linked in the project document, falling back to the library inferred from the project URL if necessary (this is a legacy case for older projects).
     * @param this The project context containing the project document.
     * @param opts Optional settings, including whether to exclude hidden libraries (included by default).
     * @returns The library associated with the project, or null if not found.
     */
    async getProjectLibrary(this: ProjectContext<ProjectPermissionShape>, opts: { includeHidden: boolean } = { includeHidden: true }): Promise<LibraryInterfaceRaw | null> {
        let librarySubdomain = this.doc.libreLibrary || null;

        if (!librarySubdomain && this.doc.projectURL) {
            librarySubdomain = getSubdomainFromUrl(this.doc.projectURL);
        }

        if (!librarySubdomain) return null;

        const library = await (new LibraryService()).getLibraryFromSubdomain(librarySubdomain, { includeHidden: opts.includeHidden });

        return library;
    }

    /**
     * Retrieves a subset of each team member's information.
     * Defaults to UUID, Central ID, first name, and last name.
     * @param this The project context containing the project document.
     * @param fields Optional list of User fields to select instead of the defaults.
     * @returns An array of team members with the selected fields.
     */
    async getTeam<K extends keyof UserInterface = DefaultTeamField>(
        this: ProjectContext<ProjectPermissionShape>,
        fields?: readonly K[],
    ): Promise<Pick<UserInterface, K>[]> {
        const selected: readonly (keyof UserInterface)[] = fields ?? DEFAULT_TEAM_FIELDS;
        try {
            const ids = this.getTeamIDs();
            const projection = Object.fromEntries(selected.map(f => [f, 1]));
            const users = await User.find({ uuid: { $in: ids } }, projection).lean();
            return users.map(user =>
                // @ts-expect-error
                Object.fromEntries(selected.map(f => [f, (user as UserInterface)[f]])),
            ) as Pick<UserInterface, K>[];
        } catch (e) {
            projectContextLog.error({ err: e }, "getTeam failed");
            return [];
        }
    }

    /**
     * Returns a flat string array of all team member IDs, including leads, liaisons, members, and auditors, with duplicates removed.
     * @param this The project context containing the project document.
     * @returns An array of unique team member local IDs (not Central Identity IDs).
     */
    getTeamIDs(this: ProjectContext<ProjectPermissionShape>): string[] {
        const teamIDs: string[] = [];
        if (Array.isArray(this.doc.leads)) teamIDs.push(...this.doc.leads);
        if (Array.isArray(this.doc.liaisons)) teamIDs.push(...this.doc.liaisons);
        if (Array.isArray(this.doc.members)) teamIDs.push(...this.doc.members);
        if (Array.isArray(this.doc.auditors)) teamIDs.push(...this.doc.auditors);
        return Array.from(new Set(teamIDs));
    }
}
