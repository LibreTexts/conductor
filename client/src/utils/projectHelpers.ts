import axios from "axios";

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

export function buildWorbenchURL(libreLibrary: string, libreCoverID: string) {
  return `https://${libreLibrary}.libretexts.org/@go/page/${libreCoverID}`;
}