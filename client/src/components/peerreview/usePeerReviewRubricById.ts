import { useQuery } from "@tanstack/react-query";
import api from "../../api";
import type { PeerReviewRubric } from "../../types";

export function usePeerReviewRubricById(rubricID: string | undefined) {
  return useQuery({
    queryKey: ["pr-rubric-by-id", rubricID],
    queryFn: async () => {
      if (!rubricID) throw new Error("No Rubric ID available.");
      const res = await api.getPeerReviewRubric(rubricID);
      if (res.data.err) throw new Error(res.data.errMsg ?? "Unable to load rubric.");
      return res.data.rubric as PeerReviewRubric;
    },
    enabled: !!rubricID,
    meta: { errorMessage: "" },
    retry: false,
  });
}
