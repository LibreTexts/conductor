import { Control, UseFormSetValue, useWatch } from "react-hook-form";
import { FormSection } from "@libretexts/davis-react";
import { CentralIdentityLicense, Project } from "../../../types";
import { required } from "../../../utils/formRules";
import { CheckboxField, SelectField, TextAreaField, TextField } from "./fields";
import { DESCRIP_MAX_CHARS } from "./constants";

interface LicenseFieldsProps {
  control: Control<Project>;
  setValue: UseFormSetValue<Project>;
  prefix: "license" | "defaultFileLicense";
  title: string;
  description?: string;
  licenseOptions: CentralIdentityLicense[];
  sourceURLLabel: string;
  modifiedLabel: string;
}

/**
 * License name, version, source URL, modified flag and extra terms. Shared by
 * the source license and the default license for new assets.
 */
const LicenseFields = ({
  control,
  setValue,
  prefix,
  title,
  description,
  licenseOptions,
  sourceURLLabel,
  modifiedLabel,
}: LicenseFieldsProps) => {
  const name = useWatch({ control, name: `${prefix}.name` });
  const versions = licenseOptions.find((l) => l.name === name)?.versions ?? [];

  // Runs on the user's choice only, so loading a project never rewrites its stored URL.
  const handleNameChange = (nextName: string) => {
    const license = licenseOptions.find((l) => l.name === nextName);
    setValue(`${prefix}.url`, license?.url ?? "", { shouldDirty: true });
    if (!license?.versions?.length) {
      setValue(`${prefix}.version`, "", { shouldDirty: true });
    }
  };

  return (
    <FormSection title={title} description={description}>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          control={control}
          name={`${prefix}.name`}
          label="License"
          placeholder="Select a license…"
          options={licenseOptions.map((l) => ({ value: l.name, label: l.name }))}
          onValueChange={handleNameChange}
        />
        {versions.length > 0 && (
          <SelectField
            control={control}
            name={`${prefix}.version`}
            label="Version"
            placeholder="Select a version…"
            options={versions.map((v) => ({ value: v, label: v }))}
            rules={required}
            required
          />
        )}
      </div>
      <TextField
        control={control}
        name={`${prefix}.sourceURL`}
        label={sourceURLLabel}
        type="url"
        placeholder="https://example.com"
      />
      <CheckboxField control={control} name={`${prefix}.modifiedFromSource`} label={modifiedLabel} />
      <TextAreaField
        control={control}
        name={`${prefix}.additionalTerms`}
        label="Additional License Terms"
        placeholder="Additional terms, if any…"
        maxLength={DESCRIP_MAX_CHARS}
      />
    </FormSection>
  );
};

export default LicenseFields;
