import { Control, Controller } from "react-hook-form";
import { Project } from "../../../types";
import SectionCard from "../ProjectView/SectionCard";
import { SelectField } from "./fields";
import MultiComboboxField from "./MultiComboboxField";
import type useProjectPropertiesOptions from "./useProjectPropertiesOptions";

interface DiscoverySectionProps {
  control: Control<Project>;
  options: ReturnType<typeof useProjectPropertiesOptions>;
  /** Shows the Content Area picker even without options, so a stored value stays visible. */
  hasContentArea: boolean;
  onOrgSearch: (query: string) => void;
}

/**
 * Tags and C-IDs arrive from the server as plain strings (titles and
 * descriptors), not the object shapes on the Project type, hence the casts.
 */
const asStrings = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);

const DiscoverySection = ({ control, options, hasContentArea, onOrgSearch }: DiscoverySectionProps) => (
  <SectionCard
    id="discovery"
    title="Discovery"
    description="Help people find this project by subject, course and organization."
    bodyClassName="flex flex-col gap-4 p-5"
  >
    {(options.contentAreaOptions.length > 0 || hasContentArea) && (
      <SelectField
        control={control}
        name="contentArea"
        label="Content Area"
        placeholder="Choose a content area…"
        options={options.contentAreaOptions}
      />
    )}
    <Controller
      control={control}
      name="tags"
      render={({ field }) => (
        <MultiComboboxField
          label="Project Tags"
          itemNoun="tag"
          placeholder={options.allowTagCreation ? "Search or add tags…" : "Search tags…"}
          options={options.tagOptions}
          loading={options.tagsLoading}
          allowCreate={options.allowTagCreation}
          value={asStrings(field.value)}
          onChange={field.onChange}
        />
      )}
    />
    <Controller
      control={control}
      name="cidDescriptors"
      render={({ field }) => (
        <MultiComboboxField
          label="C-ID"
          itemNoun="C-ID"
          placeholder="Search C-IDs…"
          helperText="For content tied to a course in the California Course Identification Numbering System (C-ID)."
          options={options.cidOptions}
          loading={options.cidsLoading}
          disabled={options.cidsLoading}
          value={asStrings(field.value)}
          onChange={field.onChange}
        />
      )}
    />
    <Controller
      control={control}
      name="associatedOrgs"
      render={({ field }) => (
        <MultiComboboxField
          label="Associated Organizations"
          itemNoun="organization"
          placeholder="Search or add organizations…"
          options={options.orgOptions}
          loading={options.orgsLoading}
          allowCreate
          onQueryChange={options.searchesOrgsOnServer ? onOrgSearch : undefined}
          value={asStrings(field.value)}
          onChange={field.onChange}
        />
      )}
    />
  </SectionCard>
);

export default DiscoverySection;
