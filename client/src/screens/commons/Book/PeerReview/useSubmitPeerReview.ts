import { useMutation } from "@tanstack/react-query";
import { useHistory } from "react-router-dom";
import api from "../../../../api";
import useGlobalError from "../../../../components/error/ErrorHooks";

export function useSubmitPeerReview(bookID: string) {
  const history = useHistory();
  const { handleGlobalError } = useGlobalError();

  return useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.submitPeerReview(payload),
    onSuccess: (res) => {
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
        return;
      }
      history.push(`/book/${bookID}`);
    },
    onError: (err) => handleGlobalError(err),
  });
}
