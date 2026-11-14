import { useMutation } from "@tanstack/react-query";
import { useHistory } from "react-router-dom";
import api from "../api";
import useGlobalError from "../components/error/ErrorHooks";

/**
 * @param redirectPath Where to navigate after a successful submission (e.g.
 * `/book/{bookID}` from Commons, `/projects/{id}/peerreview` from Conductor).
 */
export function useSubmitPeerReview(redirectPath: string) {
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.submitPeerReview(payload),
    onSuccess: (res) => {
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      history.push(redirectPath);
    },
    onError: (err) => handleGlobalError(err),
  });
}
