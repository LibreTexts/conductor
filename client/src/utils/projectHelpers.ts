import axios from "axios";
import useGlobalError from "../components/error/ErrorHooks";

/**
 * Submits a request to the server to pin a project. Closes the modal on success.
 *
 * @param {string} projectID - Identifier of the project to pin.
 * @returns {Promise<boolean>} True if successfully pinned, false otherwise.
 */
export async function pinProject(projectID: string) {
  const { handleGlobalError } = useGlobalError();
  if (!projectID) return false;
  try {
    const pinRes = await axios.put("/project/pin", {
      projectID,
    });
    if (pinRes.data.err) {
      throw new Error(pinRes.data.errMsg);
    }
    return true;
  } catch (e) {
    handleGlobalError(e);
    return false;
  }
}
