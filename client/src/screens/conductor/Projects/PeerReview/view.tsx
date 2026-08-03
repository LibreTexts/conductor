import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDocumentTitle } from "usehooks-ts";
import { Button, Heading } from "@libretexts/davis-react";
import api from "../../../../api";
import PeerReviewDisplay from "../../../../components/peerreview/PeerReviewDisplay";

/**
 * Standalone view of a submitted Peer Review, launched from the Peer Review
 * list (`/projects/:id/peerreview/:peerReviewID`) via the "eye" button.
 */
const ProjectPeerReviewViewPage = () => {
  useDocumentTitle("LibreTexts | Peer Review");
  const { id, peerReviewID } = useParams<{ id: string; peerReviewID: string }>();
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

  const backToListPath = `/projects/${id}/peerreview`;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Heading level={1} className="mb-1">
              Peer Review
            </Heading>
            {project?.title && (
              <p className="text-gray-600">
                <em>{project.title}</em>
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => history.push(backToListPath)}>
            Back to Peer Reviews
          </Button>
        </div>

        <PeerReviewDisplay peerReviewID={peerReviewID} publicView={false} />

        <div className="flex justify-end pt-6">
          <Button onClick={() => history.push(backToListPath)}>Done</Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectPeerReviewViewPage;
