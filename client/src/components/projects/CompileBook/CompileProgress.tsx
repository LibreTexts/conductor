import { Progress } from "@libretexts/davis-react";

interface CompileProgressProps {
  /** Completion percentage from Shapeshift, absent until it starts reporting. */
  progress?: number;
  /** Matches the Davis `Progress` size so the shimmer lines up with the bar. */
  size?: "sm" | "md";
  /**
   * What the bar says it is doing. Also its accessible name, so it has to
   * describe the actual phase: a finalizing pane labelled "Compiling"
   * contradicts its own heading.
   */
  label?: string;
}

/** Bar heights Davis renders for each size, used to place the shimmer overlay. */
const BAR_HEIGHT: Record<"sm" | "md", string> = {
  sm: "h-1",
  md: "h-2",
};

/**
 * The compile progress bar, shared by the status bar and the empty state.
 *
 * Shapeshift reports a percentage per phase, not continuously, so a long phase
 * like "Rendering math" parks the bar on one number for minutes. The sweep is
 * what keeps it reading as live; the elapsed counter that backs it up belongs
 * to the call sites, which each have their own place to put text.
 */
const CompileProgress: React.FC<CompileProgressProps> = ({
  progress,
  size = "md",
  label = "Compiling",
}) => (
  <div className="relative w-full">
    {/*
      `progress` is passed straight through: Shapeshift does not report a
      percentage for every job or from the moment one is accepted, and an
      undefined value renders Davis's indeterminate bar rather than a fabricated
      zero.
    */}
    <Progress value={progress} size={size} showValue label={label} />
    {/*
      Decoration only — it carries nothing the percentage and the elapsed
      counter do not, so it is hidden from the accessibility tree and from
      anyone who asked for less motion. Placed against Davis's public `size`
      prop, never its internal class names.
    */}
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden rounded-full motion-reduce:hidden ${BAR_HEIGHT[size]}`}
    >
      <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  </div>
);

export default CompileProgress;
