import { useFormContext } from "react-hook-form";
import RequestFormWithAuth from "./RequestFormWithAuth";
import { SupportTicket } from "../../../types";
import { libraryOptions } from "../../util/LibraryOptions";
import { useCallback } from "react";
import useCentralIdentityLicenses from "../../../hooks/useCentralIdentityLicenses";
import { textUseOptions } from "../../util/HarvestingMasterOptions";
import { FormSection, Input, Select, Stack, Text, Textarea } from "@libretexts/davis-react";
import CtlNextGenCheckbox from "../../ControlledInputs/CtlNextGenCheckbox";
const DESCRIP_MAX_CHARS = 500;

interface HarvestRequestFormProps { }

const HarvestRequestForm: React.FC<HarvestRequestFormProps> = () => {
  const { control, watch, getValues, register } = useFormContext<SupportTicket>();
  const { licenseOptions } = useCentralIdentityLicenses();

  // Return new license version options when license name changes
  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions?.find(
      (l) => l.name === getValues("metadata.license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("metadata.license.name"), licenseOptions]);

  return (
    <RequestFormWithAuth>
      <Stack gap="lg">
        <FormSection title="Harvest Request Info">
          <Text>
            Please only submit one request per resource. If you have multiple
            resources, please submit a separate request for each.
          </Text>
          <Input
            label="Resource Title"
            placeholder="Enter the title of the resource to be harvested"
            required
            {...register("title", { required: "Title is required" })}
          />
          <Select
            label="Library"
            placeholder="Select the library this resource should be added to"
            required
            options={libraryOptions.map((lib) => ({
              value: lib.value,
              label: lib.text,
            }))}
            {...register("metadata.library", { required: "Library is required" })}
          />
        </FormSection>
        <FormSection title="Resource Information">
          <Text>
            We can harvest OER content from nearly any format, although content
            in some formats requires more effort to integrate than others. If
            the requested resource exists online please enter the URL below. If
            the resource is a file (such as a PDF, ePub, or ZIP archive) please
            attach it at the bottom of this form.
          </Text>
          <Input
            label="URL (if online resource)"
            placeholder="Enter the URL of the resource to be harvested"
            type="url"
            {...register("capturedURL", { required: false })}
          />
          <Select
            label="License Name"
            placeholder="Select a license..."
            required
            options={licenseOptions?.map((l) => ({
              value: l.name,
              label: l.name,
            }))}
            {...register("metadata.license.name", { required: "License is required" })}
          />
          {selectedLicenseVersions().length > 0 && (
            <Select
              label="License Version"
              placeholder="Select license version"
              options={selectedLicenseVersions().map((v) => ({
                value: v,
                label: v,
              }))}
              {...register("metadata.license.version", { required: selectedLicenseVersions().length > 0 ? "License version is required" : false })}
            />
          )}
          {/*TODO: change to Davis Checkbox when RHF integration is fixed */}
          <CtlNextGenCheckbox
            control={control}
            name="metadata.license.modifiedFromSource"
            label="File modified from source?"
          />
          <Textarea
            label="Additional License Terms"
            placeholder="Additional terms (if applicable)..."
            maxLength={DESCRIP_MAX_CHARS}
            {...register("metadata.license.additionalTerms", { required: false })}
          />
        </FormSection>
        <FormSection title="Priority">
          <Text>
            We try to prioritize harvesting for OER texts that instructors are
            ready to adopt in their classes.
          </Text>
          <Input
            label="Your School/Institution"
            placeholder="Enter the name of your school or institution"
            {...register("metadata.institution", { required: false })}
          />
          <Select
            label="I would like to use this resource in my class"
            placeholder="Select use..."
            options={textUseOptions.map((option) => ({
              value: option.value,
              label: option.text,
            }))}
            {...register("metadata.resourceUse", { required: false })}
          />
          <Input
            label="Date integration has to be completed for adoption to be possible(*)"
            placeholder="Enter the date..."
            type="date"
            {...register("metadata.dateIntegrate", { required: false })}
          />
          <Text className="ml-1 text-sm">
            *
            <em>
              We try to integrate projects by the date they are needed but
              cannot guarantee this.
            </em>
          </Text>
        </FormSection>
        <FormSection title="Additional Information (optional)">
          <Textarea
            label=""
            placeholder="Is there any other information you'd like to provide about this publishing request?"
            maxLength={2000}
            rows={4}
            {...register("description", { required: false })}
          />
        </FormSection>
      </Stack>
    </RequestFormWithAuth >
  );
};

export default HarvestRequestForm;
