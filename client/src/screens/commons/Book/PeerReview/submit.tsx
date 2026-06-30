import { useEffect } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Spinner } from "@libretexts/davis-react";
import { useTypedSelector } from "../../../../state/hooks";
import api from "../../../../api";
import PeerReviewForm from "../../../../components/peerreview/PeerReviewForm";
import { useDocumentTitle } from "usehooks-ts";

const PeerReviewSubmitPage = () => {
  useDocumentTitle("LibreTexts | Submit Peer Review");
  const { bookID } = useParams<{ bookID: string }>();
  const history = useHistory();
  const user = useTypedSelector((state) => state.user);

  const { data: book, isLoading: loadingBook, error: bookError } = useQuery({
    queryKey: ["pr-book", bookID],
    queryFn: async () => {
      const res = await api.getBookDetail(bookID);
      if (res.data.err) throw new Error(res.data.errMsg ?? "Unable to load book.");
      if (!res.data.book) throw new Error("Unable to load book.");
      return res.data.book as {
        projectID?: string;
        title?: string;
        allowAnonPR?: boolean;
      };
    },
    enabled: !!bookID,
    // Errors are surfaced inline — suppress the global QueryCache toast.
    meta: { errorMessage: "" },
    retry: false,
  });

  useEffect(() => {
    // wait for both book and user to populate before continuing check
    if (!book) return;
    if (!user) return;

    /**
     * If the book doesn't allow anonymous peer reviews and the user isn't logged in,
     * redirect back to Commons book page.
     * */
    if (!book.allowAnonPR && !user.isAuthenticated) {
      history.replace(`/book/${bookID}`);
    }
  }, [book, user]);

  if (loadingBook) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="flex items-center gap-3">
            <Spinner />
            <span>Loading peer review form...</span>
          </div>
        </div>
      </div>
    );
  }

  if (bookError instanceof Error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Alert
            variant="error"
            message={bookError.message || "Unable to load book details."}
          />
        </div>
      </div>
    );
  }

  if (!book?.projectID) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <Alert
            variant="warning"
            message="This book does not have a peer review rubric configured."
          />
        </div>
      </div>
    );
  }

  return (
    <PeerReviewForm
      projectID={book.projectID}
      resourceTitle={book.title}
      showAnonFields
      isPublicView={!!book.allowAnonPR}
      onCancel={() => history.push(`/book/${bookID}`)}
      onSuccess={() => history.push(`/book/${bookID}`)}
    />
  );
};

export default PeerReviewSubmitPage;
