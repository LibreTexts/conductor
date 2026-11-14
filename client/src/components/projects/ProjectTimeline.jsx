import "./Projects.css";
import "react-big-calendar/lib/css/react-big-calendar.css";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Container,
  Divider,
  EmptyState,
  Heading,
  IconButton,
  Link as DavisLink,
  Modal,
  Progress,
  Select,
  Spinner,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import {
  IconCalendar,
  IconChartBar,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconInfoCircle,
  IconMap,
  IconTimeline,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import date from "date-and-time";
import ordinal from "date-and-time/plugin/ordinal";
import day_of_week from "date-and-time/plugin/day-of-week";
import axios from "axios";

import GanttJS from "frappe-gantt";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";

import { checkCanViewProjectDetails } from "../util/ProjectHelpers";
import { roadmapSteps } from "../util/RoadmapOptions.jsx";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";

date.plugin(ordinal);
date.plugin(day_of_week);

const STATUS_BADGE_MAP = {
  completed: { label: "Completed", variant: "success", color: "#16a34a" },
  inprogress: { label: "In Progress", variant: "primary", color: "#127bc4" },
  available: { label: "Available", variant: "default", color: "#7c3aed" },
};

const GanttView = ({ viewMode, onTaskClick, onDateChange, ganttTasks }) => {
  const svgRef = useRef(null);
  const ganttInstRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !Array.isArray(ganttTasks) || ganttTasks.length === 0) {
      return;
    }
    svgRef.current.innerHTML = "";
    ganttInstRef.current = new GanttJS(svgRef.current, ganttTasks, {
      header_height: 60,
      column_width: viewMode === "Day" ? 36 : viewMode === "Week" ? 120 : 120,
      step: 24,
      view_modes: ["Day", "Week", "Month"],
      bar_height: 24,
      bar_corner_radius: 5,
      arrow_curve: 5,
      padding: 18,
      view_mode: viewMode,
      date_format: "MM-DD-YYYY",
      on_click: onTaskClick,
      on_date_change: onDateChange,
    });
  }, [ganttTasks, onTaskClick, onDateChange]);

  useEffect(() => {
    if (ganttInstRef.current) {
      ganttInstRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  return (
    <div className="timeline-gantt-wrapper rounded-lg border border-slate-200 bg-white p-2 overflow-x-auto">
      <svg ref={svgRef} />
    </div>
  );
};

const DavisCalendarToolbar = ({ label, onNavigate }) => (
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        onClick={() => onNavigate("TODAY")}
      >
        Today
      </Button>
      <IconButton
        size="sm"
        variant="outline"
        aria-label="Previous month"
        icon={<IconChevronLeft size={16} />}
        onClick={() => onNavigate("PREV")}
      />
      <IconButton
        size="sm"
        variant="outline"
        aria-label="Next month"
        icon={<IconChevronRight size={16} />}
        onClick={() => onNavigate("NEXT")}
      />
    </div>
    <Heading level={3} className="m-0! text-base font-bold text-slate-900">
      {label}
    </Heading>
    <div className="hidden sm:block w-24" />
  </div>
);

const CalendarView = ({ calendarEvents, onSelectEvent }) => {
  const locales = { "en-US": enUS };
  const localizer = useMemo(
    () => dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales }),
    []
  );

  return (
    <div className="task-calendar-container">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        views={["month"]}
        defaultDate={new Date()}
        showMultiDayTimes
        onSelectEvent={onSelectEvent}
        components={{
          toolbar: DavisCalendarToolbar,
          event: ({ event }) => (
            <span className="truncate font-semibold">{event.title}</span>
          ),
        }}
        eventPropGetter={(event) => {
          const meta = STATUS_BADGE_MAP[event.status];
          return meta
            ? { style: { backgroundColor: meta.color, color: "#ffffff" } }
            : { style: { backgroundColor: "#64748b", color: "#ffffff" } };
        }}
      />
    </div>
  );
};

