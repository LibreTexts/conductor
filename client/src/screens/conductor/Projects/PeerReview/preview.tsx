import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "usehooks-ts";
import api from "../../../../api";
import PeerReviewRubricPreview from "../../../../components/peerreview/PeerReviewRubricPreview";

/**
 * Standalone preview of a Peer Review rubric, launched from a project's Peer
 * Review Settings (`/projects/:id/preview-peer-review/:rubricID`), so a
 * campus admin can see a candidate rubric before setting it as preferred.
 */
const ProjectPeerReviewPreviewPage = () => {
  useDocumentTitle("LibreTexts | Preview Peer Review Rubric");
  const { id, rubricID } = useParams<{ id: string; rubricID: string }>();
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
    <PeerReviewRubricPreview
      rubricID={rubricID}
      resourceTitle={project?.title}
      onDone={() => history.push(`/projects/${id}/peerreview?returnTo=settings`)}
    />
  );
};

export default ProjectPeerReviewPreviewPage;
