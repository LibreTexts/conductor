import type { ReactNode } from "react";
import classNames from "classnames";
import { Heading, Text } from "@libretexts/davis-react";

interface SectionCardProps {
  /** Anchor target. Also makes the card focusable, for in-page navigation. */
  id?: string;
  title: ReactNode;
  /** Rendered on the right side of the header row. */
  actions?: ReactNode;
  /** Secondary line under the title. */
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  "aria-busy"?: boolean;
}

/**
 * Card shell for the project view: a header row (title left, actions right) over
 * a body. Omit children for a single-row collapsed card.
 */
const SectionCard = ({
  id,
  title,
  actions,
  description,
  children,
  className,
  bodyClassName,
  "aria-busy": ariaBusy,
}: SectionCardProps) => (
  <section
    id={id}
    tabIndex={id ? -1 : undefined}
    aria-labelledby={id ? `${id}-heading` : undefined}
    className={classNames(
      "rounded-lg border border-neutral-200 bg-surface shadow-sm",
      id && "scroll-mt-6 focus:outline-none",
      className
    )}
    aria-busy={ariaBusy || undefined}
  >
    <div
      className={classNames(
        "flex min-h-[60px] items-center justify-between gap-3 px-5 py-3",
        children !== undefined && "border-b border-neutral-200"
      )}
    >
      <div className="min-w-0">
        <Heading as="h2" level={5} id={id ? `${id}-heading` : undefined} className="m-0!">
          {title}
        </Heading>
        {description && (
          <Text as="p" size="sm" color="muted" className="m-0 mt-0.5">
            {description}
          </Text>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    {children !== undefined && <div className={bodyClassName}>{children}</div>}
  </section>
);

export default SectionCard;
