import Project from "../models/project";

export const slugifyNode =(title:string): string =>{
 
    const cleaned = title
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "");
    return cleaned.length > 0 ? cleaned : "Section";
  }

const stripLeadingNumbering = (value: string): string =>
  value.replace(/^\s*\d+(?:\.\d+)*\s*[:.\-]\s*/, "").trim();

const stripDefaultTitlePrefixBeforeColon = (value: string): string => {
  for (
    let index = value.lastIndexOf(":");
    index >= 0;
    index = value.lastIndexOf(":", index - 1)
  ) {
    const remainder = value.slice(index + 1);
    if (remainder.trim().length > 0) {
      return remainder.trim();
    }
  }
  return value.trim();
};

/** LibreTexts-style title slug for a path segment (e.g. `New Page` → `New_Page`). */
export const titleToRemixerPathSegment = (title: string): string => {
  const cleaned = stripDefaultTitlePrefixBeforeColon(stripLeadingNumbering(title))
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_\-()]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return cleaned.length > 0 ? cleaned : "Section";
};

type RemixerPathNumbering = {
  formattedPath?: string;
  numberedPath?: string;
};

/**
 * MindTouch path leaf matching Workbench URLs such as `3.04%3A_New_Page`
 * (`3.04:_New_Page` before URL encoding).
 */
export const buildRemixerPagePathSegment = (
  page: RemixerPathNumbering,
  rawTitle: string,
  siblingTitleIndex: number|undefined,
): string => {
  const titleSegment = titleToRemixerPathSegment(rawTitle);
  const siblingTitleIndexPostfix = siblingTitleIndex  ? `_${siblingTitleIndex.toString()}` : "";
  const numbering =
    page.formattedPath?.trim() || page.numberedPath?.trim() || "";
  return numbering ? `${numbering.padStart(2, "0")}:_${titleSegment}${siblingTitleIndexPostfix}` : titleSegment;
}
export const generatePagePath = (parent: string, title: string): string => {
  const slug = slugifyNode(title);
  return encodeURIComponent(`${parent}/${slug}`);
}

export const extractPagePath = (pagePath: string): string => {
  const withoutHost = pagePath.replace(
    /^https?:\/\/[^/]*libretexts\.org\//i,
    "",
  );
  return withoutHost.replace(/\/+$/, "");
};

/** Subdomain label from a LibreTexts page URL (e.g. dev from https://dev.libretexts.org/...). */
export const extractLibretextsSubdomain = (uri: string): string | null => {
  const m = uri.trim().match(/^https?:\/\/([^.]+)\.libretexts\.org/i);
  return m?.[1] ?? null;
};


export const getUserWorkbenchProjects = async (subdomain: string, userId: string): Promise<string[]> => {
  const projects = await Project.find({
    $or: [
      { leads: userId },
      { liaisons: userId },
      { members: userId },
      { auditors: userId },
    ],
    didCreateWorkbench: true,
    libreCoverID: { $exists: true, $ne: "" },
    libreLibrary: subdomain,
  }).lean();

  return projects.map((project) => project.libreCoverID);
}