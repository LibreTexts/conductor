import { Control, Controller } from "react-hook-form";
import {
  AssetTag,
  AssetTagTemplate,
  GenericKeyTextValueObj,
  ProjectFile,
} from "../../types";
import CtlTextInput from "../ControlledInputs/CtlTextInput";
import {
  isAssetTagFramework,
  isAssetTagKeyObject,
} from "../../utils/typeHelpers";
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
  const genMultiSelectOptions = ({
    template,
    tag,
  }: {
    template?: AssetTagTemplate;
    tag?: AssetTag;
  }): GenericKeyTextValueObj<string>[] => {
    if (!template || !tag) {
      return [];
    }
    const options: GenericKeyTextValueObj<string>[] = [];
    if (template.options) {
      options.push(
        ...template.options.map((opt) => ({
          key: opt,
          value: opt,
          text: opt,
        }))
      );
    }
    if (tag.value && Array.isArray(tag.value)) {
      options.push(
        ...tag.value.map((opt) => ({
          key: opt,
          value: opt,
          text: opt,
        }))
      );
    }
    return options;
  };

  const TextInput = () => {
    return (
      <CtlTextInput name={`tags.${index}.value`} control={control} fluid />
    );
  };

  if (!tag.framework || !isAssetTagFramework(tag.framework)) {
    return <TextInput />; // Fall back to text input
  }

  const templateInFramework = tag.framework.templates.find(
    (template) =>
      template.title ===
      (isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key)
  );

  if (templateInFramework) {
    if (templateInFramework.valueType === "dropdown") {
      return (
        <Controller
          render={({ field }) => (
            // @ts-expect-error
            <Dropdown
              options={templateInFramework.options?.map((opt) => ({
                key: opt,
                value: opt,
                text: opt,
              }))}
              {...field}
              onChange={(e, data) => {
                field.onChange(data.value?.toString() ?? "");
              }}
              fluid
              selection
            />
          )}
          name={`tags.${index}.value`}
          control={control}
        />
      );
    }

    if (templateInFramework.valueType === "multiselect") {
      return (
        <Controller
          render={({ field }) => (
            // @ts-expect-error
            <Dropdown
              options={genMultiSelectOptions({
                template: templateInFramework,
                tag,
              })}
              {...field}
              onChange={(e, { value }) => {
                field.onChange(value);
              }}
              fluid
              selection
              multiple
              search
              allowAdditions
              onAddItem={(e, { value }) => {
                if (value) {
                  templateInFramework.options?.push(value.toString());
                  field.onChange([
                    ...(field.value as string[]),
                    value.toString(),
                  ]);
                }
              }}
            />
          )}
          name={`tags.${index}.value`}
          control={control}
        />
      );
    }
  }

  return <TextInput />; // Fall back to text input
};
