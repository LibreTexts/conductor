import { Control, Controller, FormState } from "react-hook-form";
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
import { required } from "../../utils/formRules";

interface RenderTagInputProps {
  tag: AssetTag;
  index: number;
  control: Control<ProjectFile>;
  formState: FormState<ProjectFile>;
}

export const RenderTagInput: React.FC<RenderTagInputProps> = ({
  tag,
  index,
  control,
  formState,
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

  const TagTextInput = () => {
    return (
      <CtlTextInput
        name={`tags.${index}.value`}
        control={control}
        fluid
        placeholder="Enter value"
        rules={required}
        showErrorMsg={false}
      />
    );
  };

  if (tag.framework && isAssetTagFramework(tag.framework)) {
    const templateInFramework = tag.framework.templates.find(
      (t) =>
        (isAssetTagKeyObject(t.key) ? t.key.title : t.key) ===
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
                placeholder="Select a value"
                error={
                  (formState.errors.tags &&
                  formState.errors.tags[index]) ? true : false
                }
              />
            )}
            name={`tags.${index}.value`}
            control={control}
            rules={required}
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
                placeholder="Select value(s)"
                onAddItem={(e, { value }) => {
                  if (value) {
                    templateInFramework.options?.push(value.toString());
                    field.onChange([
                      ...(field.value as string[]),
                      value.toString(),
                    ]);
                  }
                }}
                error={
                  (formState.errors.tags &&
                  formState.errors.tags[index]) ? true : false
                }
              />
            )}
            name={`tags.${index}.value`}
            control={control}
            rules={required}
          />
        );
      }
    }
  }

  return <TagTextInput />; // Fall back to text input
};
