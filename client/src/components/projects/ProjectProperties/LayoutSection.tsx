import { Link } from "react-router-dom";
import { Control, UseFormGetValues, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Text } from "@libretexts/davis-react";
import { Project } from "../../../types";
import { CHAT_NOTIFY_OPTS } from "../../../utils/constants";
import ProjectModulesControl from "../ProjectModulesControl";
import SectionCard from "../ProjectView/SectionCard";
import { SelectField } from "./fields";

interface LayoutSectionProps {
  control: Control<Project>;
  getValues: UseFormGetValues<Project>;
  setValue: UseFormSetValue<Project>;
  watch: UseFormWatch<Project>;
  projectID: string;
  showPeerReviewLink: boolean;
}

const NOTIFY_OPTIONS = CHAT_NOTIFY_OPTS(true, () => {}).map((o) => ({
  value: String(o.value),
  label: o.text,
}));

const LayoutSection = ({
  control,
  getValues,
  setValue,
  watch,
  projectID,
  showPeerReviewLink,
}: LayoutSectionProps) => (
  <SectionCard
    id="layout"
    title="Page Layout"
    description="Choose which modules appear on the project page, and in what order."
    bodyClassName="flex flex-col gap-4 p-5"
  >
    <ProjectModulesControl
      getValues={getValues}
      setValue={(name, value) => setValue(name, value, { shouldDirty: true })}
      watch={watch}
    />
    <SelectField
      control={control}
      name="defaultChatNotification"
      label="Default Discussion Notification"
      placeholder="Choose who gets notified…"
      helperText="Preselected in the Notify menu when someone posts a message."
      options={NOTIFY_OPTIONS}
      defaultValue="all"
      className="sm:max-w-sm"
    />
    {showPeerReviewLink && (
      <Text as="p" size="sm" color="muted" className="m-0">
        Peer Review settings live on the{" "}
        <Link to={`/projects/${projectID}/peerreview`}>Peer Review page</Link>.
      </Text>
    )}
  </SectionCard>
);

export default LayoutSection;
