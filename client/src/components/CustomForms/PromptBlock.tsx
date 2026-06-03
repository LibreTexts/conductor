import { Checkbox } from "@libretexts/davis-react";
import LikertScale from "./LikertScale";
import { CustomFormPrompt } from "../../types";

type PromptBlockProps = {
  item: CustomFormPrompt;
  handleFieldChange: (
    item: CustomFormPrompt,
    newVal: string | number | boolean
  ) => void;
  error: boolean;
};

const PromptBlock: React.FC<PromptBlockProps> = ({
  item,
  handleFieldChange,
  error,
}) => {
  const labelClass = `block text-sm font-medium mb-1 ${error ? "text-red-600" : "text-gray-700"}`;
  const requiredMark = item.promptRequired ? <span className="text-red-500 ml-0.5">*</span> : null;

  if (["3-likert", "5-likert", "7-likert"].includes(item.promptType)) {
    const points = item.promptType === "3-likert" ? 3 : item.promptType === "5-likert" ? 5 : 7;
    return (
      <div className="my-4" key={item.order}>
        {item.promptText && (
          <label className={labelClass}>
            {item.promptText}{requiredMark}
          </label>
        )}
        <LikertScale
          points={points}
          promptOrder={item.order}
          pointChecked={parseInt(item.value?.toString() ?? "")}
          onPointChange={(value) => handleFieldChange(item, value)}
          error={error}
        />
      </div>
    );
  }

  if (item.promptType === "text") {
    return (
      <div className="my-4" key={item.order}>
        {item.promptText && (
          <label className={labelClass}>
            {item.promptText}{requiredMark}
          </label>
        )}
        <textarea
          className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y ${error ? "border-red-400" : "border-gray-300"}`}
          placeholder="Enter your response..."
          value={item.value?.toString() ?? ""}
          onChange={(e) => handleFieldChange(item, e.target.value)}
          rows={4}
        />
      </div>
    );
  }

  if (item.promptType === "dropdown" && Array.isArray(item.promptOptions)) {
    return (
      <div className="my-4" key={item.order}>
        {item.promptText && (
          <label className={labelClass}>
            {item.promptText}{requiredMark}
          </label>
        )}
        <select
          className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary ${error ? "border-red-400" : "border-gray-300"}`}
          value={item.value?.toString() ?? ""}
          onChange={(e) => handleFieldChange(item, e.target.value)}
          required={item.promptRequired}
        >
          <option value="">Choose...</option>
          {item.promptOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.text}</option>
          ))}
        </select>
      </div>
    );
  }

  if (item.promptType === "checkbox") {
    return (
      <div className="my-4" key={item.order}>
        <Checkbox
          name={`peerreview-checkbox-${item.order}`}
          label={item.promptText ?? ""}
          checked={item.value?.toString() === "true"}
          error={error}
          onChange={() =>
            handleFieldChange(item, item.value?.toString() === "true" ? false : true)
          }
        />
      </div>
    );
  }

  return null;
};

export default PromptBlock;
