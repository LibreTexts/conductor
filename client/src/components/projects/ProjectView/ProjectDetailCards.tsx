import { useMemo, useState } from "react";
import { Avatar, Card } from "@libretexts/davis-react";
import { IconExternalLink } from "@tabler/icons-react";
import { Project } from "../../../types";
import { normalizeURL } from "../../util/HelperFunctions";
import { PROJECT_ROLE_SORT_ORDER } from "../../util/ProjectHelpers";
import { sanitizeMarkdown } from "../../../utils/sanitizeMarkdown";
import CardHeading from "./CardHeading";

const FieldLabel = ({ children }: { children: string }) => (
  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 block mb-0.5">
    {children}
  </span>
);

export const ProjectNotesCard = ({ notes }: { notes: string }) => {
  const html = useMemo(() => sanitizeMarkdown(notes, { breaks: true }), [notes]);
  return (
    <Card variant="outline" padding="md">
      <Card.Body>
        <CardHeading>Notes</CardHeading>
        <div
          className="project-notes-body prose prose-code:before:hidden prose-code:after:hidden max-w-full text-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Card.Body>
    </Card>
  );
};

export const hasSourceProperties = (project: Project) =>
  !!(project.author || project.license?.sourceURL || project.license?.name);

export const ProjectSourceCard = ({ project }: { project: Project }) => (
  <Card variant="outline" padding="md">
    <Card.Body>
      <CardHeading>Source Properties</CardHeading>
      <div className="flex flex-col gap-3">
        {project.author && (
          <div>
            <FieldLabel>Author</FieldLabel>
            <span className="text-sm">{project.author}</span>
          </div>
        )}
        {project.authorEmail && (
          <div>
            <FieldLabel>Author Email</FieldLabel>
            <a
              href={`mailto:${project.authorEmail}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              {project.authorEmail}
            </a>
          </div>
        )}
        {project.license?.name && (
          <div>
            <FieldLabel>License</FieldLabel>
            <span className="text-sm">
              {project.license.name} {project.license.version ?? ""}
            </span>
          </div>
        )}
        {project.license?.sourceURL && (
          <a
            href={normalizeURL(project.license.sourceURL)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1 w-fit"
          >
            Resource Link <IconExternalLink size={13} aria-hidden="true" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        )}
      </div>
    </Card.Body>
  </Card>
);

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
    <Card variant="outline" padding="md">
      <Card.Body>
        <CardHeading>Team</CardHeading>
        <ul className="list-none m-0 p-0">
          {visible.map((member) => (
            <li
              key={`${member.role}-${member.uuid}`}
              className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-b-0"
            >
              <Avatar src={member.avatar} name={member.name} size="sm" />
              <span className="text-sm">
                {member.name} <span className="text-gray-500">({member.roleDisplay})</span>
              </span>
            </li>
          ))}
        </ul>
        {isLong && (
          <p className="text-sm text-gray-500 text-center mt-2">
            {showAll ? "Showing all team members." : "Team list collapsed for brevity."}{" "}
            <button
              type="button"
              className="text-blue-600 hover:underline"
              aria-expanded={showAll}
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Click to collapse..." : "Click to show all..."}
            </button>
          </p>
        )}
      </Card.Body>
    </Card>
  );
};
