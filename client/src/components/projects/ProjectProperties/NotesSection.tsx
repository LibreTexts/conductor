import { Control } from "react-hook-form";
import { Project } from "../../../types";
import SectionCard from "../ProjectView/SectionCard";
import { TextAreaField } from "./fields";

const NotesSection = ({ control }: { control: Control<Project> }) => (
  <SectionCard
    id="notes"
    title="Notes"
    description="Shown to the team on the project page."
    bodyClassName="flex flex-col gap-4 p-5"
  >
    <TextAreaField control={control} name="notes" label="Notes" placeholder="Enter additional notes…" rows={5} />
  </SectionCard>
);

export default NotesSection;
