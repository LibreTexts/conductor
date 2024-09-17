import { useForm } from "react-hook-form";
import { Button, Icon, Modal } from "semantic-ui-react";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { useNotifications } from "../../context/NotificationContext";
import useGlobalError from "../error/ErrorHooks";
import { useState } from "react";
import api from "../../api";

interface AdminChangeURLProps {
    projectID: string;
    currentURL?: string;
    onSave: (newURL: string) => void;
    onClose: () => void;
}

const AdminChangeURL: React.FC<AdminChangeURLProps> = ({ projectID, currentURL, onSave, onClose }) => {
    const { handleGlobalError } = useGlobalError();
    const { addNotification } = useNotifications();
    const { control, getValues, trigger, watch } = useForm<{ url: string }>({ defaultValues: { url: currentURL || "" } });
    const [loading, setLoading] = useState(false);


    async function handleSave() {
        try {
            setLoading(true);
            if (!(await trigger())) return;

            const { url } = getValues();

            const res = await api.updateProject({ projectID, projectURL: url });
            if (res.data.err) {
                throw new Error(res.data.errMsg);
            }

            addNotification({
                message: "The project URL has been updated successfully.",
                type: "success"
            });

            onSave(url);
        } catch (err) {
            console.error(err);
            handleGlobalError(err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Modal open={true}>
            <Modal.Header>Change Project URL</Modal.Header>
            <Modal.Content className="w-full">
                <p className="mb-4">
                    <span className="font-semibold">CAUTION:</span> Changing the textbook URL of a project will allow project members to modify the textbook content at the new URL. This action cannot be undone.
                </p>
                <CtlTextInput
                    control={control}
                    name="url"
                    label="Textbook URL"
                    placeholder="Enter the new URL for the project"
                    rules={{
                        required: "Please enter a URL for the project"
                    }}
                    className="w-full"
                    fluid
                />
            </Modal.Content>
            <Modal.Actions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    icon
                    labelPosition="left"
                    color="green"
                    loading={loading}
                    onClick={handleSave}
                    disabled={loading || watch('url').trim().length < 5}
                >
                    <Icon name="save" />
                    Save
                </Button>
            </Modal.Actions>
        </Modal>
    )
}

export default AdminChangeURL;