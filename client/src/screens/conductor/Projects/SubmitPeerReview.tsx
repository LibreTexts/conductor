import { useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@libretexts/davis-react";
import api from "../../../api";
import PeerReviewForm from "../../../components/peerreview/PeerReviewForm";

/**
 * Conductor-side entry point for PeerReviewForm — already has the projectID
 * from the route, so unlike the Commons book flow, there's no bookID to
 * resolve first.
 */
const SubmitPeerReviewPage = () => {
  const { id: projectID } = useParams<{ id: string }>();
  const history = useHistory();

  const projectViewPath = `/projects/${projectID}/peerreview`;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-basic", projectID],
    queryFn: async () => {
      const res = await api.getProject(projectID);
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data.project;
    },
    enabled: !!projectID,
  });

  useEffect(() => {
    document.title = "LibreTexts Conductor | Submit Peer Review";
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-6">
        <Spinner />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <PeerReviewForm
        projectID={projectID}
        resourceTitle={project?.title}
        isPublicView={project?.visibility === "public" && project?.allowAnonPR !== false}
        redirectPath={projectViewPath}
        onCancel={() => history.push(projectViewPath)}
      />
    </div>
  );
};

export default SubmitPeerReviewPage;
