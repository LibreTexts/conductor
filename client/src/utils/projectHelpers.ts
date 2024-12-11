import axios from "axios";
import { Project } from "../types";

/**
 * Submits a request to the server to pin a project. Closes the modal on success.
 *
 * @param {string} projectID - Identifier of the project to pin.
 * @returns {Promise<boolean>} True if successfully pinned, false otherwise.
 */
export async function pinProject(projectID: string) {
  try {
    if (!projectID) return false;
    const pinRes = await axios.put("/project/pin", {
      projectID,
    });
    if (pinRes.data.err) {
      throw new Error(pinRes.data.errMsg);
    }
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

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