const ProjectTimeline = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  const [loadingProject, setLoadingProject] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [ganttViewMode, setGanttViewMode] = useState("Day");
  const [project, setProject] = useState({});
  const [canViewDetails, setCanViewDetails] = useState(false);

  const [showRoadmap, setShowRoadmap] = useState(
    () => localStorage.getItem("conductor_show_roadmap") === "true"
  );
  const [roadmapRequiresRemix, setRoadmapRequiresRemix] = useState(null);
  const [currentRoadmapStep, setCurrentRoadmapStep] = useState("");
  const [openRoadmapStep, setOpenRoadmapStep] = useState("1");

  const [projTasks, setProjTasks] = useState([]);
  const [taskLookup, setTaskLookup] = useState({});
  const [ganttTasks, setGanttTasks] = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);
  const [selectedTaskModal, setSelectedTaskModal] = useState(null);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Projects | Project View | Timeline";
    getProject();
    getProjectTasks();
  }, [props.match.params.id]);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Timeline`;
    }
  }, [project]);

  useEffect(() => {
    if (
      typeof user.uuid === "string" &&
      user.uuid !== "" &&
      Object.keys(project).length > 0
    ) {
      setCanViewDetails(checkCanViewProjectDetails(project, user));
    }
  }, [project, user]);

  const getProject = () => {
    setLoadingProject(true);
    axios
      .get("/project", { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.project) {
            setProject(res.data.project);
            if (typeof res.data.project.rdmpReqRemix === "boolean") {
              setRoadmapRequiresRemix(res.data.project.rdmpReqRemix);
            }
            if (typeof res.data.project.rdmpCurrentStep === "string") {
              setCurrentRoadmapStep(res.data.project.rdmpCurrentStep);
              if (res.data.project.rdmpCurrentStep) {
                setOpenRoadmapStep(res.data.project.rdmpCurrentStep);
              }
            }
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingProject(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadingProject(false);
      });
  };

  const getProjectTasks = () => {
    setLoadingTasks(true);
    axios
      .get("/project/tasks", { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.tasks && Array.isArray(res.data.tasks)) {
            let flattenedSubtasks = [];
            res.data.tasks.forEach((item) => {
              if (item.subtasks && item.subtasks.length > 0) {
                item.subtasks.sort((a, b) =>
                  a.title < b.title ? -1 : a.title > b.title ? 1 : 0
                );
                flattenedSubtasks = flattenedSubtasks.concat(
                  item.subtasks.map((sub) => ({ ...sub, _isSubtask: true }))
                );
              }
            });
            res.data.tasks.sort((a, b) =>
              a.title < b.title ? -1 : a.title > b.title ? 1 : 0
            );
            const flattenedTasks = [
              ...res.data.tasks.map((t) => ({ ...t, _isSubtask: false })),
              ...flattenedSubtasks,
            ];

            const map = {};
            flattenedTasks.forEach((t) => {
              map[t.taskID] = t;
            });
            setTaskLookup(map);
            setProjTasks(res.data.tasks);

            setGanttTasks(
              flattenedTasks.map((item) => ({
                id: item.taskID,
                name: item.title,
                progress: 100,
                start: item.startDate,
                end: item.endDate,
                dependencies: (item.dependencies || []).map((d) => d.taskID),
                custom_class: `task-${item.status || "available"}${
                  item._isSubtask ? " gantt-subtask" : ""
                }`,
              }))
            );
            setCalendarTasks(
              flattenedTasks.map((item) => ({
                id: item.taskID,
                title: item.title,
                allDay: true,
                start: item.startDate
                  ? date.parse(item.startDate, "YYYY-MM-DD")
                  : new Date(),
                end: item.endDate
                  ? date.parse(item.endDate, "YYYY-MM-DD")
                  : new Date(),
                status: item.status,
              }))
            );
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingTasks(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadingTasks(false);
      });
  };

  const updateRoadmapRequiresRemix = (newValue) => {
    if (typeof newValue !== "boolean") return;
    setRoadmapRequiresRemix(newValue);
    const projData = { projectID: props.match.params.id };
    if (
      project.rdmpReqRemix !== newValue ||
      !Object.prototype.hasOwnProperty.call(project, "rdmpReqRemix")
    ) {
      projData.rdmpReqRemix = newValue;
    }
    if (Object.keys(projData).length > 1) {
      axios
        .put("/project", projData)
        .then((res) => {
          if (!res.data.err) getProject();
          else handleGlobalError(res.data.errMsg);
        })
        .catch((err) => handleGlobalError(err));
    }
  };

  const updateRoadmapStep = (newValue) => {
    if (typeof newValue !== "string") return;
    setCurrentRoadmapStep(newValue);
    const projData = { projectID: props.match.params.id };
    if (
      project.rdmpCurrentStep !== newValue ||
      !Object.prototype.hasOwnProperty.call(project, "rdmpCurrentStep")
    ) {
      projData.rdmpCurrentStep = newValue;
    }
    if (Object.keys(projData).length > 1) {
      axios
        .put("/project", projData)
        .then((res) => {
          if (!res.data.err) getProject();
          else handleGlobalError(res.data.errMsg);
        })
        .catch((err) => handleGlobalError(err));
    }
  };

  const handleGanttTaskClick = useCallback(
    (task) => {
      if (task?.id && taskLookup[task.id]) {
        setSelectedTaskModal(taskLookup[task.id]);
      }
    },
    [taskLookup]
  );

  const handleGanttTaskDateChange = useCallback(
    (task, start, end) => {
      axios
        .put("/project/task", {
          taskID: task.id,
          startDate: date.format(start, "YYYY-MM-DD"),
          endDate: date.format(end, "YYYY-MM-DD"),
        })
        .then((res) => {
          if (res.data.err) handleGlobalError(res.data.errMsg);
        })
        .catch((err) => handleGlobalError(err));
    },
    [handleGlobalError]
  );

  const handleChangeRoadmapVis = () => {
    const next = !showRoadmap;
    setShowRoadmap(next);
    localStorage.setItem("conductor_show_roadmap", String(next));
  };

  const visibleRoadmapSteps = useMemo(() => {
    if (roadmapRequiresRemix === true) {
      return roadmapSteps.filter((i) => i.key !== "6");
    }
    if (roadmapRequiresRemix === false) {
      return roadmapSteps.filter(
        (i) => i.key !== "5a" && i.key !== "5b" && i.key !== "5c"
      );
    }
    return roadmapSteps;
  }, [roadmapRequiresRemix]);

  const openRoadmapStepInfo = useMemo(
    () =>
      visibleRoadmapSteps.find((item) => item.key === openRoadmapStep) ||
      visibleRoadmapSteps[0] ||
      null,
    [visibleRoadmapSteps, openRoadmapStep]
  );

  const roadmapProgressPercent = useMemo(() => {
    if (!currentRoadmapStep || visibleRoadmapSteps.length === 0) return 0;
    const idx = visibleRoadmapSteps.findIndex(
      (s) => s.key === currentRoadmapStep
    );
    if (idx < 0) return 0;
    return Math.round(((idx + 1) / visibleRoadmapSteps.length) * 100);
  }, [visibleRoadmapSteps, currentRoadmapStep]);

  const currentStepInfo = useMemo(
    () => visibleRoadmapSteps.find((s) => s.key === currentRoadmapStep),
    [visibleRoadmapSteps, currentRoadmapStep]
  );

  const taskStats = useMemo(() => {
    const all = Object.values(taskLookup);
    return {
      total: all.length,
      completed: all.filter((t) => t.status === "completed").length,
      inprogress: all.filter((t) => t.status === "inprogress").length,
      available: all.filter((t) => t.status === "available").length,
    };
  }, [taskLookup]);

  const isLoading = loadingProject || loadingTasks;

  return (
    <Container size="2xl" className="py-6">
      <Stack direction="vertical" gap="lg">
        {/* Top Breadcrumb & Header */}
        <div>
          <Breadcrumb className="mb-2">
            <Breadcrumb.Item>
              <Link to="/projects">Projects</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Link to={`/projects/${project.projectID || props.match.params.id}`}>
                {project.title || "Loading..."}
              </Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>Timeline</Breadcrumb.Item>
          </Breadcrumb>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Heading level={1} className="m-0! text-2xl font-bold text-slate-900">
                Timeline{project.title ? `: ${project.title}` : ""}
              </Heading>
              <Text size="sm" color="muted" className="mt-1 block">
                Track your Construction Roadmap milestones alongside project tasks
                on an interactive Gantt chart or calendar.
              </Text>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                label={`${taskStats.total} ${
                  taskStats.total === 1 ? "Task" : "Tasks"
                }`}
                variant="primary"
                size="sm"
              />
              {taskStats.completed > 0 && (
                <Badge
                  label={`${taskStats.completed} Completed`}
                  variant="success"
                  size="sm"
                />
              )}
              {taskStats.inprogress > 0 && (
                <Badge
                  label={`${taskStats.inprogress} In Progress`}
                  variant="primary"
                  size="sm"
                />
              )}
            </div>
          </div>
        </div>

        {/* Construction Roadmap Card */}
        {!canViewDetails && !isLoading ? (
          <Alert
            variant="info"
            title="Construction Roadmap"
            message="You don't have permission to view this project's Construction Roadmap yet."
          />
        ) : (
          <Card variant="outline" padding="none" className="bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <IconMap size={20} className="text-primary" />
                <Heading
                  level={2}
                  className="m-0! text-base font-semibold text-slate-900"
                >
                  Construction Roadmap
                </Heading>
                {currentStepInfo ? (
                  <Badge
                    label={`Current: ${currentStepInfo.title}${
                      currentStepInfo.name ? ` — ${currentStepInfo.name}` : ""
                    }`}
                    variant="primary"
                    size="sm"
                    dot
                  />
                ) : (
                  <Badge label="No step selected" variant="default" size="sm" />
                )}
              </div>

              <div className="flex items-center gap-3">
                {currentStepInfo && (
                  <div className="hidden sm:block w-36">
                    <Progress
                      value={roadmapProgressPercent}
                      size="sm"
                      variant={
                        roadmapProgressPercent === 100 ? "success" : "default"
                      }
                      showValue
                    />
                  </div>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleChangeRoadmapVis}
                >
                  {showRoadmap ? "Hide" : "Show"}
                </Button>
              </div>
            </div>

            {showRoadmap && (
              <>
                <Divider />
                {loadingProject ? (
                  <div className="flex justify-center py-10">
                    <Spinner size="md" />
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row">
                    {/* Left Steps List */}
                    <div className="w-full shrink-0 border-b border-slate-200 bg-slate-50/60 p-3 lg:w-80 lg:border-r lg:border-b-0">
                      <Text
                        size="xs"
                        weight="semibold"
                        color="muted"
                        className="mb-2 block px-1 uppercase tracking-wide"
                      >
                        Roadmap Steps
                      </Text>
                      <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                        {visibleRoadmapSteps.map((item) => {
                          const disabled =
                            ["5a", "5b", "5c", "6"].includes(item.key) &&
                            roadmapRequiresRemix === null;
                          const isOpen =
                            openRoadmapStepInfo?.key === item.key;
                          const isCurrent = currentRoadmapStep === item.key;

                          return (
                            <div
                              key={item.key}
                              onClick={() =>
                                !disabled && setOpenRoadmapStep(item.key)
                              }
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                                disabled
                                  ? "cursor-not-allowed border-transparent bg-slate-100/70 opacity-50"
                                  : isOpen
                                  ? "cursor-pointer border-primary bg-white shadow-xs ring-1 ring-primary/20"
                                  : "cursor-pointer border-transparent bg-white/80 hover:border-slate-200 hover:bg-white"
                              }`}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                <button
                                  type="button"
                                  disabled={disabled}
                                  aria-label={`Mark ${item.title} as current step`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!disabled) updateRoadmapStep(item.key);
                                  }}
                                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                    isCurrent
                                      ? "border-primary bg-primary text-white"
                                      : "border-slate-300 bg-white text-transparent hover:border-primary"
                                  }`}
                                >
                                  <IconCheck size={12} />
                                </button>
                                <div className="min-w-0 flex-1">
                                  <Text
                                    size="sm"
                                    weight={isOpen ? "semibold" : "medium"}
                                    truncate
                                    className="block text-slate-900"
                                  >
                                    {item.title}
                                    {item.name ? `: ${item.name}` : ""}
                                  </Text>
                                  {item.optional && (
                                    <Text size="xs" color="muted">
                                      Optional
                                    </Text>
                                  )}
                                </div>
                              </div>
                              {isCurrent ? (
                                <Badge label="Current" variant="primary" size="sm" />
                              ) : (
                                <IconChevronRight
                                  size={15}
                                  className="shrink-0 text-slate-400"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right Step Detail Pane */}
                    <div className="min-w-0 flex-1 p-5">
                      {openRoadmapStepInfo ? (
                        <Stack direction="vertical" gap="md">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Heading
                                level={3}
                                className="m-0! text-lg font-bold text-slate-900"
                              >
                                {openRoadmapStepInfo.title}
                                {openRoadmapStepInfo.name
                                  ? `: ${openRoadmapStepInfo.name}`
                                  : ""}
                              </Heading>
                              {openRoadmapStepInfo.optional && (
                                <Badge label="Optional" variant="default" size="sm" />
                              )}
                            </div>

                            <Button
                              size="sm"
                              variant={
                                currentRoadmapStep === openRoadmapStepInfo.key
                                  ? "secondary"
                                  : "outline"
                              }
                              icon={<IconCircleCheck size={15} />}
                              onClick={() =>
                                updateRoadmapStep(openRoadmapStepInfo.key)
                              }
                            >
                              {currentRoadmapStep === openRoadmapStepInfo.key
                                ? "Current Step"
                                : "Set as Current Step"}
                            </Button>
                          </div>

                          <Divider />

                          <div className="timeline-roadmap-body text-sm">
                            {openRoadmapStepInfo.description}
                          </div>

                          {openRoadmapStepInfo.hasExtra &&
                            openRoadmapStepInfo.linkHref && (
                              <div>
                                <DavisLink
                                  href={openRoadmapStepInfo.linkHref}
                                  external
                                  className="text-sm font-semibold"
                                >
                                  {openRoadmapStepInfo.linkTitle}
                                </DavisLink>
                              </div>
                            )}

                          {openRoadmapStepInfo.key === "4" && (
                            <Card
                              variant="outline"
                              padding="md"
                              className="bg-slate-50"
                            >
                              <Text
                                size="sm"
                                weight="semibold"
                                className="mb-2.5 block text-slate-900"
                              >
                                Does your project require remixing existing
                                content?
                              </Text>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant={
                                    roadmapRequiresRemix === true
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    updateRoadmapRequiresRemix(true)
                                  }
                                >
                                  Yes — Show Remixing Steps (5a–5c)
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    roadmapRequiresRemix === false
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() =>
                                    updateRoadmapRequiresRemix(false)
                                  }
                                >
                                  No — Show Skeleton Step (6)
                                </Button>
                              </div>
                            </Card>
                          )}
                        </Stack>
                      ) : (
                        <EmptyState
                          icon={<IconMap size={28} />}
                          title="Select a roadmap step"
                          description="Choose any step on the left to view guidance and update your current milestone."
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {/* Timeline Workspace Card */}
        <Card
          variant="outline"
          padding="lg"
          className="overflow-visible! bg-white"
        >
          <Stack direction="vertical" gap="md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <IconTimeline size={20} className="text-primary" />
                <div>
                  <Heading
                    level={2}
                    className="m-0! text-lg font-semibold text-slate-900"
                  >
                    Project Schedule
                  </Heading>
                  <Text size="xs" color="muted" className="block">
                    Drag task bars in Gantt View to adjust dates, or click any
                    task to inspect details.
                  </Text>
                </div>
              </div>

              {/* Task Status & Bar Legend */}
              <div className="flex flex-col items-start gap-1.5 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <Text size="xs" weight="semibold" color="muted">
                    Task Status:
                  </Text>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: "#7c3aed" }}
                      aria-hidden="true"
                    />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: "#127bc4" }}
                      aria-hidden="true"
                    />
                    In Progress
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: "#16a34a" }}
                      aria-hidden="true"
                    />
                    Completed
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-violet-500 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800">
                    Subtask
                  </span>
                  <Tooltip
                    placement="top"
                    content="Missing a start or end date — shown in grey dashed style regardless of status."
                  >
                    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-400 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 cursor-help">
                      Missing Dates
                      <IconInfoCircle size={12} className="text-slate-400" />
                    </span>
                  </Tooltip>
                </div>
                <Text size="xs" color="muted">
                  Note: Tasks or subtasks missing a start or due date show as grey
                  dashed bars regardless of status.
                </Text>
              </div>
            </div>

            <Divider />

            {loadingTasks ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12">
                <Spinner size="lg" />
                <Text size="sm" color="muted">
                  Loading project schedule...
                </Text>
              </div>
            ) : projTasks.length === 0 ? (
              <EmptyState
                icon={<IconCalendar size={32} />}
                title="No tasks scheduled yet"
                description="Tasks with start and due dates in this project will appear on your Gantt chart and calendar."
                action={
                  <Button
                    as={Link}
                    to={`/projects/${project.projectID || props.match.params.id}`}
                    size="sm"
                    variant="outline"
                  >
                    Back to Project Overview
                  </Button>
                }
              />
            ) : (
              <Tabs
                variant="pills"
                size="sm"
                color="primary"
                selectedIndex={activeTab}
                onChange={setActiveTab}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <Tabs.List>
                    <Tabs.Tab>
                      <span className="inline-flex items-center gap-1.5">
                        <IconChartBar size={15} />
                        <span>Gantt View</span>
                      </span>
                    </Tabs.Tab>
                    <Tabs.Tab>
                      <span className="inline-flex items-center gap-1.5">
                        <IconCalendar size={15} />
                        <span>Calendar View</span>
                      </span>
                    </Tabs.Tab>
                  </Tabs.List>

                  {activeTab === 0 && (
                    <div className="timeline-granularity-select flex items-center gap-2">
                      <Text size="xs" weight="semibold" color="muted">
                        Scale:
                      </Text>
                      <Select
                        name="ganttViewMode"
                        label="Gantt time scale"
                        labelClassName="sr-only"
                        size="sm"
                        options={[
                          { value: "Day", label: "Day" },
                          { value: "Week", label: "Week" },
                          { value: "Month", label: "Month" },
                        ]}
                        value={ganttViewMode}
                        onChange={(e) => setGanttViewMode(e.target.value)}
                        disabled={!ganttTasks.length}
                        className="w-36"
                        selectClassName="h-9! py-1! text-sm!"
                      />
                    </div>
                  )}
                </div>

                <Tabs.Panels>
                  <Tabs.Panel>
                    {activeTab === 0 && (
                      <GanttView
                        viewMode={ganttViewMode}
                        onTaskClick={handleGanttTaskClick}
                        onDateChange={handleGanttTaskDateChange}
                        ganttTasks={ganttTasks}
                      />
                    )}
                  </Tabs.Panel>
                  <Tabs.Panel>
                    {activeTab === 1 && (
                      <CalendarView
                        calendarEvents={calendarTasks}
                        onSelectEvent={(ev) =>
                          ev?.id &&
                          taskLookup[ev.id] &&
                          setSelectedTaskModal(taskLookup[ev.id])
                        }
                      />
                    )}
                  </Tabs.Panel>
                </Tabs.Panels>
              </Tabs>
            )}
          </Stack>
        </Card>

        {/* Task Details Modal on Gantt / Calendar Click */}
        <Modal
          open={Boolean(selectedTaskModal)}
          onClose={() => setSelectedTaskModal(null)}
          size="md"
        >
          <Modal.Header>
            <Modal.Title>
              {selectedTaskModal?.title || "Task Details"}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedTaskModal && (
              <Stack direction="vertical" gap="md">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    label={
                      STATUS_BADGE_MAP[selectedTaskModal.status]?.label ||
                      selectedTaskModal.status ||
                      "Task"
                    }
                    variant={
                      STATUS_BADGE_MAP[selectedTaskModal.status]?.variant ||
                      "default"
                    }
                    size="sm"
                    dot
                  />
                  {selectedTaskModal.startDate && (
                    <Badge
                      label={`Start: ${selectedTaskModal.startDate}`}
                      variant="default"
                      size="sm"
                    />
                  )}
                  {selectedTaskModal.endDate && (
                    <Badge
                      label={`Due: ${selectedTaskModal.endDate}`}
                      variant="default"
                      size="sm"
                    />
                  )}
                </div>

                {selectedTaskModal.description ? (
                  <Card variant="outline" padding="sm" className="bg-slate-50">
                    <Text size="sm" className="whitespace-pre-wrap text-slate-700">
                      {selectedTaskModal.description}
                    </Text>
                  </Card>
                ) : (
                  <Text size="sm" color="muted">
                    No description provided for this task.
                  </Text>
                )}
              </Stack>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedTaskModal(null)}
              >
                Close
              </Button>
              <Button
                as={Link}
                to={`/projects/${project.projectID || props.match.params.id}`}
                variant="primary"
              >
                Manage Tasks on Project Page
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
      </Stack>
    </Container>
  );
};

export default ProjectTimeline;
