import { useTypedSelector } from "../state/hooks";
import useH5PAuthoringEnabled from "./useH5PAuthoringEnabled";

/**
 * Whether the signed-in user may create H5P activities: authoring is open on
 * this deployment and they are a verified instructor. The server enforces the
 * same rule. Editing an activity someone shares with you needs only
 * `useH5PAuthoringEnabled`.
 */
export default function useCanCreateActivities(): boolean {
  const authoringEnabled = useH5PAuthoringEnabled();
  const verified = useTypedSelector((state) => state.user.verifiedInstructor);
  return authoringEnabled && verified === true;
}
