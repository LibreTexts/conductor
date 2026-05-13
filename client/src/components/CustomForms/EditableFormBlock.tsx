import { useEffect } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { IconArrowUp, IconArrowDown, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@libretexts/davis-react";
import {
  isCustomFormHeadingOrTextBlock,
  isCustomFormPromptBlock,
} from "../../utils/typeHelpers";
import { CustomFormElement } from "../../types";
import { getFriendlyUIType } from "../../utils/customFormHelpers";

interface EditableFormBlockProps {
  item: CustomFormElement;
  disabled?: boolean;
  onMove: (item: CustomFormElement, direction: "up" | "down") => void;
  onRequestEdit: (order: number) => void;
  onRequestDelete: (order: number) => void;
}

const EditableFormBlock: React.FC<EditableFormBlockProps> = ({
  item,
  disabled,
  onMove,
  onRequestEdit,
  onRequestDelete,
}) => {
  useEffect(() => {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const textToRender = isCustomFormHeadingOrTextBlock(item)
    ? item.text
    : isCustomFormPromptBlock(item)
    ? item.promptText
    : "";
  const renderedTextHTML = {
    __html: DOMPurify.sanitize(marked(textToRender, { breaks: true })),
  };

  const typeLabel =
    item.uiType === "prompt" && isCustomFormPromptBlock(item)
      ? item.promptRequired
        ? `(Required)`
        : `(Optional)`
      : "";

  return (
    <div className="border border-gray-200 rounded-lg bg-white mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <button
              type="button"
              title="Move Up"
              className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onMove(item, "up")}
              disabled={disabled}
            >
              <IconArrowUp size={14} />
            </button>
            <button
              type="button"
              title="Move Down"
              className="p-1 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onMove(item, "down")}
              disabled={disabled}
            >
              <IconArrowDown size={14} />
            </button>
          </div>
          <span className="text-xs text-gray-600 font-medium">
            <strong>#{item.order}:</strong> {getFriendlyUIType(item.uiType)}{" "}
            {typeLabel && <span className="font-normal text-gray-500">{typeLabel}</span>}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<IconPencil size={14} />}
            onClick={() => onRequestEdit(item.order)}
            disabled={disabled}
          >
            Edit {getFriendlyUIType(item.uiType)}
          </Button>
          <Button
            variant="destructive"
            icon={<IconTrash size={14} />}
            onClick={() => onRequestDelete(item.order)}
            disabled={disabled}
          >
            Delete
          </Button>
        </div>
      </div>
      <div
        className="p-4 prose prose-code:before:hidden prose-code:after:hidden max-w-none text-sm"
        dangerouslySetInnerHTML={renderedTextHTML}
      />
    </div>
  );
};

export default EditableFormBlock;
