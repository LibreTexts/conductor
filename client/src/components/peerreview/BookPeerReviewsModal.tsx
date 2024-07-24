import { useQuery } from "@tanstack/react-query";
import { Button, Icon, List, Modal, ModalProps } from "semantic-ui-react";
import { PeerReview } from "../../types";
import api from "../../api";
import useGlobalError from "../error/ErrorHooks";
import { getPeerReviewAuthorText } from "../util/ProjectHelpers";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import PeerReviewView from "./PeerReviewView";
import LoadingSpinner from "../LoadingSpinner";

interface BookPeerReviewsModalProps extends ModalProps {
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
  ...rest
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
    <Modal open={open} onClose={onClose} size="fullscreen" {...rest}>
      <Modal.Header>
        Peer Reviews for <em>{bookTitle}</em>
      </Modal.Header>
      <Modal.Content>
        {isFetching && <LoadingSpinner />}
        {!isFetching && (
          <>
            {data && data?.length > 0 ? (
              <List divided>
                {data.map((item) => {
                  let itemDate;
                  if (item.createdAt) {
                    itemDate = format(new Date(item.createdAt), "MM/dd/yyyy");
                  }
                  return (
                    <List.Item key={item.peerReviewID}>
                      <div className="flex-row-div mt-05p mb-05p">
                        <div className="left-flex">
                          <div className="flex-col-div">
                            <span className="project-peerreview-title">
                              {item.author || "Unknown Reviewer"}
                            </span>
                            <span className="project-peerreview-detail muted-text">
                              <em>
                                {getPeerReviewAuthorText(item.authorType)}
                              </em>{" "}
                              <>&#8226;</>{" "}
                              {item.createdAt &&
                                format(parseISO(item.createdAt), "MM/dd/yyyy")}
                            </span>
                          </div>
                        </div>
                        <div className="right-flex">
                          <Button
                            color="blue"
                            onClick={() => handleOpenPeerReview(item)}
                          >
                            <Icon name="eye" /> View
                          </Button>
                        </div>
                      </div>
                    </List.Item>
                  );
                })}
              </List>
            ) : (
              <p className="muted-text mt-2p mb-2p">No reviews found.</p>
            )}
          </>
        )}
      </Modal.Content>
      <Modal.Actions>
        <Button color="blue" onClick={onClose}>
          Done
        </Button>
      </Modal.Actions>
      <PeerReviewView
        open={openView}
        onClose={handleClosePeerReview}
        peerReviewData={selectedReview}
        publicView={true}
      />
    </Modal>
  );
};

export default BookPeerReviewsModal;
