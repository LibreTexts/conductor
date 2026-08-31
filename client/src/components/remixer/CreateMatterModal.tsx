import React, { useState } from "react";
import {
    Button,
    Stack,
    Modal,
    Text,
    Select,
    Switch,
    Alert,
} from "@libretexts/davis-react";
import { IconDeviceFloppy } from "@tabler/icons-react";
import { CreateMatterSelection } from "../../types";
import { useMutation } from "@tanstack/react-query";
import api from "../../api";
import { useNotifications } from "../../context/NotificationContext";

interface CreateMatterModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    projectId: string;
}

const CreateMatterModal: React.FC<CreateMatterModalProps> = ({
    open,
    onClose,
    onSuccess,
    projectId,
}) => {
    const { addNotification } = useNotifications();
    const [selection, setSelection] = useState<CreateMatterSelection>("both");
    const [overwrite, setOverwrite] = useState<boolean>(true);

    const createMatterMutation = useMutation({
        mutationFn: async (type: CreateMatterSelection) => {
            const response = await api.createMatter(projectId, type, overwrite);
            if (response.err) throw new Error(response.errMsg ?? "Failed to create matter");
            return response;
        },
        onSuccess: async () => {
            addNotification({
                message: "Matter created successfully. The Remixer will reload shortly.",
                type: "success",
            });
            await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait for 1.5 seconds before reloading
            onSuccess();
        },
        onError: (error) => {
            addNotification({
                message: error instanceof Error ? error.message : "Failed to create matter",
                type: "error",
            })
        },
    });


    return (
        <Modal open={open} size="md" onClose={onClose}>
            <Modal.Header>
                <Modal.Title>Create Matter (Admin Only)</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Stack direction="vertical" gap="lg" align="start" className="w-full mb-4">
                    <Text>
                        Front and back matter should be created automatically when a new book is created.
                        However, if you need to re-create the front or back matter for any reason, you can do so here.
                    </Text>
                    <Text>
                        If you do not see the new matter after creating it, please wait a moment and then use the "Start Over" button in the Remixer to refresh the draft and see the new matter.
                    </Text>
                    <Select
                        name="matter-selection"
                        label="Select matter to create"
                        placeholder="Select matter to create"
                        className="w-full"
                        disabled={createMatterMutation.isPending}
                        value={selection}
                        onChange={(e) => setSelection(e.target.value as CreateMatterSelection)}
                        options={[
                            { value: "front", label: "Front Matter" },
                            { value: "back", label: "Back Matter" },
                            { value: "both", label: "Both Front and Back Matter" },
                        ]}
                    />
                    <Switch
                        label="Overwrite existing matter? Recommended unless there are customizations you want to keep."
                        checked={overwrite}
                        onChange={(e) => setOverwrite(e)}
                    />
                    <Alert
                        variant="warning"
                        message={`This action will overwrite ${overwrite ? "any existing front or back matter for the book and" : ""} any pending changes in the Remixer. Please use with caution.`}
                    />
                </Stack>
            </Modal.Body>
            <Modal.Footer>
                <Stack direction="horizontal" gap="md" justify="end">
                    <Button variant="outline" onClick={onClose} loading={createMatterMutation.isPending}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => createMatterMutation.mutate(selection)}
                        disabled={!selection}
                        loading={createMatterMutation.isPending}
                        icon={<IconDeviceFloppy size={16} />}
                    >
                        Create Matter
                    </Button>
                </Stack>
            </Modal.Footer>
        </Modal>
    );
};

export default CreateMatterModal;
