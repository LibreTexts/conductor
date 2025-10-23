import { useFormContext } from "react-hook-form";
import RequestFormWithAuth from "./RequestFormWithAuth";
import { SupportTicket } from "../../../types";
import { required } from "../../../utils/formRules";
import { libraryOptions } from "../../util/LibraryOptions";
import { useCallback } from "react";
import useCentralIdentityLicenses from "../../../hooks/useCentralIdentityLicenses";
import { textUseOptions } from "../../util/HarvestingMasterOptions";
import CtlNextGenInput from "../../ControlledInputs/CtlNextGenInput";
import CtlNextGenSelect from "../../ControlledInputs/CtlNextGenSelect";
import CtlNextGenCheckbox from "../../ControlledInputs/CtlNextGenCheckbox";
import CtlNextGenTextarea from "../../ControlledInputs/CtlNextGenTextarea";
import CtlNextGenDateInput from "../../ControlledInputs/CtlNextGenDateInput";
const DESCRIP_MAX_CHARS = 500;

interface HarvestRequestFormProps { }

const HarvestRequestForm: React.FC<HarvestRequestFormProps> = () => {
  const { control, watch, getValues } = useFormContext<SupportTicket>();
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
      <div className="space-y-8">
        <div className="border-b border-gray-900/10 pb-10">
          <p className="font-semibold text-2xl mt-12">Harvest Request Info</p>
          <p className="text-gray-600 text-base/6 !mt-1">
            Please only submit one request per resource. If you have multiple
            resources, please submit a separate request for each.
          </p>
          <div className="!mt-4">
            <CtlNextGenInput
              name="title"
              control={control}
              label="Resource Title"
              placeholder="Enter the title of the resource to be harvested"
              required={true}
              rules={required}
            />
          </div>
          <div className="mt-4">
            <CtlNextGenSelect
              name="metadata.library"
              control={control}
              label="Library"
              placeholder="Select the library this resource should be added to"
              rules={required}
              options={libraryOptions.map((lib) => ({
                value: lib.value,
                label: lib.text,
              }))}
            />
          </div>
        </div>
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl">Resource Format</h3>
          <p className="text-gray-600 text-base/6 !mt-1">
            We can harvest OER content from nearly any format, although content
            in some formats requires more effort to integrate than others. If
            the requested resource exists online please enter the URL below. If
            the resource is a file (such as a PDF, ePub, or ZIP archive) please
            attach it at the bottom of this form.
          </p>
          <div className="mt-4">
            <CtlNextGenInput
              control={control}
              name="capturedURL"
              label="URL (if online resource)"
              placeholder="Enter the URL of the resource to be harvested"
              type="url"
            />
          </div>
          <div className="mt-4">
            <CtlNextGenSelect
              name="metadata.license.name"
              control={control}
              label="License Name"
              placeholder="Select a license..."
              rules={required}
              options={licenseOptions?.map((l) => ({
                value: l.name,
                label: l.name,
              }))}
            />
          </div>
          {selectedLicenseVersions().length > 0 && (
            <div className="mt-4">
              <CtlNextGenSelect
                name="metadata.license.version"
                control={control}
                label="License Version"
                placeholder="Select license version"
                rules={{ required: selectedLicenseVersions().length > 0 ? true: false }}
                options={selectedLicenseVersions().map((v) => ({
                  value: v,
                  label: v,
                }))}
              />
            </div>
          )}
          <div className="flex items-start mt-3">
            <CtlNextGenCheckbox
              name="metadata.license.modifiedFromSource"
              control={control}
              label="File modified from source?"
            />
          </div>
          <CtlNextGenTextarea
            name="metadata.license.additionalTerms"
            control={control}
            label="Additional License Terms"
            placeholder="Additional terms (if applicable)..."
            className="mt-4"
            maxLength={DESCRIP_MAX_CHARS}
            showRemaining
          />
        </div>
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl">Priority</h3>
          <p className="text-gray-600 text-base/6 !mt-1">

            We try to prioritize harvesting for OER texts that instructors are
            ready to adopt in their classes.
          </p>
          <CtlNextGenInput
            name="metadata.institution"
            control={control}
            label="Your School/Institution"
            placeholder="Enter the name of your school or institution"
            className="mt-4"
          />
          <div className="mt-4">
            <CtlNextGenSelect
              name="metadata.resourceUse"
              control={control}
              label="I would like to use this resource in my class"
              placeholder="Select use..."
              options={textUseOptions.map((option) => ({
                value: option.value,
                label: option.text,
              }))}
            />
          </div>
          <CtlNextGenDateInput
            name="metadata.dateIntegrate"
            control={control}
            label="Date integration has to be completed for adoption to be possible(*)"
            className="mt-4"
          />
          <p className="mt-1 ml-1 text-sm/6">
            *
            <em>
              We try to integrate projects by the date they are needed but
              cannot guarantee this.
            </em>
          </p>
        </div>
        <div>
          <h3 className="font-semibold text-2xl mb-2">
            Additional Information (optional)
          </h3>
          <CtlNextGenTextarea
            control={control}
            label=""
            name="description"
            placeholder="Is there any other information you'd like to provide about this publishing request?"
            maxLength={2000}
            showRemaining
            rows={4}
          />
        </div>
      </div>
    </RequestFormWithAuth>
  );
};

export default HarvestRequestForm;
