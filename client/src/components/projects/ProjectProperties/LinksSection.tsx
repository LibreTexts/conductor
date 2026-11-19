import { Control, UseFormSetValue, useWatch } from "react-hook-form";
import { Button, Text } from "@libretexts/davis-react";
import { IconPencil } from "@tabler/icons-react";
import { Project } from "../../../types";
import { useModals } from "../../../context/ModalContext";
import { useTypedSelector } from "../../../state/hooks";
import CopyValueButton from "../../util/CopyValueButton";
import AdminChangeURL from "../AdminChangeURL";
import SectionCard from "../ProjectView/SectionCard";
import { TextField } from "./fields";

interface LinksSectionProps {
  control: Control<Project>;
  setValue: UseFormSetValue<Project>;
  projectID: string;
  didCreateWorkbench: boolean;
}

const LinksSection = ({ control, setValue, projectID, didCreateWorkbench }: LinksSectionProps) => {
  const org = useTypedSelector((state) => state.org);
  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();
  const projectURL = useWatch({ control, name: "projectURL" }) as string | undefined;
  const noun = org.orgID === "calearninglab" ? "Project" : "Textbook";

  const openChangeURL = () =>
    openModal(
      <AdminChangeURL
        projectID={projectID}
        currentURL={projectURL}
        onSave={(newURL) => {
          // Already saved by the modal, so the form takes it without marking itself dirty.
          setValue("projectURL", newURL, { shouldDirty: false });
          closeAllModals();
        }}
        onClose={() => closeAllModals()}
      />
    );

  return (
    <SectionCard
      id="links"
      title="Links & Integrations"
      description="Connect this project to its book and homework."
      bodyClassName="flex flex-col gap-4 p-5"
    >
      {!didCreateWorkbench ? (
        <div className="flex items-start gap-1">
          <TextField
            control={control}
            name="projectURL"
            label={`${noun} URL`}
            type="url"
            placeholder={`Enter ${noun.toLowerCase()} URL…`}
            helperText="Optional. A LibreTexts URL fills in the library, ID, and bookshelf or campus for you."
            className="min-w-0 flex-1"
          />
          {projectURL && (
            <div className="mt-7">
              <CopyValueButton value={projectURL} label={`Copy ${noun} URL`} tooltipPosition="left" />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Text weight="medium" size="sm" as="span">
            {noun} URL
          </Text>
          {projectURL ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Text size="sm" className="break-all">
                <a href={projectURL} target="_blank" rel="noopener noreferrer">
                  {projectURL}
                  <span className="sr-only"> (opens in new tab)</span>
                </a>
              </Text>
              <CopyValueButton value={projectURL} label={`Copy ${noun} URL`} />
            </span>
          ) : (
            <Text size="sm" color="muted">Not set</Text>
          )}
          <Text as="p" size="sm" color="muted" className="m-0">
            Set by the book this project created.
          </Text>
          {user.isSuperAdmin && (
            <Button variant="outline" size="sm" icon={<IconPencil size={14} />} className="self-start" onClick={openChangeURL}>
              Change Textbook URL (Admin Only)
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <TextField
          control={control}
          name="adaptURL"
          label="ADAPT Course URL"
          type="url"
          placeholder="Enter ADAPT Course Dashboard URL…"
          helperText="Optional. Paste the course dashboard or course properties URL. Conductor finds the course ID."
        />
        <Text as="p" size="sm" color="muted" className="m-0">
          Links this project's Commons page to an{" "}
          <a href="https://adapt.libretexts.org" target="_blank" rel="noopener noreferrer">
            ADAPT
            <span className="sr-only"> (opens in new tab)</span>
          </a>{" "}
          course. Make sure the course allows anonymous users.
        </Text>
      </div>
    </SectionCard>
  );
};

export default LinksSection;
