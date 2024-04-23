import { Control, Controller, FormState } from "react-hook-form";
import {
  AssetTag,
  AssetTagFramework,
  AssetTagTemplate,
  AssetTagWithKey,
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
import Fuse from "fuse.js";
import { useEffect, useMemo } from "react";

interface RenderTagInputProps {
  tag: AssetTag | AssetTagWithKey;
  index: number;
  control: Control<ProjectFile>;
  formState: FormState<ProjectFile>;
  strictRequire?: boolean;
}

const genMultiSelectOptions = ({
  template,
  tag,
}: {
  template?: AssetTagTemplate;
  tag?: AssetTag | AssetTagWithKey;
}): GenericKeyTextValueObj<string>[] => {
  if (!template || !tag) {
    return [];
  }
  const options: string[] = [];
  if (template.options) {
    options.push(...template.options);
  }
  if (tag.value && Array.isArray(tag.value)) {
    options.push(...tag.value);
  }

  const uniqueStrings = new Set(options);
  return Array.from(uniqueStrings).map((opt) => ({
    key: opt,
    value: opt,
    text: opt,
  }));
};

const TagTextInput = ({
  index,
  control,
  strictRequire = false,
}: {
  index: number;
  control: Control<ProjectFile>;
  strictRequire?: boolean;
}) => {
  return (
    <CtlTextInput
      name={`tags.${index}.value`}
      control={control}
      fluid
      placeholder="Enter value"
      rules={strictRequire ? required : undefined}
      showErrorMsg={false}
    />
  );
};

const DropdownController = ({
  index,
  control,
  formState,
  templateInFramework,
  strictRequire = false,
}: {
  index: number;
  control: Control<ProjectFile>;
  formState: FormState<ProjectFile>;
  templateInFramework: AssetTagTemplate;
  strictRequire?: boolean;
}) => {
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
            formState.errors.tags && formState.errors.tags[index] ? true : false
          }
        />
      )}
      name={`tags.${index}.value`}
      control={control}
      rules={strictRequire ? required : undefined}
    />
  );
};

const MultiSelectController = ({
  index,
  control,
  formState,
  templateInFramework,
  tag,
  strictRequire = false,
}: {
  index: number;
  control: Control<ProjectFile>;
  formState: FormState<ProjectFile>;
  templateInFramework: AssetTagTemplate;
  tag: AssetTag | AssetTagWithKey;
  strictRequire?: boolean;
}) => {
  const fuse = useMemo(() => {
    return new Fuse(
      genMultiSelectOptions({ template: templateInFramework, tag }),
      {
        keys: ["text"],
        threshold: 0.3,
      }
    );
  }, [templateInFramework, tag]);

  const options = useMemo(() => {
    return genMultiSelectOptions({ template: templateInFramework, tag });
  }, [templateInFramework, tag]);

  return (
    <Controller
      render={({ field }) => {
        return (
          // @ts-expect-error
          <Dropdown
            options={options}
            {...field}
            onChange={(e, { value }) => {
              field.onChange(value);
            }}
            fluid
            selection
            multiple
            search={(_o, query) => {
              if (!query) return options;
              const res = fuse.search(query).map((r) => ({
                key: r.item.key,
                value: r.item.value,
                text: r.item.text,
              }));
              return res;
            }}
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
              formState.errors.tags && formState.errors.tags[index]
                ? true
                : false
            }
          />
        );
      }}
      name={`tags.${index}.value`}
      control={control}
      rules={strictRequire ? required : undefined}
    />
  );
};

export const RenderTagInput: React.FC<RenderTagInputProps> = ({
  tag,
  index,
  control,
  formState,
  strictRequire = false,
}) => {
  if (tag.framework && isAssetTagFramework(tag.framework)) {
    const templateInFramework = tag.framework.templates.find(
      (t) =>
        (isAssetTagKeyObject(t.key) ? t.key.title : t.key) ===
        (isAssetTagKeyObject(tag.key) ? tag.key.title : tag.key)
    );

    if (templateInFramework) {
      if (templateInFramework.valueType === "dropdown") {
        return (
          <DropdownController
            index={index}
            control={control}
            formState={formState}
            templateInFramework={templateInFramework}
            strictRequire={strictRequire}
          />
        );
      }

      if (templateInFramework.valueType === "multiselect") {
        return (
          <MultiSelectController
            index={index}
            control={control}
            formState={formState}
            templateInFramework={templateInFramework}
            tag={tag}
            strictRequire={strictRequire}
          />
        );
      }
    }
  }

  return (
    <TagTextInput
      index={index}
      control={control}
      strictRequire={strictRequire}
    />
  ); // Fall back to text input
};
