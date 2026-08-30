import { childLogger } from "../../logger.js";
import Project, {
  ProjectInterfaceRaw,
  PublishStepKey,
  PublishStepState,
} from "../../models/project.js";
import BookBotService from "./book-bot-service.js";
import LibraryService from "./library-service.js";
import ShapeshiftService from "./shapeshift-service.js";
import { syncSingleBook } from "./book-sync-service.js";
import { submitCompileForBook, resolveCompileURL } from "../shapeshift.js";
import { CXOneFetch } from "../../util/librariesclient.js";
import MindTouch from "../../util/CXOne/index.js";
import User from "../../models/user.js";
import BookBotRun from "../../models/bookbotrun.js";
import { ShapeshiftJob } from "../../types/Shapeshift.js";
import ExpertWithSSM from "../../util/ExpertWithSSM.js";
import { ExpertError, text } from "@libretexts/cxone-expert-node";

const publishLog = childLogger("publish");

/**
 * A destination the book can be moved into.
 *
 * `path` is relative to the library root and is what eventually reaches
 * MindTouch's `move?to=`; `hasChildren` tells the picker whether drilling in
 * further is possible.
 */
export type PublishDestination = {
  title: string;
  path: string;
  hasChildren: boolean;
};

/** Live state layered over the persisted step record. */
export type PublishStatus = {
  bookID: string | null;
  library: string | null;
  coverID: string | null;
  /** The coverpage's current path on the library, read live. */
  currentPath: string | null;
  /** The coverpage's current MindTouch restriction, read live. */
  restriction: string | null;
  visibility: ProjectInterfaceRaw["visibility"];
  steps: Record<PublishStepKey, PublishStepState>;
  /** Progress of the in-flight editor-preprocess run, when there is one. */
  preprocessPercentage?: number;
  isPublished: boolean;
};

const STEP_KEYS: PublishStepKey[] = [
  "preprocess",
  "security",
  "move",
  "visibility",
  "compile",
];

/**
 * The MindTouch restriction a published book carries. `Public` is the only
 * level that lets an anonymous reader open the page.
 */
const PUBLIC_RESTRICTION = "Public";

const NOT_STARTED: PublishStepState = { status: "not-started" };

/**
 * Raised when a step cannot run for a reason the user should see verbatim — a
 * taken destination path, a book Commons has not synced. Distinguished from an
 * internal failure so handlers can answer 4xx rather than 500.
 */
export class PublishStepError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 409 = 400
  ) {
    super(message);
    this.name = "PublishStepError";
  }
}

export default class PublishService {
  /**
   * Writes one step's state, merging into whatever is already recorded.
   *
   * Every step goes through here so `actor` and the timestamps are stamped the
   * same way regardless of which system the step talks to.
   */
  private async writeStep(
    projectID: string,
    step: PublishStepKey,
    state: Partial<PublishStepState>
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    const unset: Record<string, "">  = {};
    for (const [key, value] of Object.entries(state)) {
      const path = `publishing.${step}.${key}`;
      // Mongoose strips undefined from `$set`, so a field cleared that way
      // would silently keep its old value — a step that succeeds after failing
      // would carry the previous run's errorMessage forever.
      if (value === undefined) unset[path] = "";
      else set[path] = value;
    }

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;
    if (Object.keys(update).length === 0) return;

    await Project.updateOne({ projectID: { $eq: projectID } }, update);
  }

  private async markRunning(
    projectID: string,
    step: PublishStepKey,
    actor: string,
    extra: Partial<PublishStepState> = {}
  ): Promise<void> {
    await this.writeStep(projectID, step, {
      status: "running",
      startedAt: new Date(),
      finishedAt: undefined,
      errorMessage: undefined,
      actor,
      ...extra,
    });
  }

  private async markSucceeded(
    projectID: string,
    step: PublishStepKey,
    extra: Partial<PublishStepState> = {}
  ): Promise<void> {
    await this.writeStep(projectID, step, {
      status: "succeeded",
      finishedAt: new Date(),
      errorMessage: undefined,
      ...extra,
    });
  }

