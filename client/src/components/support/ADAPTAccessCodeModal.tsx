import {
    Modal,
    Button,
    ModalProps,
    Icon,
} from "semantic-ui-react";
import useGlobalError from "../error/ErrorHooks";
import { useQuery } from "@tanstack/react-query";
import api from "../../api";
import CopyButton from "../util/CopyButton";
import { useNotifications } from "../../context/NotificationContext";
import LoadingSpinner from "../LoadingSpinner";

interface ADAPTAccessCodeModalProps extends ModalProps {
    open: boolean;
    onClose: () => void;
}

const ADAPTAccessCodeModal: React.FC<ADAPTAccessCodeModalProps> = ({
    open,
    onClose,
    ...rest
}) => {
    const { handleGlobalError } = useGlobalError();
    const { addNotification } = useNotifications();

    const { data, isFetching } = useQuery<string | null>({
        queryKey: ['ADAPTAccessCode'],
        queryFn: () => getADAPTAccessCode(),
        enabled: open,
        staleTime: Infinity,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    })

    async function getADAPTAccessCode() {
        try {
            const res = await api.generateADAPTAccessCode();

            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }

            return res.data.access_code;
        } catch (err) {
            handleGlobalError(err);
            return null;
        }
    }

    return (
        <Modal open={open} onClose={onClose} {...rest}>
            <Modal.Header>Generate ADAPT Access Code</Modal.Header>
            <Modal.Content>
                {isFetching && <LoadingSpinner />}
                <div className="flex flex-row text-center justify-center">
                    <p className="text-xl text-center">
                        <span className="font-semibold">Access Code: </span>
                        {data ? data : "Failed to generate access code"}
                    </p>
                </div>
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={onClose} loading={isFetching}>
                    Close
                </Button>
                {data && (
                    <CopyButton val={data ?? 'unknown'} >
                        {({ copy }) => (
                            <Button
                                color="green"
                                onClick={() => {
                                    copy();
                                    addNotification({
                                        message: "Access code copied to clipboard!",
                                        type: "success",
                                    });
                                    onClose();
                                }}
                                disabled={!data}
                            >
                                Copy & Close
                            </Button>
                        )}
                    </CopyButton>
                )}
            </Modal.Actions>
        </Modal>
    );
};

export default ADAPTAccessCodeModal;
