import { Control, UseFormSetValue } from "react-hook-form";
import { CentralIdentityLicense, Project } from "../../../types";
import languageCodes from "../../../utils/languageCodes";
import ISBNsTable from "../ISBNsTable";
import SectionCard from "../ProjectView/SectionCard";
import { DateField, SelectField, TextField } from "./fields";
import LicenseFields from "./LicenseFields";

interface SourceSectionProps {
  control: Control<Project>;
  setValue: UseFormSetValue<Project>;
  licenseOptions: CentralIdentityLicense[];
}

const LANGUAGE_OPTIONS = languageCodes.map((l) => ({ value: l.code, label: l.name }));

const SourceSection = ({ control, setValue, licenseOptions }: SourceSectionProps) => (
  <SectionCard
    id="source"
    title="Source"
    description="For projects based on an existing resource or tool."
    bodyClassName="flex flex-col gap-4 p-5"
  >
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField control={control} name="author" label="Author" placeholder="Enter resource author name…" />
      <TextField
        control={control}
        name="authorEmail"
        label="Author's Email"
        type="email"
        placeholder="Enter resource author's email…"
      />
      <TextField control={control} name="doi" label="DOI" placeholder="Enter DOI…" />
      <SelectField
        control={control}
        name="sourceLanguage"
        label="Language"
        placeholder="Choose a language…"
        options={LANGUAGE_OPTIONS}
      />
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <DateField control={control} name="sourceOriginalPublicationDate" label="Original Publication Date" />
      <DateField control={control} name="sourceHarvestDate" label="Harvest/Import Date" />
      <DateField control={control} name="sourceLastModifiedDate" label="Last Modified Date" />
    </div>
    <ISBNsTable control={control} setValue={setValue} />
    <LicenseFields
      control={control}
      setValue={setValue}
      prefix="license"
      title="Source License"
      licenseOptions={licenseOptions}
      sourceURLLabel="Original URL"
      modifiedLabel="Modified from source"
    />
  </SectionCard>
);

export default SourceSection;
