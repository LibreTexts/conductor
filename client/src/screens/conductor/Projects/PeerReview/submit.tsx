import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../../../api";
import PeerReviewForm from "../../../../components/peerreview/PeerReviewForm";
import { useDocumentTitle } from "usehooks-ts";

/**
 * Authenticated peer review submission page for a project
 * (`/projects/:id/submit-peer-review`). Auth is guaranteed by the surrounding
 * PrivateRoute, so no anonymous handling is needed here.
 */
const ProjectPeerReviewSubmitPage = () => {
  useDocumentTitle("LibreTexts | Submit Peer Review");
  const { id } = useParams<{ id: string }>();
  const history = useHistory();

  const { data: project } = useQuery({
    queryKey: ["pr-project", id],
    queryFn: async () => {
      const res = await api.getProject(id);
      if (res.data.err) throw new Error(res.data.errMsg ?? "Unable to load project.");
      return res.data.project;
    },
    enabled: !!id,
    // Title is cosmetic — suppress the global QueryCache toast.
    meta: { errorMessage: "" },
    retry: false,
  });

  return (
    <PeerReviewForm
      projectID={id}
      resourceTitle={project?.title}
      onCancel={() => history.push(`/projects/${id}/peerreview`)}
      onSuccess={() => history.push(`/projects/${id}/peerreview`)}
    />
  );
};

export default ProjectPeerReviewSubmitPage;
