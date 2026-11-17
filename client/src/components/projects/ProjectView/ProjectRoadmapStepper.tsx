import { useState } from "react";
import { Badge, Button, Progress, Stepper } from "@libretexts/davis-react";
import { roadmapStepsSimple } from "../../util/RoadmapOptions";

const STEPS = roadmapStepsSimple.map((s: { text: string }) => ({ label: s.text }));

/**
 * Construction step progress. Horizontal stepper on desktop, compact progress bar
 * with an expandable vertical stepper on smaller screens.
 */
const ProjectRoadmapStepper = ({ currentStep }: { currentStep: string }) => {
  const [showAllSteps, setShowAllSteps] = useState(false);

  const activeIdx = Math.max(
    0,
    roadmapStepsSimple.findIndex((s: { name: string }) => s.name === currentStep)
  );
  const activeStep = roadmapStepsSimple[activeIdx] ?? roadmapStepsSimple[0];
  const percent = Math.round(((activeIdx + 1) / roadmapStepsSimple.length) * 100);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Construction Step
          </span>
          <Badge
            label={`Step ${activeIdx + 1} of ${roadmapStepsSimple.length}: ${activeStep.text}`}
            variant="primary"
            size="sm"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="lg:hidden!"
          onClick={() => setShowAllSteps((prev) => !prev)}
          aria-expanded={showAllSteps}
        >
          {showAllSteps ? "Hide Steps" : "View All Steps"}
        </Button>
      </div>

      <div className="hidden lg:block overflow-x-auto pb-1">
        <Stepper steps={STEPS} currentStep={activeIdx} orientation="horizontal" size="sm" />
      </div>

      <div className="lg:hidden space-y-3">
        <Progress value={percent} size="sm" showValue />
        {showAllSteps && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
            <Stepper steps={STEPS} currentStep={activeIdx} orientation="vertical" size="sm" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectRoadmapStepper;
