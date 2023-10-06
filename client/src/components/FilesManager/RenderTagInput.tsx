import { Control, Controller } from "react-hook-form";
import { AssetTag, ProjectFile } from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import { isAssetTagFramework } from "../../utils/typeHelpers";
import { Dropdown } from "semantic-ui-react";

interface RenderTagInputProps {
  tag: AssetTag;
  index: number;
  control: Control<ProjectFile>;
}

export const RenderTagInput: React.FC<RenderTagInputProps> = ({
  tag,
  index,
  control,
}) => {
  const TextInput = () => {
    return (
      <CtlTextInput name={`tags.${index}.value`} control={control} fluid />
    );
  };

  if (tag.framework !== undefined) {
    if (typeof tag.framework === "string") {
      return <TextInput />; // Fall back to text input if framework not populated
    }

    if (isAssetTagFramework(tag.framework)) {
      const templateInFramework = tag.framework.templates.find(
        (template) => template.title === tag.title
      );
      if (templateInFramework && templateInFramework.valueType === "dropdown") {
        return (
          <Controller
            render={({ field }) => (
              <Dropdown
                options={templateInFramework.options?.map((opt) => ({
                  key: opt,
                  value: opt,
                  text: opt,
                }))}
                {...field}
                onChange={(e, data) => {
                  field.onChange(data.value?.toString() ?? "text");
                }}
                fluid
                selection
              />
            )}
            name={`tags.${index}.value`}
            control={control}
          />
        );
      } else {
        return <TextInput />;
      }
    }
  }

  return <TextInput />;
};
