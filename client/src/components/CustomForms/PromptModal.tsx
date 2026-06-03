import { Modal, Button, Input, Select } from "@libretexts/davis-react";
import { IconDeviceFloppy, IconPlus, IconArrowUp, IconArrowDown, IconTrash } from "@tabler/icons-react";
import { CustomFormPromptType, GenericKeyTextValueObj } from "../../types";
import { customFormPromptTypes } from "./CustomFormPromptTypes";
import { useEffect, useState } from "react";

interface PromptModalProps {
  show: boolean;
  mode: "add" | "edit";
  promptType: string;
  promptText: string;
  promptReq: boolean;
  dropdownOptions: GenericKeyTextValueObj<string>[];
  newOptionValue: string;
  onChangePromptText: (newVal: string) => void;
  onChangePromptReq: (newVal: boolean) => void;
  onChangeNewOptionValue: (newVal: string) => void;
  onChangePromptType: (newVal: CustomFormPromptType) => void;
  onAddDropdownPromptOption: () => void;
  onMoveDropdownPromptOption: (idx: number, direction: "up" | "down") => void;
  onDeleteDropdownPromptOption: (idx: number) => void;
  onSave: () => void;
  onClose: () => void;
  loading?: boolean;
}

const PromptModal: React.FC<PromptModalProps> = ({
  show,
  mode,
  promptType,
  promptText,
  promptReq,
  dropdownOptions,
  newOptionValue,
  onChangePromptText,
  onChangePromptReq,
  onChangeNewOptionValue,
  onChangePromptType,
  onAddDropdownPromptOption,
  onMoveDropdownPromptOption,
  onDeleteDropdownPromptOption,
  onSave,
  onClose,
  loading,
}) => {
  const [promptTextError, setPromptTextError] = useState(false);
  const [promptTypeError, setPromptTypeError] = useState(false);
  const [dropdownError, setDropdownError] = useState(false);
  const [dropdownErrorText, setDropdownErrorText] = useState("");

  useEffect(() => {
    setPromptTextError(false);
    setPromptTypeError(false);
    setDropdownError(false);
    setDropdownErrorText("");
    if (show) {
      const textInput = document.getElementById("prompt-text-input");
      if (textInput) textInput.focus();
    }
  }, [show]);

  function validateForm() {
    if (promptText === "") { setPromptTextError(true); return; }
    if (promptType === "") { setPromptTypeError(true); return; }
    if (promptType === "dropdown" && dropdownOptions.length === 0) {
      setDropdownError(true);
      setDropdownErrorText("At least one option is required.");
      return;
    }
    onSave();
  }

  const validateNewPromptOption = () => {
    if (newOptionValue.trim().length === 0 || newOptionValue.length > 250) {
      setDropdownError(true);
      setDropdownErrorText("Option must be between 1 and 250 characters.");
      return;
    }
    onAddDropdownPromptOption();
    setDropdownError(false);
    setDropdownErrorText("");
  };

  const selectOptions = customFormPromptTypes.map((t: any) => ({
    label: t.text ?? t.label ?? t.value,
    value: t.value,
  }));

  return (
    <Modal open={show} onClose={onClose} size="md">
      <Modal.Header>
        <Modal.Title>{mode === "add" ? "Add" : "Edit"} Prompt</Modal.Title>
        <Modal.Close />
      </Modal.Header>
      <Modal.Body className="overflow-y-auto max-h-[70vh]">
        <div className="flex flex-col gap-4">
          <Input
            id="prompt-text-input"
            name="prompt-text"
            type="text"
            label="Prompt Text"
            value={promptText}
            onChange={(e) => onChangePromptText(e.target.value)}
            placeholder="Enter prompt/instructions/question..."
            required
          />
          <Select
            name="prompt-type"
            label="Prompt Type"
            placeholder="Prompt Type..."
            options={selectOptions}
            value={promptType}
            onChange={(e) => onChangePromptType(e.target.value as CustomFormPromptType)}
          />
          {promptType !== "" && (
            <>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Response Required?</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={promptReq === true}
                      onChange={() => onChangePromptReq(true)}
                      className="accent-primary"
                    />
                    Yes
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={promptReq === false}
                      onChange={() => onChangePromptReq(false)}
                      className="accent-primary"
                    />
                    No
                  </label>
                </div>
              </div>
              {promptType === "dropdown" && (
                <div>
                  <p className="text-sm font-semibold mb-2">
                    Dropdown Options <span className="text-gray-400 font-normal">(up to 25)</span>
                  </p>
                  <div className="border border-gray-200 rounded-md divide-y divide-gray-200">
                    {dropdownOptions.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2">
                        <span className="text-sm">{item.text}</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            title="Move Up"
                            className="p-1 hover:bg-gray-100 rounded text-gray-600"
                            onClick={() => onMoveDropdownPromptOption(idx, "up")}
                          >
                            <IconArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            title="Move Down"
                            className="p-1 hover:bg-gray-100 rounded text-gray-600"
                            onClick={() => onMoveDropdownPromptOption(idx, "down")}
                          >
                            <IconArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            title="Remove"
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                            onClick={() => onDeleteDropdownPromptOption(idx)}
                          >
                            <IconTrash size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {dropdownOptions.length < 25 && (
                      <div className="flex gap-2 p-2">
                        <input
                          type="text"
                          value={newOptionValue}
                          onChange={(e) => onChangeNewOptionValue(e.target.value)}
                          placeholder="Enter option text..."
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <Button
                          variant="primary"
                          icon={<IconPlus size={14} />}
                          onClick={validateNewPromptOption}
                        >
                          Add Option
                        </Button>
                      </div>
                    )}
                  </div>
                  {dropdownError && dropdownErrorText && (
                    <p className="text-red-600 text-xs mt-1">{dropdownErrorText}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={mode === "add" ? <IconPlus size={16} /> : <IconDeviceFloppy size={16} />}
            loading={loading ?? false}
            onClick={validateForm}
          >
            {mode === "add" ? "Add" : "Save"} Prompt
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default PromptModal;
