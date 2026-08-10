import Project, { type ProjectInterface, type ProjectInterfaceRaw } from "../../models/project";
import type { HydratedDocument } from "mongoose";
import type { Response } from "express";
import { checkProjectGeneralPermission, checkProjectMemberPermission, checkProjectAdminPermission } from "../../util/project-permissions";
import { Prettify } from "../../types";

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
] as const satisfies readonly (keyof ProjectInterfaceRaw)[];

type PermissionField = (typeof PERMISSION_FIELDS)[number];

export type ProjectPermissionShape = Pick<ProjectInterfaceRaw, PermissionField>;

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
}
