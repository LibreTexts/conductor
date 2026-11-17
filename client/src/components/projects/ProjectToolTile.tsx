import type { ReactNode } from "react";
import classNames from "classnames";
import { IconExternalLink } from "@tabler/icons-react";

interface ProjectToolTileProps {
  icon: ReactNode;
  label: ReactNode;
  /** Opens `href` in a new tab and shows the external-link glyph. */
  external?: boolean;
  href?: string;
  onClick?: () => void;
  /** Rendered after the label, e.g. a "New" or "Admins only" badge. */
  badge?: ReactNode;
  /** Grey icon box for de-emphasized tools (e.g. legacy versions). */
  muted?: boolean;
}

const TILE_CLASSES = [
  "group relative flex w-full flex-col items-start gap-2 min-h-[84px] p-3 text-left",
  "sm:flex-row sm:items-center sm:gap-3 sm:min-h-[52px] sm:py-2.5",
  "rounded-md border border-gray-300 bg-surface text-sm font-medium text-gray-700 no-underline!",
  "hover:bg-surface-hover hover:border-gray-500 hover:text-gray-700",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
  "transition-colors",
].join(" ");

/**
 * A full-width action tile for the project view's Important Actions and
 * Co-Authoring Tools cards. Stacks icon over label on mobile.
 */
const ProjectToolTile = ({
  icon,
  label,
  external = false,
  href,
  onClick,
  badge,
  muted = false,
}: ProjectToolTileProps) => {
  const content = (
    <>
      <span
        className={classNames(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          muted ? "bg-gray-100 text-gray-500" : "bg-primary-50 text-primary-500"
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 pr-5 sm:pr-0">
        <span>{label}</span>
        {badge}
      </span>
      {external && (
        <>
          <IconExternalLink
            size={14}
            aria-hidden="true"
            className="absolute right-3 top-3 shrink-0 text-gray-500 sm:static"
          />
          <span className="sr-only">(opens in new tab)</span>
        </>
      )}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={TILE_CLASSES}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={TILE_CLASSES} onClick={onClick}>
      {content}
    </button>
  );
};

export default ProjectToolTile;
