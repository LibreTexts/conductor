import { Badge } from "@libretexts/davis-react";
import { Project } from "../../../types";
import { getLibraryName } from "../../util/LibraryOptions";
import { getClassificationText } from "../../util/ProjectHelpers";
import { roadmapStepsSimple } from "../../util/RoadmapOptions";
import SectionCard from "./SectionCard";
import { DetailList, DetailRow } from "./DetailList";
import {
  cidLabel,
  getProjectStatusLabel,
  getProjectVisibilityLabel,
  tagLabel,
} from "./projectDisplay";

const getConstructionStepText = (step: string) =>
  roadmapStepsSimple.find((s: { name: string }) => s.name === step)?.text ?? step;

const BadgeList = ({ items }: { items: string[] }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((item, idx) => (
      <Badge key={`${item}-${idx}`} label={item} variant="default" size="sm" />
    ))}
  </div>
);

const ProjectPropertiesCard = ({ project }: { project: Project }) => (
  <SectionCard title="Project Properties" bodyClassName="px-5 py-4">
    <DetailList>
      {project.status && (
        <DetailRow label="Status">{getProjectStatusLabel(project.status)}</DetailRow>
      )}
      {project.visibility && (
        <DetailRow label="Visibility">{getProjectVisibilityLabel(project.visibility)}</DetailRow>
      )}
      {project.classification && (
        <DetailRow label="Classification">{getClassificationText(project.classification)}</DetailRow>
      )}
      {project.rdmpCurrentStep && (
        <DetailRow label="Construction step">
          <em>{getConstructionStepText(project.rdmpCurrentStep)}</em>
        </DetailRow>
      )}
      {project.libreLibrary && (
        <DetailRow label="Library">{getLibraryName(project.libreLibrary)}</DetailRow>
      )}
      {project.libreShelf && <DetailRow label="Bookshelf">{project.libreShelf}</DetailRow>}
      {project.libreCampus && <DetailRow label="Campus">{project.libreCampus}</DetailRow>}
      {Array.isArray(project.cidDescriptors) && project.cidDescriptors.length > 0 && (
        <DetailRow label="C-ID(s)">
          <BadgeList items={project.cidDescriptors.map(cidLabel)} />
        </DetailRow>
      )}
      {Array.isArray(project.tags) && project.tags.length > 0 && (
        <DetailRow label="Tags">
          <BadgeList items={project.tags.map(tagLabel)} />
        </DetailRow>
      )}
    </DetailList>
  </SectionCard>
);

export default ProjectPropertiesCard;
