import { useMutation } from "@tanstack/react-query";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";

export function useSubmitPeerReview({ onSuccess }: { onSuccess: () => void }) {
  const { handleGlobalError } = useGlobalError();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.submitPeerReview(payload),
    onSuccess: (res) => {
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      onSuccess();
    },
    onError: (err) => handleGlobalError(err),
  });
}
