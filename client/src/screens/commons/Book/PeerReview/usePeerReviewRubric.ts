import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import type { PeerReviewRubric } from "../../../../types";

export function usePeerReviewRubric(projectID: string | undefined) {
  return useQuery({
    queryKey: ["pr-rubric", projectID],
    queryFn: async () => {
      if (!projectID) throw new Error("No project ID available.");
      const res = await api.getProjectPeerReviewRubric(projectID);
      if (res.data.err) throw new Error(res.data.errMsg ?? "Unable to load rubric.");
      return res.data.rubric as PeerReviewRubric;
    },
    enabled: !!projectID,
    meta: { errorMessage: "" },
    retry: false,
  });
}
