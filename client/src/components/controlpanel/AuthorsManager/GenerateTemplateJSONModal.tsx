import { useState } from "react";
import { Modal, Button, Select } from "@libretexts/davis-react";
import { IconCheck, IconCopy, IconRefresh } from "@tabler/icons-react";
import api from "../../../api";
import { useMutation } from "@tanstack/react-query";

type GenerateTemplateJSONModalProps = {
  onClose: () => void;
};

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
    },
  });

  async function handleCopy() {
    if (!templateContent) return;
    await navigator.clipboard.writeText(templateContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <Modal.Title>Copy Template HTML</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body>
        <p className="mb-4">
          Select a template type and click <strong>Generate</strong> to fetch
          the complete HTML content. The template includes all authors with a{" "}
          <code className="bg-gray-100 px-1 rounded text-sm">nameKey</code> and
          is ready to use in CXOne Page Content templates.
        </p>
        <div className="flex gap-2 mb-4 items-end">
          <Select
            name="template-type"
            label="Template Type"
            placeholder="Select type..."
            options={[
              { label: "Header", value: "header" },
              { label: "Footer", value: "footer" },
            ]}
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as TemplateType)}
            disabled={isPending}
          />
          <Button
            variant="primary"
            icon={<IconRefresh size={16} />}
            onClick={() => generateTemplate(templateType)}
            loading={isPending}
          >
            Generate
          </Button>
          {templateContent && (
            <Button
              variant="secondary"
              icon={copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              onClick={handleCopy}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>
          )}
        </div>
        {templateContent && (
          <pre className="bg-gray-900 text-green-400 text-xs rounded-md p-4 overflow-auto max-h-[400px] font-mono whitespace-pre">
            {templateContent}
          </pre>
        )}
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default GenerateTemplateJSONModal;
