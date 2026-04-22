import Project from "../models/project";

export const slugifyNode =(title:string): string =>{
 
    const cleaned = title
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_\-]/g, "");
    return cleaned.length > 0 ? cleaned : "Section";
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