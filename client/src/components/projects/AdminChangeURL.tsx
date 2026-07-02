import { Controller, useForm } from "react-hook-form";
import { Alert, Button, Input, Modal } from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
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
        <Modal open onClose={onClose} size="md">
            <Modal.Header>
                <Modal.Title>Change Project URL</Modal.Title>
                <Modal.Close />
            </Modal.Header>
            <Modal.Body>
                <Alert
                    variant="warning"
                    title="Caution"
                    asHeading="p"
                    message="Changing the textbook URL of a project will allow project members to modify the textbook content at the new URL. This action cannot be undone."
                    className="mb-4"
                />
                <Controller
                    name="url"
                    control={control}
                    rules={{ required: "Please enter a URL for the project" }}
                    render={({ field, fieldState }) => (
                        <Input
                            label="Textbook URL"
                            placeholder="Enter the new URL for the project"
                            {...field}
                            error={!!fieldState.error}
                            errorMessage={fieldState.error?.message}
                        />
                    )}
                />
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        icon={<IconDeviceFloppy size={16} />}
                        loading={loading}
                        onClick={handleSave}
                        disabled={loading || watch("url").trim().length < 5}
                    >
                        Save
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    )
}

export default AdminChangeURL;
