import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";
import SkeletonBone from "../../SkeletonBone";

const CardShell = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-lg border border-neutral-200 bg-surface shadow-sm ${className}`}>
    {children}
  </div>
);

const CardHeaderBones = ({ titleWidth, action }: { titleWidth: string; action?: ReactNode }) => (
  <div className="flex min-h-[60px] items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
    <SkeletonBone className={`h-4 ${titleWidth}`} />
    {action}
  </div>
);

const TileBones = ({ count, cols }: { count: number; cols: string }) => (
  <div className={`grid grid-cols-2 gap-2 p-4 ${cols}`}>
    {Array.from({ length: count }).map((_, idx) => (
      <div
        key={idx}
        className="flex min-h-[84px] flex-col items-start gap-2 rounded-md border border-neutral-200 p-3 sm:min-h-[52px] sm:flex-row sm:items-center sm:gap-3 sm:py-2.5"
      >
        <SkeletonBone shape="control" className="size-8 shrink-0" />
        <SkeletonBone className={`h-3 ${idx % 2 ? "w-3/5" : "w-4/5"}`} />
      </div>
    ))}
  </div>
);

const PROPERTY_WIDTHS = ["w-16", "w-14", "w-20", "w-16", "w-12"];
const TEAM_WIDTHS = ["w-32", "w-28", "w-36"];

/**
 * Full-page placeholder shown until the project loads, in the final layout so
 * the page doesn't jump. Only the static "Projects" crumb renders for real.
 */
const ProjectViewSkeleton = () => (
  <div className="flex flex-col gap-6" aria-busy="true">
    <p role="status" className="sr-only">
      Loading project…
    </p>
    <div aria-hidden="true" className="contents">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <div className="flex w-full max-w-2xl items-center gap-3">
              <SkeletonBone className="h-8 w-full max-w-md" />
              <SkeletonBone shape="round" className="h-6 w-24 shrink-0" />
              <SkeletonBone shape="round" className="h-6 w-18 shrink-0" />
            </div>
            <div className="flex items-center gap-3 max-sm:hidden">
              <SkeletonBone className="h-3 w-40" />
              <SkeletonBone shape="control" className="h-8 w-28" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Link to="/projects" tabIndex={-1} className="text-gray-500">
              Projects
            </Link>
            <IconChevronRight size={14} className="text-gray-400" />
            <SkeletonBone className="h-3 w-48" />
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <SkeletonBone shape="control" primary className="h-11 w-full sm:h-9 sm:w-36" />
          <div className="grid grid-cols-5 gap-2 sm:flex">
            {["sm:w-32", "sm:w-26", "sm:w-24", "sm:w-28", "sm:w-28"].map((w, idx) => (
              <SkeletonBone key={idx} shape="control" className={`h-11 sm:h-9 ${w}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <CardShell className="flex-[1_1_400px]">
          <CardHeaderBones
            titleWidth="w-36"
            action={<SkeletonBone shape="control" primary className="h-8 w-36 max-sm:hidden" />}
          />
          <TileBones count={4} cols="" />
        </CardShell>
        <CardShell className="flex-[1.5_1_560px]">
          <CardHeaderBones titleWidth="w-40" />
          <TileBones count={6} cols="sm:grid-cols-3" />
        </CardShell>
      </div>

      <div className="flex flex-wrap gap-6">
        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-6 lg:order-2">
          <CardShell>
            <CardHeaderBones titleWidth="w-36" />
            <div className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-4 px-5 py-4">
              {PROPERTY_WIDTHS.map((w, idx) => (
                <div key={idx} className="contents">
                  <SkeletonBone className={`h-3 ${w}`} />
                  <SkeletonBone className={`h-3 ${idx % 2 ? "w-20" : "w-28"}`} />
                </div>
              ))}
            </div>
          </CardShell>
          <CardShell className="max-sm:hidden">
            <CardHeaderBones titleWidth="w-16" />
            <div className="flex flex-col gap-3 px-5 py-4">
              {TEAM_WIDTHS.map((w, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <SkeletonBone shape="round" className="size-8 shrink-0" />
                  <SkeletonBone className={`h-3 ${w}`} />
                  <SkeletonBone shape="round" className="ml-auto h-6 w-14" />
                </div>
              ))}
            </div>
          </CardShell>
        </aside>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-6 lg:order-1">
          <CardShell>
            <CardHeaderBones titleWidth="w-28" action={<SkeletonBone shape="control" className="h-8 w-16" />} />
            <div className="grid h-80 grid-cols-1 sm:grid-cols-[260px_1fr]">
              <div className="flex flex-col gap-4 border-neutral-200 p-4 sm:border-r">
                <SkeletonBone className="h-3 w-16" />
                {["w-40", "w-32", "w-36"].map((w, idx) => (
                  <div key={idx} className="flex flex-col gap-2">
                    <SkeletonBone className={`h-3 ${w}`} />
                    <SkeletonBone className="h-2.5 w-full" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-5 p-5 max-sm:hidden">
                {[3, 2].map((lines, idx) => (
                  <div key={idx} className="flex gap-3">
                    <SkeletonBone shape="round" className="size-8 shrink-0" />
                    <div className="flex flex-1 flex-col gap-2">
                      <SkeletonBone className="h-3 w-40" />
                      <SkeletonBone className="h-2.5 w-4/5" />
                      {lines > 2 && <SkeletonBone className="h-2.5 w-3/5" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardShell>
          <CardShell className="max-sm:hidden">
            <CardHeaderBones titleWidth="w-24" action={<SkeletonBone shape="control" className="h-8 w-16" />} />
            {["w-72", "w-56", "w-64"].map((w, idx) => (
              <div key={idx} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-4 last:border-b-0">
                <SkeletonBone shape="control" className="size-4" />
                <SkeletonBone shape="control" className="size-5" />
                <SkeletonBone className={`h-3 ${w}`} />
                <SkeletonBone className="ml-auto h-3 w-24" />
              </div>
            ))}
          </CardShell>
        </div>
      </div>
    </div>
  </div>
);

export default ProjectViewSkeleton;
