import React, { useState } from 'react';
import axios from "axios";
import { Button, Checkbox, Icon, Modal, ModalProps } from "semantic-ui-react";
import useGlobalError from "../../error/ErrorHooks";
import { useNotifications } from "../../../context/NotificationContext";

interface UnpublishOrDeleteBookModalProps extends ModalProps {
    bookID: string;
    bookTitle: string;
    deleteMode: boolean;
    onClose: () => void;
    open: boolean;
}

export const UnpublishOrDeleteBookModal: React.FC<UnpublishOrDeleteBookModalProps> = ({
    bookID,
    bookTitle,
    deleteMode,
    onClose,
    open,
}) => {

    const { addNotification } = useNotifications();
    const { handleGlobalError } = useGlobalError();

    const [confirmCoverPage, setConfirmCoverPage] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    function handleClose() {
        setConfirmCoverPage(false);
        if (typeof onClose === 'function') {
            onClose();
        }
    }

    async function submitDeleteBook() {
        if (!confirmCoverPage) return;
        try {
            setIsLoading(true);
            const delRes = await axios.delete(`/commons/book/${bookID}`, {
                params: {
                    ...(deleteMode && { deleteProject: deleteMode }),
                },
            });
            setIsLoading(false);
            if (delRes.data.error) {
                handleGlobalError(delRes.data.errMsg);
                return;
            }
            addNotification({
                message: deleteMode ? `"${bookTitle}" and associated Conductor project was successfully deleted.` : `"${bookTitle}" was successfully unpublished.`,
                type: 'success',
            });
            handleClose();
        } catch (e) {
            setIsLoading(false);
            handleGlobalError(e);
        }
    }

    return (
        <Modal
            onClose={handleClose}
            open={open}
            size="large"
        >
            <Modal.Header>{deleteMode ? 'Delete Book and Project' : 'Unpublish Book'}</Modal.Header>
            <Modal.Content>
                <p>Are you sure you want to {deleteMode ? 'delete the record for' : 'unpublish'} "{bookTitle}"? <strong>By clicking {deleteMode ? 'Delete' : 'Unpublish'}, you confirm you understand the following:</strong></p>
                <ul className="my-4 list-disc list-inside leading-7">
                    <li>
                        <span>The entry will be removed from Commons.</span>
                        <ul className="ml-4 list-disc list-inside">
                            <li>Any submitted Peer Reviews for this Commons entry will be deleted.</li>
                            <li>Any submitted Adoption Reports for this Commons entry will be deleted.</li>
                        </ul>
                    </li>
                    <li>The entry will be removed from any collections it is a part of.</li>
                    <li>The entry will be removed from the central downloads listings and vendor export lists.</li>
                    {deleteMode && (
                        <li>The corresponding Conductor project (if applicable) and any related resources will be deleted.</li>
                    )}
                </ul>
                <p className="mb-2"><strong>In order to continue, confirm the following:</strong></p>
                <Checkbox
                    checked={confirmCoverPage}
                    label={<label>The <i>Cover Page</i> option has been changed from ‘yes’ in the book’s library page.</label>}
                    onChange={(_e, data) => setConfirmCoverPage(data.checked as boolean)}
                />
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={onClose}>
                    Cancel
                </Button>
                <Button
                    color={deleteMode ? 'red' : 'orange'}
                    disabled={!confirmCoverPage}
                    loading={isLoading}
                    onClick={submitDeleteBook}
                >
                    <Icon name={deleteMode ? 'trash' : 'eraser'} /> {deleteMode ? 'Delete' : 'Unpublish'}
                </Button>
            </Modal.Actions>
        </Modal>
    )
};