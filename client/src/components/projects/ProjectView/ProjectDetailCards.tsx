import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Link, Text } from "@libretexts/davis-react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { Project } from "../../../types";
import { normalizeURL } from "../../util/HelperFunctions";
import { PROJECT_ROLE_SORT_ORDER } from "../../util/ProjectHelpers";
import { checkIsUUID } from "../../../utils/misc";
import { sanitizeMarkdown } from "../../../utils/sanitizeMarkdown";
import SectionCard from "./SectionCard";
import { DetailList, DetailRow } from "./DetailList";

export const ProjectNotesCard = ({ notes }: { notes: string }) => {
  const html = useMemo(() => sanitizeMarkdown(notes, { breaks: true }), [notes]);
  return (
    <SectionCard title="Notes" bodyClassName="px-5 py-4">
      <div
        className="prose prose-code:before:hidden prose-code:after:hidden max-w-none text-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </SectionCard>
  );
};

export const ProjectSourceCard = ({ project }: { project: Project }) => {
  const hasDetails = !!(project.author || project.authorEmail || project.license?.name);
  return (
    <SectionCard title="Source properties" bodyClassName="px-5 py-4">
      {hasDetails && (
        <DetailList>
          {project.author && <DetailRow label="Author">{project.author}</DetailRow>}
          {project.authorEmail && (
            <DetailRow label="Author email">
              <Link href={`mailto:${project.authorEmail}`} size="sm">
                {project.authorEmail}
              </Link>
            </DetailRow>
          )}
          {project.license?.name && (
            <DetailRow label="License">
              {project.license.name} {project.license.version ?? ""}
            </DetailRow>
          )}
        </DetailList>
      )}
      {(project.license?.sourceURL || checkIsUUID(project.harvestReqID)) && (
        <div className={`flex flex-col items-start gap-2 ${hasDetails ? "mt-4" : ""}`}>
          {project.license?.sourceURL && (
            <Link href={normalizeURL(project.license.sourceURL)} external size="sm">
              Resource link
            </Link>
          )}
          {checkIsUUID(project.harvestReqID) && (
            <Link
              href={`https://commons.libretexts.org/support/ticket/${project.harvestReqID}`}
              external
              size="sm"
            >
              View harvest request
            </Link>
          )}
        </div>
      )}
    </SectionCard>
  );
};

const TEAM_PREVIEW_COUNT = 5;

const ROLE_GROUPS = [
  { key: "leads", role: "lead", label: "Lead" },
  { key: "liaisons", role: "liaison", label: "Liaison" },
  { key: "members", role: "member", label: "Member" },
  { key: "auditors", role: "auditor", label: "Auditor" },
] as const;

export const ProjectTeamCard = ({ project }: { project: Project }) => {
  const [showAll, setShowAll] = useState(false);

  const team = useMemo(
    () =>
      ROLE_GROUPS.flatMap(({ key, role, label }) =>
        (project[key] ?? []).map((user) => ({
          ...user,
          name: `${user.firstName} ${user.lastName}`,
          role,
          roleDisplay: label,
        }))
      ).sort(
        (a, b) =>
          PROJECT_ROLE_SORT_ORDER[a.role] - PROJECT_ROLE_SORT_ORDER[b.role] ||
          a.name.localeCompare(b.name)
      ),
    [project]
  );

  const isLong = team.length > TEAM_PREVIEW_COUNT;
  const visible = showAll || !isLong ? team : team.slice(0, TEAM_PREVIEW_COUNT);

  return (
    <SectionCard title="Team" bodyClassName="px-5 py-4">
      <ul id="project-team-list" className="m-0 flex list-none flex-col gap-3 p-0">
        {visible.map((member) => (
          <li key={`${member.role}-${member.uuid}`} className="flex items-center gap-3">
            {/* Avatar falls back to initials from `name` when `src` is missing. */}
            <Avatar src={member.avatar || undefined} name={member.name} size="sm" />
            <Text size="sm" truncate className="min-w-0 flex-1">
              {member.name}
            </Text>
            <Badge
              label={member.roleDisplay}
              variant={member.role === "lead" ? "primary" : "default"}
              size="sm"
            />
          </li>
        ))}
      </ul>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 -ml-2"
          icon={showAll ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          iconPosition="right"
          aria-expanded={showAll}
          aria-controls="project-team-list"
          onClick={() => setShowAll((prev) => !prev)}
        >
          {showAll ? "Collapse" : "Show All Team Members"}
        </Button>
      )}
    </SectionCard>
  );
};
