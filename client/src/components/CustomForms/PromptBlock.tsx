import { Form, TextArea } from "semantic-ui-react";
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

//TODO: Handle values not being defined
const PromptBlock: React.FC<PromptBlockProps> = ({
  item,
  handleFieldChange,
  error,
}) => {
  if (item.promptType === "3-likert") {
    return (
      <Form.Field className="mt-2p mb-2p" key={item.order}>
        {item.promptText && (
          <label
            className={`${item.promptRequired ? "form-required" : ""} ${
              error ? "form-error-label" : ""
            } mb-05p`}
          >
            {item.promptText}
          </label>
        )}
        <LikertScale
          points={3}
          promptOrder={item.order}
          pointChecked={parseInt(item.value?.toString() ?? "")}
          onPointChange={(value) => handleFieldChange(item, value)}
          error={error}
        />
      </Form.Field>
    );
  } else if (item.promptType === "5-likert") {
    return (
      <Form.Field className="mt-2p mb-2p" key={item.order}>
        {item.promptText && (
          <label
            className={`${item.promptRequired ? "form-required" : ""} ${
              error ? "form-error-label" : ""
            } mb-05p`}
          >
            {item.promptText}
          </label>
        )}
        <LikertScale
          points={5}
          promptOrder={item.order}
          pointChecked={parseInt(item.value?.toString() ?? "")}
          onPointChange={(value) => handleFieldChange(item, value)}
          error={error}
        />
      </Form.Field>
    );
  } else if (item.promptType === "7-likert") {
    return (
      <Form.Field className="mt-2p mb-2p" key={item.order}>
        {item.promptText && (
          <label
            className={`${item.promptRequired ? "form-required" : ""} ${
              error ? "form-error-label" : ""
            } mb-05p`}
          >
            {item.promptText}
          </label>
        )}
        <LikertScale
          points={7}
          promptOrder={item.order}
          pointChecked={parseInt(item.value?.toString() ?? "")}
          onPointChange={(value) => handleFieldChange(item, value)}
          error={error}
        />
      </Form.Field>
    );
  } else if (item.promptType === "text") {
    return (
      <Form.Field className="mb-2p text-area-small" key={item.order}>
        {item.promptText && (
          <label className={item.promptRequired ? "form-required" : ""}>
            {item.promptText}
          </label>
        )}
        <TextArea
          placeholder="Enter your response..."
          value={item.value?.toString() ?? ""}
          onChange={(value, data) =>
            handleFieldChange(item, data.value?.toString() ?? "")
          }
        />
      </Form.Field>
    );
  } else if (
    item.promptType === "dropdown" &&
    Array.isArray(item.promptOptions)
  ) {
    return (
      <Form.Select
        key={item.order}
        fluid
        selection
        label={item.promptText}
        options={item.promptOptions}
        required={item.promptRequired}
        placeholder="Choose..."
        value={item.value?.toString() ?? ""}
        onChange={(_e, { value }) =>
          handleFieldChange(item, value?.toString() ?? "")
        }
        error={error}
      />
    );
  } else if (item.promptType === "checkbox") {
    return (
      <Form.Checkbox
        id={`peerreview-checkbox-${item.order}`}
        key={item.order}
        required={item.promptRequired}
        label={
          <label
            className={`form-field-label ${
              item.promptText && item.promptRequired ? "form-required" : ""
            }`}
            htmlFor={`peerreview-checkbox-${item.order}`}
          >
            {item.promptText}
          </label>
        }
        checked={item.value?.toString() === "true" ? true : false}
        onChange={() =>
          handleFieldChange(
            item,
            item.value?.toString() === "true" ? false : true
          )
        }
        error={error}
      />
    );
  }
  return null;
};

export default PromptBlock;
