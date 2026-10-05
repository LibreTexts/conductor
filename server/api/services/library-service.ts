import logger, { childLogger } from "../../logger.js";
import Library from "../../models/library.js";
import { CXOneFetch } from "../../util/librariesclient.js";
import MindTouch from "../../util/CXOne/index.js";

const shelfSearchLog = childLogger("shelf-search");

/**
 * Strips leading and trailing slashes from a path.
 *
 * Scanned rather than matched with `/^\/+|\/+$/`: that pattern backtracks on a
 * long run of slashes, retrying the trailing alternative from every position, so
 * a caller-supplied `"//////…"` costs quadratic time. The validator caps the path
 * at 500 characters, but a linear scan removes the question entirely.
 */
const trimSlashes = (value: string): string => {
    let start = 0;
    let end = value.length;
    while (start < end && value[start] === "/") start += 1;
    while (end > start && value[end - 1] === "/") end -= 1;
    return value.slice(start, end);
};

/**
 * A shelf (or other container page) in a library, as the Collections Manager's
 * shelf picker consumes it.
 *
 * `path` is library-relative and decoded, matching the `shelfPath` stored on
 * Books; `hasChildren` tells the picker whether the node can be expanded.
 */
export type LibraryShelf = {
  title: string;
  path: string;
  hasChildren: boolean;
};

export default class LibraryService {

    /**
     * Fetches the guide tab template for a given library subdomain and template key.
     * A template is an JSON string literal that MindTouch/CXOne uses to render the guide tab content. The template is stored in the library's `guideTabTemplates` field.
     * The `guid` of the templates (even if the same key is used) can change across libraries, so the template is stored in the library's `guideTabTemplates` field.
     * @param subdomain - The subdomain of the library for which to fetch the guide tab template.
     * @param templateKey - The key of the guide tab template to fetch (e.g. "Topic_hierarchy")
     * @returns A promise that resolves to the guide tab template string if found, or undefined if not found or if an error occurs.
     */
    public async getGuideTabTemplate(subdomain: string, templateKey: string): Promise<string | undefined> {
        try {
            const library = await Library.findOne({ subdomain: { $eq: subdomain } }).lean();
            if (!library) {
                logger.warn(`Library not found for subdomain: ${subdomain}`);
                return undefined;
            }

            if (!library.guideTabTemplates) {
                logger.warn(`No guide tab templates found for library with subdomain: ${subdomain}`);
                return undefined;
            }

            const template = library.guideTabTemplates[templateKey];
            if (!template) {
                logger.warn(`Guide tab template not found for subdomain: ${subdomain}, templateKey: ${templateKey}`);
                return undefined;
            }

            return template;
        } catch (error) {
            logger.error({ err: error }, `Error fetching guide tab template for subdomain: ${subdomain}, templateKey: ${templateKey}`);
            return undefined;
        }
    }

    /**
     * Fetches the sync locations for a given library subdomain.
     * @param subdomain - The subdomain of the library for which to fetch the sync locations.
     * @returns A promise that resolves to an array of sync locations if found, or undefined if not found or if an error occurs.
     */
    public async getSyncLocations(subdomain: string): Promise<string[] | undefined> {
        try {
            const library = await Library.findOne({ subdomain: { $eq: subdomain } }).lean();
            if (!library) {
                logger.warn(`Library not found for subdomain: ${subdomain}`);
                return undefined;
            }
            return library.syncLocations;
        } catch (error) {
            logger.error({ err: error }, `Error fetching sync locations for subdomain: ${subdomain}`);
            return undefined;
        }
    }

    /**
     * A library path decoded for display and for matching against Books.
     *
     * CXOne returns segments like `Book%3A_Introductory_Chemistry`; a stray `%`
     * that is not a valid escape throws, in which case the raw path is still
     * more useful than dropping the entry from the picker.
     */
    private static decodePath(path: string): string {
        try {
            return decodeURIComponent(path);
        } catch {
            return path;
        }
    }

    /**
     * The library-relative path from a CXOne `uri.ui` absolute URL.
     *
     * Parsed rather than matched against `^https?://${subdomain}\.libretexts\.org/`:
     * interpolating the caller's subdomain into a pattern lets a `.` or a `(`
     * change what the expression means, and the URL parser answers the same
     * question without building a pattern at all. A relative or malformed value
     * is used as-is, since a path is still more useful to the picker than a
     * dropped entry.
     */
    private static toLibraryRelativePath(uri: string): string {
        try {
            return trimSlashes(new URL(uri).pathname);
        } catch {
            return trimSlashes(uri);
        }
    }