  private async markFailed(
    projectID: string,
    step: PublishStepKey,
    err: unknown
  ): Promise<void> {
    await this.writeStep(projectID, step, {
      status: "failed",
      finishedAt: new Date(),
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }

  /**
   * Runs `fn`, recording the step as running beforehand and failed on throw.
   * The step is left running when `fn` hands work to another system that
   * reports completion on its own schedule.
   */
  private async runStep<T>(
    projectID: string,
    step: PublishStepKey,
    actor: string,
    fn: () => Promise<T>
  ): Promise<T> {
    await this.markRunning(projectID, step, actor);
    try {
      return await fn();
    } catch (err) {
      await this.markFailed(projectID, step, err);
      throw err;
    }
  }

  /**
   * Step 1 — queue the editor-preprocess bot against the book's live page.
   *
   * The step stays `running` after this returns: the runner reports its own
   * progress through the callback endpoint, and {@link getStatus} reads the
   * resulting `BookBotRun` back.
   */
  public async submitPreprocess(
    project: ProjectInterfaceRaw,
    actorUUID: string
  ): Promise<string> {
    const rootURL = resolveCompileURL(project);
    if (!rootURL) {
      throw new PublishStepError(
        "This project has no linked URL or library book, so it cannot be preprocessed."
      );
    }

    return this.runStep(project.projectID, "preprocess", actorUUID, async () => {
      const user = await User.findOne({ uuid: { $eq: actorUUID } }).lean();
      if (!user) {
        throw new PublishStepError("User not found.", 400);
      }

      const service = new BookBotService();
      const jobID = await service.submitJob({
        botType: "editor-preprocess",
        rootURL,
        triggeredBy: user.uuid,
        libreUser: user.email,
      });

      await this.writeStep(project.projectID, "preprocess", { jobID });
      publishLog.info(
        { projectID: project.projectID, jobID },
        "Preprocess queued"
      );
      return jobID;
    });
  }

  /**
   * Extracts the HTTP status from an error thrown by the CXOne SDK.
   *
   * The SDK wraps every transport failure in an {@link ExpertError} before
   * rejecting, so the status is the only way to tell a taken path from a
   * genuine fault.
   */
  private static httpStatusOf(err: unknown): number | null {
    if (ExpertError.isExpertError(err)) return err.status ?? null;
    const anyErr = err as any;
    return anyErr?.status ?? anyErr?.response?.status ?? null;
  }

  /**
   * Step 2 — lift the book's MindTouch restriction to `Public`.
   *
   * Separate from step 4: this is the library's own access control, and it is
   * what an anonymous reader hits.
   *
   * Cascades as a `delta`, and goes through `postPageSecurity` rather than
   * `putPageSecurity` to do it. A PUT replaces the grant list wholesale, and
   * under `cascade: "absolute"` it does that to every descendant too, so a
   * chapter with its own author or a page a TA manages would lose that grant
   * the moment someone published the book. The POST form applies the document
   * as a change instead: the only thing in it is the restriction, so the book
   * opens up all the way down and every existing grant, at every level, stays
   * exactly where it was.
   */
  public async setBookPublic(
    project: ProjectInterfaceRaw,
    actorUUID: string
  ): Promise<void> {
    const { libreLibrary, libreCoverID, projectID } = project;
    if (!libreLibrary || !libreCoverID) {
      throw new PublishStepError(
        "This project is not linked to a library book, so there is nothing to publish."
      );
    }

    await this.runStep(projectID, "security", actorUUID, async () => {
      const expert = await ExpertWithSSM.getInstance().forLibrary(libreLibrary);

      const body = `<security><permissions.page><restriction>${PUBLIC_RESTRICTION}</restriction></permissions.page></security>`;

      publishLog.debug(
        { projectID, libreLibrary, libreCoverID },
        "Setting book public on library"
      );

      try {
        await expert.pages.postPageSecurity(libreCoverID, body, {
          cascade: "delta",
        });
      } catch (err) {
        // The bot needs ADMIN on the page to rewrite security; without it the
        // API answers 403 and nothing else in the flow will explain why.
        if (PublishService.httpStatusOf(err) === 403) {
          throw new PublishStepError(
            "The library account does not have admin access to this book, so its visibility cannot be changed.",
            400
          );
        }
        throw err;
      }

      await this.markSucceeded(projectID, "security");
      publishLog.info({ projectID }, "Book set public on library");
    });
  }

  /**
   * Step 3 — move the book's coverpage, and with it every subpage, to its
   * final location on the library.
   *
   * A MindTouch move preserves the page ID, so `bookID` survives and anything
   * keyed on the coverpage ID keeps resolving. What does go stale is the
   * project's path-based `projectURL` and the Commons record's path, both
   * refreshed here. Technically, MindTouch will redirect the old path to the new one,
   * but the project/catalog should be honest.
   */
  public async moveBook(
    project: ProjectInterfaceRaw,
    destinationPath: string,
    actorUUID: string
  ): Promise<string> {
    const { libreLibrary, libreCoverID, projectID } = project;
    if (!libreLibrary || !libreCoverID) {
      throw new PublishStepError(
        "This project is not linked to a library book, so there is nothing to move."
      );
    }

    return this.runStep(projectID, "move", actorUUID, async () => {
      const expert = await ExpertWithSSM.getInstance().forLibrary(libreLibrary);
      try {
        // The SDK applies the double encoding Deki wants, so `to` is a plain
        // path. Subpages come along with the coverpage.
        await expert.pages.postPageMove(libreCoverID, { to: destinationPath });
      } catch (err) {
        // A taken path is the failure people actually hit, and reads as a
        // mistake to correct rather than a system fault.
        if (PublishService.httpStatusOf(err) === 409) {
          throw new PublishStepError(
            `A page already exists at "${destinationPath}". Choose a different destination.`,
            409
          );
        }
        throw err;
      }

      const newURL = `https://${libreLibrary}.libretexts.org/${destinationPath}`;
      await Project.updateOne(
        { projectID: { $eq: projectID } },
        { $set: { projectURL: newURL } }
      );

      await this.markSucceeded(projectID, "move", { detail: destinationPath });

      // Refreshing Commons keeps the catalog's path honest, but a book that
      // moved successfully has moved whether or not the catalog caught up.
      const bookID = `${libreLibrary}-${libreCoverID}`;
      syncSingleBook(bookID).catch((err) => {
        publishLog.warn(
          { err, bookID },
          "Commons re-sync after move failed; catalog path may be stale"
        );
      });

      publishLog.info({ projectID, destinationPath }, "Book moved");
      return destinationPath;
    });
  }

  /** Step 4 — make the project visible on the Commons. */
  public async setVisibilityPublic(
    project: ProjectInterfaceRaw,
    actorUUID: string
  ): Promise<void> {
    await this.runStep(project.projectID, "visibility", actorUUID, async () => {
      await Project.updateOne(
        { projectID: { $eq: project.projectID } },
        { $set: { visibility: "public" } }
      );
      await this.markSucceeded(project.projectID, "visibility");
      publishLog.info({ projectID: project.projectID }, "Project set public");
    });
  }

  /**
   * Step 5 — hand the book to Shapeshift.
   *
   * Left `running` on submission; the compile's own webhook is what marks the
   * book compiled, and {@link getStatus} reads the job back.
   */
  public async submitCompile(
    project: ProjectInterfaceRaw,
    actorUUID: string
  ): Promise<string> {
    const { libreLibrary, libreCoverID, projectID } = project;
    if (!libreLibrary || !libreCoverID) {
      throw new PublishStepError(
        "This project is not linked to a library book, so it cannot be compiled."
      );
    }
    const bookID = `${libreLibrary}-${libreCoverID}`;

    return this.runStep(projectID, "compile", actorUUID, async () => {
      const result = await submitCompileForBook(project, bookID, actorUUID);
      if (!result.ok) {
        throw result.status === 500
          ? new Error(result.errMsg)
          : new PublishStepError(result.errMsg, result.status);
      }
      await this.writeStep(projectID, "compile", { jobID: result.jobId });
      publishLog.info({ projectID, jobID: result.jobId }, "Compile submitted");
      return result.jobId;
    });
  }

  /**
   * The persisted step record, reconciled against the systems that actually own
   * each step's outcome.
   *
   * Two of the four steps hand work to something else and cannot know when it
   * finished, so a stored `running` is a claim, not a fact. Reading the bot run
   * and the Shapeshift job back here is what keeps a reloaded drawer honest.
   */
  public async getStatus(project: ProjectInterfaceRaw): Promise<PublishStatus> {
    const { libreLibrary, libreCoverID } = project;
    const bookID =
      libreLibrary && libreCoverID ? `${libreLibrary}-${libreCoverID}` : null;

    const steps = STEP_KEYS.reduce(
      (acc, key) => {
        acc[key] = project.publishing?.[key] ?? { ...NOT_STARTED };
        return acc;
      },
      {} as Record<PublishStepKey, PublishStepState>
    );

    // Visibility is never a claim — the project either is public or is not.
    // Persisted, not just reported, so the button's `isProjectPublished` read of
    // the stored record agrees with what the drawer shows.
    if (
      project.visibility === "public" &&
      steps.visibility.status !== "succeeded"
    ) {
      steps.visibility = { ...steps.visibility, status: "succeeded" };
      await this.markSucceeded(project.projectID, "visibility");
    }

    let preprocessPercentage: number | undefined;
    if (steps.preprocess.status === "running" && steps.preprocess.jobID) {
      const run = await BookBotRun.findOne({
        jobID: { $eq: steps.preprocess.jobID },
      }).lean();
      if (run) {
        preprocessPercentage = run.percentage;
        if (run.state === "done") {
          steps.preprocess = {
            ...steps.preprocess,
            status: "succeeded",
            finishedAt: run.endedAt,
          };
          await this.markSucceeded(project.projectID, "preprocess", {
            finishedAt: run.endedAt ?? new Date(),
          });
        } else if (run.state === "error") {
          const errorMessage = run.errorMessage ?? "The preprocess run failed.";
          steps.preprocess = {
            ...steps.preprocess,
            status: "failed",
            finishedAt: run.endedAt,
            errorMessage,
          };
          await this.writeStep(project.projectID, "preprocess", {
            status: "failed",
            finishedAt: run.endedAt ?? new Date(),
            errorMessage,
          });
        }
      }
    }

    if (steps.compile.status === "running" && steps.compile.jobID) {
      const job = await this.getCompileJob(steps.compile.jobID);
      if (job?.status === "finished") {
        steps.compile = { ...steps.compile, status: "succeeded" };
        await this.markSucceeded(project.projectID, "compile");
      } else if (job?.status === "failed") {
        steps.compile = {
          ...steps.compile,
          status: "failed",
          errorMessage: "The compile job failed.",
        };
        await this.writeStep(project.projectID, "compile", {
          status: "failed",
          finishedAt: new Date(),
          errorMessage: "The compile job failed.",
        });
      }
    }

    const live =
      libreLibrary && libreCoverID
        ? await this.getLivePageState(libreLibrary, libreCoverID)
        : { path: null, restriction: null };

    // Like visibility, the library's restriction is a fact rather than a claim:
    // a book somebody made public by hand is public whether or not the step ran.
    if (
      live.restriction === PUBLIC_RESTRICTION &&
      steps.security.status !== "succeeded"
    ) {
      steps.security = { ...steps.security, status: "succeeded" };
      await this.markSucceeded(project.projectID, "security");
    }

    return {
      bookID,
      library: libreLibrary ?? null,
      coverID: libreCoverID ?? null,
      currentPath: live.path,
      restriction: live.restriction,
      visibility: project.visibility,
      steps,
      preprocessPercentage,
      isPublished: STEP_KEYS.every((k) => steps[k].status === "succeeded"),
    };
  }

  private async getCompileJob(jobID: string): Promise<ShapeshiftJob | null> {
    try {
      return await new ShapeshiftService().getJob(jobID);
    } catch (err) {
      publishLog.warn({ err, jobID }, "Could not read compile job");
      return null;
    }
  }

  /**
   * The coverpage's live path and restriction.
   *
   * One `getPage` call answers both "where does this book actually sit" and
   * "can an anonymous reader open it", so the drawer reports the library's own
   * state rather than only what a past step claimed.
   */
  private async getLivePageState(
    library: string,
    coverID: string
  ): Promise<{ path: string | null; restriction: string | null }> {
    try {
      const expert = await ExpertWithSSM.getInstance().forLibrary(library);
      const page = await expert.pages.getPage(coverID);
      // Deki collapses an empty element to `""`, so each level is checked
      // before it is indexed rather than optional-chained through.
      const security = page.security || undefined;
      const pagePermissions = security?.["permissions.page"] || undefined;
      return {
        path: (page.path || undefined)?.["#text"] ?? null,
        restriction: text(pagePermissions?.restriction || undefined) ?? null,
      };
    } catch (err) {
      publishLog.warn(
        { err, library, coverID },
        "Could not read live coverpage state"
      );
      return { path: null, restriction: null };
    }
  }

  /**
   * Undoes the single layer of percent-encoding MindTouch puts on `uri.ui`.
   *
   * A shelf titled `Book: Introductory Chemistry` comes back as
   * `Book%3A_Introductory_Chemistry`. Left encoded, `CXOneFetch` double-encodes
   * it to `%253A` and the subpage lookup 404s, and a move writes a page whose
   * title literally contains `%3A`. `remixer-service` decodes the same field
   * for the same reason.
   */
  private static decodePath(path: string): string {
    try {
      return decodeURIComponent(path);
    } catch {
      // A stray `%` that is not a valid escape throws. The raw path is still
      // more useful than dropping the entry from the picker.
      return path;
    }
  }

  /**
   * Children of `path` on `library`, for the destination picker.
   *
   * With no `path`, returns the library's configured sync roots — the same
   * `Bookshelves` / `Courses` set the Commons walk uses, so the picker can only
   * ever point at somewhere Commons will find the book afterwards.
   */
  public async listDestinations(
    library: string,
    path?: string
  ): Promise<PublishDestination[]> {
    if (!path) {
      const roots = await new LibraryService().getSyncLocations(library);
      return (roots ?? []).map((root) => ({
        title: root.replace(/_/g, " "),
        path: root,
        hasChildren: true,
      }));
    }

    const res = await CXOneFetch({
      scope: "page",
      path,
      api: MindTouch.API.Page.GET_Subpages,
      subdomain: library,
      silentFail: true,
    });
    if (!res.ok) {
      throw new Error(
        `Could not list "${path}" on ${library}: ${res.status} ${res.statusText}`
      );
    }

    const data = await res.json();
    // MindTouch returns a bare object for a single subpage and an array for
    // several, so both shapes have to be handled.
    const raw = data?.["page.subpage"];
    const subpages: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

    return subpages
      .map((sub) => {
        const uri: string = sub?.["uri.ui"] ?? "";
        const relative = PublishService.decodePath(
          uri
            .replace(
              new RegExp(`^https?://${library}\\.libretexts\\.org/`, "i"),
              ""
            )
            .replace(/^\/+/, "")
        );
        return {
          title: String(sub?.title ?? sub?.["@title"] ?? relative),
          path: relative,
          hasChildren: String(sub?.["@subpages"]) === "true",
        };
      })
      .filter((d) => d.path.length > 0)
      .sort((a, b) => a.title.localeCompare(b.title));
  }
}
