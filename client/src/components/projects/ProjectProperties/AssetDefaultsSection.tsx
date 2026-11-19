import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { CentralIdentityLicense, Project } from "../../../types";
import SectionCard from "../ProjectView/SectionCard";
import LicenseFields from "./LicenseFields";
import PrimaryAuthorField from "./PrimaryAuthorField";

interface AssetDefaultsSectionProps {
  control: Control<Project>;
  setValue: UseFormSetValue<Project>;
  licenseOptions: CentralIdentityLicense[];
}

const AssetDefaultsSection = ({ control, setValue, licenseOptions }: AssetDefaultsSectionProps) => (
  <SectionCard
    id="assets"
    title="Asset Defaults"
    description="Prefilled on every new asset. People can override them on each file."
    bodyClassName="flex flex-col gap-4 p-5"
  >
    <LicenseFields
      control={control}
      setValue={setValue}
      prefix="defaultFileLicense"
      title="Default License"
      licenseOptions={licenseOptions}
      sourceURLLabel="File Source URL"
      modifiedLabel="File modified from source"
    />
    <Controller
      control={control}
      name="defaultPrimaryAuthor"
      render={({ field }) => <PrimaryAuthorField value={field.value} onChange={field.onChange} />}
    />
  </SectionCard>
);

export default AssetDefaultsSection;