    /**
     * Lists the children of `path` on `subdomain`, for the shelf picker.
     *
     * With no `path`, returns the library's configured sync roots — the same
     * `Bookshelves` / `Courses` set the Commons walk searches, so a shelf chosen
     * here can only ever point somewhere Commons actually looks for books.
     *
     * @throws If the library cannot be listed, so the caller can answer with a
     *  real failure rather than an empty tree the admin would read as "no shelves".
     */
    public async listShelves(subdomain: string, path?: string): Promise<LibraryShelf[]> {
        if (!path) {
            const roots = await this.getSyncLocations(subdomain);
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
            subdomain,
            silentFail: true,
        });
        if (!res.ok) {
            throw new Error(
                `Could not list "${path}" on ${subdomain}: ${res.status} ${res.statusText}`
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
                const relative = LibraryService.decodePath(
                    LibraryService.toLibraryRelativePath(uri)
                );
                return {
                    title: String(sub?.title ?? sub?.["@title"] ?? relative),
                    path: relative,
                    hasChildren: String(sub?.["@subpages"]) === "true",
                };
            })
            .filter((shelf) => shelf.path.length > 0)
            .sort((a, b) => a.title.localeCompare(b.title));
    }

    /**
     * Finds every library carrying the same shelf path.
     *
     * `Courses/Canada_College` exists in roughly sixteen libraries, and a campus
     * admin building a collection for that campus wants all sixteen. Walking the
     * picker tree sixteen times to find them is the thing this replaces.
     *
     * A library that doesn't have the path is simply absent from the result.
     * Espanol and Ukrayinska rarely carry a `Courses/<campus>` shelf, and
     * `Bookshelves/Aerospace_Engineering` exists in about one library — "missing"
     * is the normal case here, not an error worth showing an admin.
     *
     * Only non-hidden, sync-supported libraries are considered. A shelf in a
     * library the Commons walk never visits could never match a Book, so offering
     * it would add config that silently does nothing.
     *
     * @param path - Library-relative shelf path, e.g. `Courses/Canada_College`.
     * @returns The libraries that have it, and how many were checked.
     */
    public async findShelfAcrossLibraries(
        path: string
    ): Promise<{ matches: { library: string; path: string }[]; checked: number }> {
        const normalized = trimSlashes(path);
        if (!normalized) return { matches: [], checked: 0 };

        const root = normalized.split("/")[0];
        const libraries = await Library.find(
            { hidden: false, syncSupported: true },
            { subdomain: 1, syncLocations: 1, _id: 0 }
        ).lean<{ subdomain: string; syncLocations?: string[] }[]>();

        // A path outside a library's sync roots can't hold books Commons indexes,
        // and rejecting it here costs no request.
        const candidates = libraries.filter((library) =>
            (library.syncLocations ?? []).includes(root)
        );

        /* One request per library, fanned out rather than sequenced: these are
           ~30 distinct hosts answering one cheap `info` call each, not the long
           per-book loop against a single library that the request throttle
           exists for. Sequencing them would turn a click into half a minute. */
        const results = await Promise.allSettled(
            candidates.map(async (library) => {
                const res = await CXOneFetch({
                    scope: "page",
                    path: normalized,
                    api: MindTouch.API.Page.GET_Page_Info,
                    subdomain: library.subdomain,
                    silentFail: true,
                });
                return res.ok ? library.subdomain : null;
            })
        );

        const matches: { library: string; path: string }[] = [];
        results.forEach((result, index) => {
            const subdomain = candidates[index].subdomain;
            if (result.status === "rejected") {
                // An unreachable library is reported as "doesn't have it": the
                // admin's action still succeeds for every library that answered.
                shelfSearchLog.debug(
                    { err: result.reason, subdomain, path: normalized },
                    `Could not check "${normalized}" on ${subdomain}`
                );
                return;
            }
            if (result.value) matches.push({ library: result.value, path: normalized });
        });

        shelfSearchLog.info(
            {
                path: normalized,
                libraries: libraries.length,
                checked: candidates.length,
                matched: matches.length,
            },
            `"${normalized}" found in ${matches.length} of ${candidates.length} library(ies) checked`
        );

        return { matches, checked: candidates.length };
    }
}
