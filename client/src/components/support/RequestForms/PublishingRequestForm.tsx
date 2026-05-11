import { Control, useFieldArray, useFormContext } from "react-hook-form";
import RequestFormWithAuth from "./RequestFormWithAuth";
import { SupportTicket } from "../../../types";
import { Button, Icon, Table } from "semantic-ui-react";
import { useCallback, useEffect, useState } from "react";
import useCentralIdentityLicenses from "../../../hooks/useCentralIdentityLicenses";
import CtlNextGenCheckbox from "../../ControlledInputs/CtlNextGenCheckbox";
import { Input, Select, Textarea } from "@libretexts/davis-react";

interface AuthorEntry {
  firstName: string;
  lastName: string;
  institution: string;
}

const AuthorsTable: React.FC<{
  control: Control<SupportTicket>;
}> = ({ control }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "metadata.authors",
  });
  const { register } = useFormContext<SupportTicket>();

  return (
    <div className="w-full">
      <Table celled fluid compact striped className="!mt-4 !mb-0">
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>First Name</Table.HeaderCell>
            <Table.HeaderCell>Last Name</Table.HeaderCell>
            <Table.HeaderCell>Institution</Table.HeaderCell>
            <Table.HeaderCell>Actions</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {fields.map((field, idx) => (
            <Table.Row key={field.id}>
              <Table.Cell>
                <Input
                  label="First Name"
                  placeholder="First Name"
                  {...register(`metadata.authors.${idx}.firstName` as const)}
                />
              </Table.Cell>
              <Table.Cell>
                <Input
                  label="Last Name"
                  placeholder="Last Name"
                  {...register(`metadata.authors.${idx}.lastName` as const)}
                />
              </Table.Cell>
              <Table.Cell>
                <Input
                  label="Institution"
                  placeholder="Institution"
                  {...register(`metadata.authors.${idx}.institution` as const)}
                />
              </Table.Cell>
              <Table.Cell>
                <Button
                  color="red"
                  icon
                  onClick={() => remove(idx)}
                  aria-label={`Remove author ${idx + 1}`}
                >
                  <Icon name="trash" />
                </Button>
              </Table.Cell>
            </Table.Row>
          ))}
          {fields.length === 0 && (
            <Table.Row>
              <Table.Cell colSpan={4} textAlign="center">
                <em>
                  No authors added yet. Click "Add Author" to get started.
                </em>
              </Table.Cell>
            </Table.Row>
          )}
        </Table.Body>
      </Table>
      <div className="flex flex-row justify-end">
        <Button
          color="blue"
          icon
          labelPosition="left"
          onClick={() =>
            append({
              firstName: "",
              lastName: "",
              institution: "",
            } as AuthorEntry)
          }
          className="!mt-2"
        >
          <Icon name="plus" />
          Add Author
        </Button>
      </div>
    </div>
  );
};

interface PublishingRequestFormProps {}

const PublishingRequestForm: React.FC<PublishingRequestFormProps> = () => {
  const [didPassProjectID, setDidPassProjectID] = useState(false);

  const { control, watch, getValues, setValue, register } =
    useFormContext<SupportTicket>();

  const { licenseOptions, isFetching: licensesLoading } =
    useCentralIdentityLicenses();

  // Return new license version options when license name changes
  const selectedLicenseVersions = useCallback(() => {
    const license = licenseOptions?.find(
      (l) => l.name === getValues("metadata.license.name")
    );
    if (!license) return [];
    return license.versions ?? [];
  }, [watch("metadata.license.name"), licenseOptions]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectID = urlParams.get("projectID");
    if (projectID) {
      setDidPassProjectID(true);
      setValue("metadata.projectID", projectID);
    }
  }, []);

  return (
    <RequestFormWithAuth>
      <div className="space-y-8">
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl mt-12">
            Publishing Request Info
          </h3>
          <p className="text-gray-600 text-sm/6 !mt-1">
            Please only submit one request per project. If you have multiple
            projects, please submit a separate request for each.
          </p>
          <Input
            label="Book Title"
            placeholder="What is the official title of your book?"
            required
            maxLength={200}
            className="!mt-4"
            {...register("title", { required: "Book title is required" })}
          />
          <Input
            label="Project ID"
            placeholder="What is the ID of the Conductor project? (e.g. 'gsIYEkWa3i')"
            required
            maxLength={200}
            className="!mt-4"
            disabled={didPassProjectID}
            {...register("metadata.projectID", { required: "Project ID is required" })}
          />
        </div>
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl">Pre-Publishing Checks</h3>
          <p className="text-gray-600 text-sm/6 !mt-1">
            Please review the following checklist to ensure your resource is
            ready for publishing. You can find more information about each item
            on{" "}
            <a
              href="https://chem.libretexts.org/Courses/Remixer_University/Construction_Guide_for_LibreTexts_2e/15%3A_Styles_Standards_and_Typesetting/15.04%3A_Textbook_Completing_Checklist"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              this page
            </a>{" "}
            of our Construction Guide.
          </p>
          <div className="flex flex-col justify-start items-start gap-y-4 mt-6">
            <CtlNextGenCheckbox
              control={control}
              name="metadata.prePublishingChecks.thumbnails"
              label="Book and chapter thumbnails are 250x250px or less. Larger images may be slow to load or render poorly."
              required={true}
            />
            <CtlNextGenCheckbox
              control={control}
              name="metadata.prePublishingChecks.spellingGrammar"
              label="Content has been reviewed for spelling and grammar errors."
              required={true}
            />
            <CtlNextGenCheckbox
              control={control}
              name="metadata.prePublishingChecks.summaries"
              label="A summary has been provided in the 'Page Settings' of your book's cover page. You can use the 'AI Co-Author' feature in Conductor to help generate summaries for each page."
              required={true}
            />
            <CtlNextGenCheckbox
              control={control}
              name="metadata.prePublishingChecks.accessibility"
              label="The Accessibility Checker has been run and all issues have been addressed (see Construction Guide link above for more details). Federal law will require accessibility compliance for all educational materials by 2026."
              required={true}
            />
          </div>
        </div>
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl">License Information</h3>
          <p className="text-gray-600 text-sm/6 !mt-1">
            What license will this resource be published under?
          </p>
          <div className="mt-4">
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
          </div>
          {selectedLicenseVersions().length > 0 && (
            <div className="mt-4">
              <Select
                label="License Version"
                placeholder="Select license version"
                required={selectedLicenseVersions().length > 0}
                options={selectedLicenseVersions().map((v) => ({
                  value: v,
                  label: v,
                }))}
                {...register("metadata.license.version", {
                  required: selectedLicenseVersions().length > 0 ? "License version is required" : false,
                })}
              />
            </div>
          )}
        </div>
        <div className="border-b border-gray-900/10 pb-10">
          <h3 className="font-semibold text-2xl">
            Author & Institution Information
          </h3>
          <p className="text-gray-600 text-sm/6 !mt-1">
            Please provide the name of the author(s) and their institution(s).
          </p>
          <AuthorsTable control={control} />
          <Input
            label="Primary Institution (if applicable)"
            placeholder="Enter the name of the primary institution this book will be used at"
            maxLength={200}
            className="!mt-4"
            {...register("metadata.institution")}
          />
        </div>
        <div>
          <h3 className="font-semibold text-2xl mb-2">
            Additional Information (optional)
          </h3>
          <Textarea
            label="Additional Information"
            placeholder="Is there any other information you'd like to provide about this publishing request?"
            maxLength={2000}
            rows={4}
            {...register("description")}
          />
        </div>
      </div>
    </RequestFormWithAuth>
  );
};

export default PublishingRequestForm;
