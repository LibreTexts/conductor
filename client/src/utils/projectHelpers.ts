import { Project, PUBLISH_STEP_ORDER } from "../types";

export function buildLibraryPageGoURL(libreLibrary: string, libreCoverID: string) {
  return `https://${libreLibrary}.libretexts.org/@go/page/${libreCoverID}`;
}

export function buildRemixerURL(libreLibrary: string, remixURL: string) {
  const queryParams = new URLSearchParams();
  if (remixURL) {
    queryParams.set('remixURL', remixURL);
    queryParams.set('autoLoad', 'true');
  }
  const queryString = queryParams.toString();
  return `https://${libreLibrary}.libretexts.org/Under_Construction/Development_Details/OER_Remixer${queryString ? `?${queryString}` : ''}`;
}

export function buildCommonsUrl(libreLibrary: string, libreCoverID: string) {
  return `/book/${libreLibrary}-${libreCoverID}`;
}

export const DEFAULT_PROJECT_MODULES: NonNullable<Project['projectModules']> = {
  discussion: {
    enabled: true,
    order: 1,
  },
  files: {
    enabled: true,
    order: 2,
  },
  tasks: {
    enabled: true,
    order: 3,
  },
}
/**
 * Whether every step of the publishing flow has succeeded for this project.
 *
 * Reads `project.publishing`, which arrives with the project itself, so callers
 * that only need the yes/no answer do not have to fetch publishing status.
 */
export function isProjectPublished(
  project?: Pick<Project, "publishing"> | null,
): boolean {
  const steps = project?.publishing;
  if (!steps) return false;
  return PUBLISH_STEP_ORDER.every((key) => steps[key]?.status === "succeeded");
}
