import { useQuery } from "@tanstack/react-query";
import { Modal, Button, Spinner } from "@libretexts/davis-react";
import { IconEye } from "@tabler/icons-react";
import { PeerReview } from "../../types";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";
import { getPeerReviewAuthorText } from "../util/ProjectHelpers";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import PeerReviewView from "./PeerReviewView";

interface BookPeerReviewsModalProps {
  open: boolean;
  onClose: () => void;
  bookID: string;
  bookTitle: string;
}

const BookPeerReviewsModal: React.FC<BookPeerReviewsModalProps> = ({
  open,
  onClose,
  bookID,
  bookTitle,
}) => {
  const [openView, setOpenView] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PeerReview | null>(null);
  const { handleGlobalError } = useGlobalError();

  const { data, isFetching } = useQuery<PeerReview[]>({
    queryKey: ["peer-reviews", bookID],
    queryFn: () => fetchPeerReviews(bookID),
    enabled: open && !!bookID,
    staleTime: 1000 * 60 * 5,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  async function fetchPeerReviews(bookID: string): Promise<PeerReview[]> {
    try {
      const res = await api.getBookPeerReviews(bookID);
      if (res.data.err) throw new Error(res.data.errMsg);
      return res.data?.reviews;
    } catch (err) {
      handleGlobalError(err);
      return [];
    }
  }

  function handleOpenPeerReview(item: PeerReview) {
    setSelectedReview(item);
    setOpenView(true);
  }

  function handleClosePeerReview() {
    setOpenView(false);
    setSelectedReview(null);
  }

  return (
    <>
      <Modal open={open} onClose={onClose} size="full">
        <Modal.Header>
          <Modal.Title>
            Peer Reviews for <em>{bookTitle}</em>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
          {isFetching && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}
          {!isFetching && (
            <>
              {data && data.length > 0 ? (
                <ul className="divide-y divide-gray-200">
                  {data.map((item) => (
                    <li key={item.peerReviewID} className="flex items-center justify-between py-3 gap-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {item.author || "Unknown Reviewer"}
                        </p>
                        <p className="text-sm text-gray-500">
                          <em>{getPeerReviewAuthorText(item.authorType)}</em>
                          {item.createdAt && (
                            <> &bull; {format(parseISO(item.createdAt), "MM/dd/yyyy")}</>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => handleOpenPeerReview(item)}
                      >
                        <IconEye size={16} className="mr-1" />
                        View
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-center text-gray-400 py-8">No reviews found.</p>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </Modal.Footer>
      </Modal>

      <PeerReviewView
        open={openView}
        onClose={handleClosePeerReview}
        peerReviewData={selectedReview}
        publicView={true}
      />
    </>
  );
};

export default BookPeerReviewsModal;
