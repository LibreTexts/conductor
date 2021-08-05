import useGlobalError from './ErrorHooks.js';
import { Modal, Button } from 'semantic-ui-react';

function ErrorModal() {
    const { error, clearError } = useGlobalError();


    const handleClose = () => {
        clearError();
    };

    return (
        <Modal
            open={!!error}
            onClose={handleClose}
        >
            <Modal.Header>
                LibreTexts Conductor: Error
                {error && error.status &&
                    <span className='muted-text'> (Status {error.status})</span>
                }
            </Modal.Header>
            <Modal.Content>
                <Modal.Description>
                    {error && error.message &&
                        <p>{error.message}</p>
                    }
                </Modal.Description>
            </Modal.Content>
            <Modal.Actions>
                <Button color="black" onClick={handleClose}>Okay</Button>
            </Modal.Actions>
        </Modal>
    )
}

export default ErrorModal;
