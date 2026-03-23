import { useState } from "react";
import { Modal } from "semantic-ui-react";
import api from "../../../api";
import { useMutation } from "@tanstack/react-query";
import Button from "../../NextGenComponents/Button";
import Select from "../../NextGenInputs/Select";

type GenerateTemplateJSONModalProps = {
    onClose: () => void;
}

type TemplateType = "header" | "footer";

const GenerateTemplateJSONModal = ({ onClose }: GenerateTemplateJSONModalProps) => {
    const [templateType, setTemplateType] = useState<TemplateType>("header");
    const [copied, setCopied] = useState(false);
    const [templateContent, setTemplateContent] = useState<string | null>(null);

    const { mutate: generateTemplate, isPending } = useMutation({
        mutationFn: async (type: TemplateType) => {
            const response = await api.getCXOnePageContentTemplate(type);
            if (response.data.err) {
                throw new Error(response.data.errMsg || "Failed to fetch template.");
            }
            return response.data.template;
        },
        onSuccess: (template) => {
            setTemplateContent(template);
            setCopied(false);
        },
        onError: (error) => {
            console.error("Failed to generate template:", error);
            alert("Failed to generate template. Please try again.");
        },
    });

    async function handleCopy() {
        if (!templateContent) return;
        await navigator.clipboard.writeText(templateContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <Modal size="large" open onClose={onClose}>
            <Modal.Header>Copy Template HTML</Modal.Header>
            <Modal.Content>
                <p className="mb-4">
                    Select a template type and click <strong>Generate</strong> to fetch the complete HTML content.
                    The template includes all authors with a <code>nameKey</code> and is ready to use in CXOne Page Content templates.
                </p>
                <div className="flex gap-x-2 mb-4 items-end">
                    <Select
                        name="template-type"
                        label="Template Type"
                        options={[
                            { label: "Header", value: "header" },
                            { label: "Footer", value: "footer" },
                        ]}
                        value={templateType}
                        onChange={(e) => setTemplateType(e.target.value as TemplateType)}
                        disabled={isPending}
                    />
                    <Button
                        icon="IconRefresh"
                        onClick={() => generateTemplate(templateType)}
                        loading={isPending}
                        disabled={isPending}
                    >
                        Generate
                    </Button>
                    {templateContent && (
                        <Button
                            variant="secondary"
                            icon={copied ? "IconCheck" : "IconCopy"}
                            onClick={handleCopy}
                        >
                            {copied ? "Copied!" : "Copy to Clipboard"}
                        </Button>
                    )}
                </div>
                {templateContent && (
                    <pre className="bg-gray-900 text-green-400 text-xs rounded-md p-4 overflow-auto max-h-[500px] font-mono whitespace-pre">
                        {templateContent}
                    </pre>
                )}
            </Modal.Content>
            <Modal.Actions className="flex justify-end">
                <Button variant="secondary" onClick={onClose}>
                    Close
                </Button>
            </Modal.Actions>
        </Modal>
    );
};

export default GenerateTemplateJSONModal;
