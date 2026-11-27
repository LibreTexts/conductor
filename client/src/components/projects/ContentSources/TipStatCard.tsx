import { Tooltip } from "@libretexts/davis-react";
import classNames from "classnames";
import type { PageNodeKind } from "../../../types/ContentSources";
import { KindSwatch } from "./kindViz";

type TipStatCardProps = {
  label: string;
  value: string;
  /** What the number means, shown on hover or focus and read as the card's description. */
  tip: string;
  /** The page kind it counts: shows that kind's pie swatch (color and texture). */
  kind?: PageNodeKind;
  variant?: "default" | "danger";
};

/**
 * A compact stat card that explains itself in a tooltip, on hover or keyboard
 * focus. It's a named group ("Copy-Fork: 3") that screen readers announce with
 * the tooltip text as its description (`aria-describedby`, set by Davis'
 * Tooltip), whether or not the tooltip is showing. Smaller than Davis'
 * StatCard, which has no compact size, so a row of seven fits.
 */
const TipStatCard: React.FC<TipStatCardProps> = ({ label, value, tip, kind, variant = "default" }) => (
  <Tooltip content={tip} placement="bottom" className="flex w-full">
    <div
      role="group"
      aria-label={`${label}: ${value}`}
      tabIndex={0}
      className={classNames(
        "w-full rounded-lg border bg-white px-3 py-2 shadow-sm transition-shadow hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        variant === "danger" ? "border-red-300 bg-red-50" : "border-neutral-200",
      )}
    >
      <div className="flex items-center gap-1.5">
        {kind && <KindSwatch kind={kind} size={12} />}
        <span
          className={classNames(
            "truncate text-xs font-medium",
            variant === "danger" ? "text-red-800" : "text-neutral-600",
          )}
        >
          {label}
        </span>
      </div>
      <div
        className={classNames(
          "mt-0.5 text-xl font-semibold leading-tight tabular-nums",
          variant === "danger" ? "text-red-800" : "text-neutral-900",
        )}
      >
        {value}
      </div>
    </div>
  </Tooltip>
);

export default TipStatCard;
