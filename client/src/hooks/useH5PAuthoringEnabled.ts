import useClientConfig from "./useClientConfig";

/**
 * Whether H5P authoring is open on this deployment: the My H5P nav link, New
 * H5P, Upload and Edit in My H5P, and the create/edit screen. Set per
 * environment with `CLIENT__H5P_AUTHORING_ENABLED`, because authoring opens in
 * staging well before production, which waits until Studio is frozen
 * (migration runbook, Stage 8). Off until the configuration says otherwise.
 */
export default function useH5PAuthoringEnabled(): boolean {
  const { clientConfig } = useClientConfig();
  return clientConfig?.h5p_authoring_enabled === true;
}
