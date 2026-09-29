import PropTypes from 'prop-types';
import { Modal, Button } from '@libretexts/davis-react';
import PeerReviewDisplay from './PeerReviewDisplay';

/**
 * Modal wrapper around PeerReviewDisplay, for contexts (e.g. Commons book
 * peer reviews) that don't have a dedicated page to navigate to.
 */
const PeerReviewView = ({
    peerReviewID,
    peerReviewData,
    open,
    onClose,
    publicView,
}) => (
    <Modal open={open} onClose={onClose} size="full">
        <Modal.Header>
            <Modal.Title>Peer Review</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
            <PeerReviewDisplay
                peerReviewID={peerReviewID}
                peerReviewData={peerReviewData || {}}
                active={open}
                publicView={publicView}
            />
        </Modal.Body>
        <Modal.Footer>
            <div className="flex justify-end">
                <Button onClick={onClose}>Done</Button>
            </div>
        </Modal.Footer>
    </Modal>
);

PeerReviewView.defaultProps = {
    peerReviewID: '',
    peerReviewData: {},
    open: false,
    onClose: () => {},
    publicView: true,
};

PeerReviewView.propTypes = {
    peerReviewID: PropTypes.string,
    peerReviewData: PropTypes.object,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    publicView: PropTypes.bool,
};

export default PeerReviewView;
