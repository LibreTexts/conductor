import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  Container,
  Divider,
  EmptyState,
  Heading,
  Input,
  Link as DavisLink,
  Modal,
  Pagination,
  Progress,
  Spinner,
  Stack,
  Tabs,
  Text,
  Tooltip,
} from "@libretexts/davis-react";
import {
  IconChecklist,
  IconInfoCircle,
  IconLayoutGrid,
  IconMessageCircle,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import axios from "axios";

import Messaging from "../Messaging";
import { isEmptyString } from "../util/HelperFunctions.js";
import {
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
} from "../util/ProjectHelpers";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";

const ACCESSIBILITY_CATEGORIES = [
  {
    id: "navigation",
    label: "Navigation",
    criteria: [
      {
        field: "navKeyboard",
        question: "Can you use the keyboard to access all content displayed?",
      },
    ],
  },
  {
    id: "images",
    label: "Images",
    criteria: [
      {
        field: "imgAltText",
        question: "Do all images have meaningful alt text?",
      },
      {
        field: "imgDecorative",
        question:
          "For images not requiring alt text, is it marked as decorative?",
      },
      {
        field: "imgShortAlt",
        question:
          "Is all alt text under 150 characters? (Consider a caption instead)",
      },
    ],
  },
  {
    id: "links",
    label: "Links",
    criteria: [
      { field: "linkNoneEmpty", question: "Removed all empty links?" },
      {
        field: "linkSuspicious",
        question: "Removed all Suspicious Link Text?",
      },
      {
        field: "linkExtLabeled",
        question:
          "Are URLs outside of LibreTexts labelled properly? (third party URL destination)",
      },
    ],
  },
  {
    id: "contrast",
    label: "Contrast",
    criteria: [
      {
        field: "contrastSmall",
        question: "Is text contrast 4.5:1 for text 18pt and smaller?",
      },
      {
        field: "contrastLarge",
        question: "Is text contrast 3:1 for text over 18pt?",
      },
      {
        field: "contrastButtons",
        question: "Do graphical links/buttons have 3:1 contrast ratio?",
      },
    ],
  },
  {
    id: "text",
    label: "Text",
    criteria: [
      { field: "textSize", question: "Is all text larger than 10pt?" },
      {
        field: "textLineHeight",
        question:
          "Alter text size? Keep line height at least 1.5 times the font size.",
      },
      {
        field: "textParSpacing",
        question:
          "Alter text size? Spacing following paragraphs is 2x the font size.",
      },
      {
        field: "textLetterSpacing",
        question:
          "Alter text size? Letter spacing is 0.12 times the font size.",
      },
      {
        field: "textWordSpacing",
        question: "Alter text size? Word spacing is 0.16 times the font size.",
      },
    ],
  },
  {
    id: "headings",
    label: "Headings",
    criteria: [
      { field: "headingNoneEmpty", question: "There are no empty headings" },
      { field: "headingOutline", question: "Heading Outline" },
    ],
  },
  {
    id: "forms",
    label: "Forms",
    criteria: [
      { field: "formFieldLabels", question: "Do form fields have a label?" },
      {
        field: "formNavRadio",
        question: "Can you navigate questions and answered radio buttons?",
      },
    ],
  },
  {
    id: "tables",
    label: "Tables",
    criteria: [
      {
        field: "tableHeaders",
        question: "Do tables have column and row headers?",
      },
      { field: "tableLabel", question: "Are the tables labeled?" },
      {
        field: "tableNotImage",
        question: "No tables are embedded as images",
      },
    ],
  },
  {
    id: "lists",
    label: "Lists",
    criteria: [
      {
        field: "listOlLabel",
        question: "Are ordered lists properly labeled?",
      },
      {
        field: "listUlLabel",
        question: "Are unordered lists properly labeled?",
      },
    ],
  },
  {
    id: "documents",
    label: "Documents",
    criteria: [
      {
        field: "docLinkFile",
        question:
          "Does document link make sense and followed up with (FILETYPE)?",
      },
      { field: "docAccess", question: "Is the document accessible?" },
    ],
  },
  {
    id: "multimedia",
    label: "Multimedia",
    criteria: [
      { field: "multiCaption", question: "Does the video have captions?" },
      {
        field: "multiNavControls",
        question: "Can you navigate the video player controls?",
      },
      {
        field: "multiAudioTrans",
        question: "If no transcript, does the audio have a transcript?",
      },
      {
        field: "multiAudioDescrip",
        question:
          "Does the video have audio descriptions or a media alternative if necessary?",
      },
    ],
  },
  {
    id: "div",
    label: "DIV",
    criteria: [
      {
        field: "divSection",
        question: "All DIV boxes are converted to SECTION LANDSCAPE",
      },
    ],
  },
  {
    id: "sensory",
    label: "Sensory Characteristics",
    criteria: [
      {
        field: "senseInstruction",
        question:
          "Instructions provided for interactive content do not rely solely on shape, color, size, visual location, orientation, or sound",
      },
    ],
  },
  {
    id: "timing",
    label: "Timing",
    criteria: [
      {
        field: "timingCriteria",
        question: "Time limits meet criteria",
        helperText:
          "If time limits have been set, at least one must be true: ability to turn off, adjust, or extend; real-time exception; essential exception; or 20-hour exception.",
      },
    ],
  },
  {
    id: "code",
    label: "Computer Code",
    criteria: [
      {
        field: "codeAltText",
        question:
          "Inserting code for review? Ensure that characters and spaces are included as alt text for screenreaders.",
      },
    ],
  },
];

const ALL_CRITERIA = ACCESSIBILITY_CATEGORIES.flatMap((cat) =>
  cat.criteria.map((c) => ({ ...c, categoryId: cat.id, categoryLabel: cat.label }))
);
const TOTAL_CRITERIA_COUNT = ALL_CRITERIA.length;

function countCompletedInSection(section) {
  if (!section) return 0;
  return ALL_CRITERIA.reduce(
    (sum, item) => sum + (section[item.field] ? 1 : 0),
    0
  );
}

const ProjectAccessibility = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  const [loadingData, setLoadingData] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(
    () => localStorage.getItem("conductor_show_a11ydiscussion") === "true"
  );
  const [project, setProject] = useState({});
  const [reviewSections, setReviewSections] = useState([]);
  const [canViewDetails, setCanViewDetails] = useState(false);

  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionSearch, setSectionSearch] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [matrixCategoryId, setMatrixCategoryId] = useState("all");
  const [matrixPage, setMatrixPage] = useState(1);
  const MATRIX_PAGE_SIZE = 12;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addNameErr, setAddNameErr] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const [showSyncTOCModal, setShowSyncTOCModal] = useState(false);
  const [syncTOCLoading, setSyncTOCLoading] = useState(false);

  useEffect(() => {
    document.title =
      "LibreTexts Conductor | Projects | Project View | Accessibility Remediation";
    getProject();
  }, [props.match.params.id]);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Accessibility Remediation`;
    }
  }, [project]);

  useEffect(() => {
    if (
      typeof user.uuid === "string" &&
      user.uuid !== "" &&
      Object.keys(project).length > 0
    ) {
      if (
        checkProjectAdminPermission(project, user) ||
        checkProjectMemberPermission(project, user)
      ) {
        setCanViewDetails(true);
      } else {
        setCanViewDetails(checkCanViewProjectDetails(project, user));
      }
    }
  }, [project, user]);

  useEffect(() => {
    if (canViewDetails) {
      getReviewSections();
    }
  }, [canViewDetails]);

  useEffect(() => {
    if (reviewSections.length === 0) {
      setSelectedSectionId(null);
      return;
    }
    const exists = reviewSections.some((s) => s._id === selectedSectionId);
    if (!exists) {
      setSelectedSectionId(reviewSections[0]._id);
    }
  }, [reviewSections, selectedSectionId]);

  const getProject = () => {
    setLoadingData(true);
    axios
      .get("/project", { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.project) setProject(res.data.project);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadingData(false);
      });
  };

  const getReviewSections = () => {
    setLoadingData(true);
    axios
      .get("/project/accessibility/sections", {
        params: { projectID: props.match.params.id },
      })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.a11yReview) setReviewSections(res.data.a11yReview);
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      })
      .catch((err) => {
        handleGlobalError(err);
        setLoadingData(false);
      });
  };

  const addSection = () => {
    const trimmed = addName.trim();
    if (!isEmptyString(trimmed) && trimmed.length < 150) {
      setAddNameErr(false);
      setAddLoading(true);
      axios
        .post("/project/accessibility/section", {
          projectID: props.match.params.id,
          sectionTitle: trimmed,
        })
        .then((res) => {
          if (!res.data.err) {
            closeAddModal();
            getReviewSections();
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setAddLoading(false);
        })
        .catch((err) => {
          handleGlobalError(err);
          setAddLoading(false);
        });
    } else {
      setAddNameErr(true);
    }
  };

  const updateSectionItem = (sectionID, itemName, newValue) => {
    // Optimistically reflect checkbox state immediately, rollback on failure
    setReviewSections((prev) =>
      prev.map((item) =>
        item._id === sectionID ? { ...item, [itemName]: newValue } : item
      )
    );
    axios
      .put("/project/accessibility/section/item", {
        projectID: props.match.params.id,
        sectionID,
        itemName,
        newResponse: newValue,
      })
      .then((res) => {
        if (res.data.err) {
          setReviewSections((prev) =>
            prev.map((item) =>
              item._id === sectionID ? { ...item, [itemName]: !newValue } : item
            )
          );
          handleGlobalError(res.data.errMsg);
        }
      })
      .catch((err) => {
        setReviewSections((prev) =>
          prev.map((item) =>
            item._id === sectionID ? { ...item, [itemName]: !newValue } : item
          )
        );
        handleGlobalError(err);
      });
  };

  const openAddModal = () => {
    setAddName("");
    setAddNameErr(false);
    setAddLoading(false);
    setShowAddModal(true);
  };
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddName("");
    setAddNameErr(false);
    setAddLoading(false);
  };

  const handleChangeDiscussionVis = () => {
    const next = !showDiscussion;
    setShowDiscussion(next);
    localStorage.setItem("conductor_show_a11ydiscussion", String(next));
  };

  const openSyncTOCModal = () => {
    setShowSyncTOCModal(true);
    setSyncTOCLoading(false);
  };
  const closeSyncTOCModal = () => {
    setShowSyncTOCModal(false);
    setSyncTOCLoading(false);
  };

  const syncTOC = (merge) => {
    setSyncTOCLoading(true);
    const data = {
      projectID: props.match.params.id,
      ...(merge === true && { merge: true }),
    };
    axios
      .put("/project/accessibility/importsections", data)
      .then((res) => {
        if (!res.data.err) {
          closeSyncTOCModal();
          getReviewSections();
        } else {
          handleGlobalError(res.data.errMsg);
          setSyncTOCLoading(false);
        }
      })
      .catch((err) => {
        handleGlobalError(err);
        setSyncTOCLoading(false);
      });
  };

  const canSyncTOC =
    !isEmptyString(project.projectURL) &&
    !isEmptyString(project.libreLibrary) &&
    !isEmptyString(project.libreCoverID);

  const filteredSections = useMemo(() => {
    const q = sectionSearch.trim().toLowerCase();
    if (!q) return reviewSections;
    return reviewSections.filter((s) =>
      (s.sectionTitle || "").toLowerCase().includes(q)
    );
  }, [reviewSections, sectionSearch]);

  const selectedSection = useMemo(
    () =>
      reviewSections.find((s) => s._id === selectedSectionId) ||
      filteredSections[0] ||
      null,
    [reviewSections, filteredSections, selectedSectionId]
  );

  const { totalCompletedChecks, totalPossibleChecks, overallPercent } =
    useMemo(() => {
      const possible = reviewSections.length * TOTAL_CRITERIA_COUNT;
      const completed = reviewSections.reduce(
        (acc, sec) => acc + countCompletedInSection(sec),
        0
      );
      const pct = possible > 0 ? Math.round((completed / possible) * 100) : 0;
      return {
        totalCompletedChecks: completed,
        totalPossibleChecks: possible,
        overallPercent: pct,
      };
    }, [reviewSections]);

  const visibleMatrixCategories = useMemo(() => {
    if (matrixCategoryId === "all") return ACCESSIBILITY_CATEGORIES;
    return ACCESSIBILITY_CATEGORIES.filter((c) => c.id === matrixCategoryId);
  }, [matrixCategoryId]);

  const matrixTotalPages = Math.max(
    1,
    Math.ceil(filteredSections.length / MATRIX_PAGE_SIZE)
  );

  useEffect(() => {
    if (matrixPage > matrixTotalPages) {
      setMatrixPage(1);
    }
  }, [matrixPage, matrixTotalPages]);

  const paginatedMatrixSections = useMemo(() => {
    const start = (matrixPage - 1) * MATRIX_PAGE_SIZE;
    return filteredSections.slice(start, start + MATRIX_PAGE_SIZE);
  }, [filteredSections, matrixPage]);

  const progressVariant =
    overallPercent >= 80
      ? "success"
      : overallPercent >= 40
      ? "warning"
      : "default";

  return (
    <Container size="2xl" className="py-6">
      <Stack direction="vertical" gap="lg">
        {/* Top Breadcrumb & Title */}
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
            <Breadcrumb.Item isCurrent>
              Accessibility Remediation
            </Breadcrumb.Item>
          </Breadcrumb>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Heading level={1} className="m-0! text-2xl font-bold text-slate-900">
                Accessibility Remediation
                {project.title ? `: ${project.title}` : ""}
              </Heading>
              <Text size="sm" color="muted" className="mt-1 block">
                Review each chapter or page against LibreTexts WCAG 2.2 AA
                compliance checks.
              </Text>
            </div>

            {canViewDetails && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<IconPlus size={16} />}
                  onClick={openAddModal}
                >
                  Add Section
                </Button>
                {canSyncTOC ? (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<IconRefresh size={16} />}
                    onClick={openSyncTOCModal}
                  >
                    Sync TOC from LibreTexts
                  </Button>
                ) : (
                  <Tooltip content="Save your project's libretexts.org URL in Edit Properties to use this feature.">
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<IconRefresh size={16} />}
                      disabled
                    >
                      Sync TOC from LibreTexts
                    </Button>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        </div>

        {loadingData ? (
          <Card variant="outline" padding="lg" className="bg-white">
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Spinner size="lg" />
              <Text size="sm" color="muted">
                Loading Accessibility Compliance Matrix...
              </Text>
            </div>
          </Card>
        ) : (
          <Stack direction="vertical" gap="lg">
            {/* Collapsible Accessibility Discussion Card */}
            {!canViewDetails ? (
              <Alert
                variant="info"
                title="Accessibility Discussion"
                message="You don't have permission to view this project's Accessibility Discussion yet."
              />
            ) : (
              <Card variant="outline" padding="none" className="bg-white">
                <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <IconMessageCircle size={19} className="text-primary" />
                    <Heading level={2} className="m-0! text-base font-semibold text-slate-900">
                      Accessibility Discussion
                    </Heading>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleChangeDiscussionVis}
                  >
                    {showDiscussion ? "Hide" : "Show"}
                  </Button>
                </div>
                {showDiscussion && (
                  <>
                    <Divider />
                    <div className="p-4">
                      <Messaging
                        projectID={props.match.params.id}
                        user={user}
                        kind="a11y"
                      />
                    </div>
                  </>
                )}
              </Card>
            )}

            {/* Compliance Review Workspace */}
            {!canViewDetails ? (
              <Alert
                variant="warning"
                title="Accessibility Compliance Review Matrix"
                message="You don't have permission to view this project's Accessibility Compliance Review Matrix yet."
              />
            ) : (
              <Card variant="outline" padding="lg" className="bg-white">
                <Stack direction="vertical" gap="md">
                  {/* Live Progress Summary Bar */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Heading
                          level={2}
                          className="m-0! text-lg font-semibold text-slate-900"
                        >
                          Accessibility Compliance Review
                        </Heading>
                        <Badge
                          label={
                            reviewSections.length > 0
                              ? `${totalCompletedChecks} / ${totalPossibleChecks} checks`
                              : "No sections"
                          }
                          variant={
                            overallPercent === 100 && reviewSections.length > 0
                              ? "success"
                              : "primary"
                          }
                          size="sm"
                        />
                        <Badge
                          label={`${reviewSections.length} ${
                            reviewSections.length === 1 ? "section" : "sections"
                          }`}
                          variant="default"
                          size="sm"
                        />
                      </div>
                      <Text size="xs" color="muted" className="mt-0.5 block">
                        Changes save automatically as you check off criteria.
                      </Text>
                    </div>

                    <div className="w-full sm:w-64">
                      <Progress
                        value={overallPercent}
                        variant={progressVariant}
                        size="md"
                        label="Overall Completion"
                        showValue
                      />
                    </div>
                  </div>

                  <Divider />

                  {reviewSections.length === 0 ? (
                    <div className="py-8">
                      <EmptyState
                        icon={<IconChecklist size={32} />}
                        title="No accessibility sections added yet"
                        description="Import your book's table of contents from LibreTexts or add a custom section to begin reviewing."
                        action={
                          <div className="flex flex-wrap items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              icon={<IconPlus size={15} />}
                              onClick={openAddModal}
                            >
                              Add Section
                            </Button>
                            {canSyncTOC && (
                              <Button
                                size="sm"
                                variant="primary"
                                icon={<IconRefresh size={15} />}
                                onClick={openSyncTOCModal}
                              >
                                Sync TOC from LibreTexts
                              </Button>
                            )}
                          </div>
                        }
                      />
                    </div>
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
                              <IconChecklist size={15} />
                              <span>Checklist View</span>
                            </span>
                          </Tabs.Tab>
                          <Tabs.Tab>
                            <span className="inline-flex items-center gap-1.5">
                              <IconLayoutGrid size={15} />
                              <span>Matrix View</span>
                            </span>
                          </Tabs.Tab>
                        </Tabs.List>
                        <Text size="xs" color="muted">
                          {TOTAL_CRITERIA_COUNT} WCAG criteria across{" "}
                          {ACCESSIBILITY_CATEGORIES.length} categories
                        </Text>
                      </div>

                      <Tabs.Panels>
                        {/* TAB 1: FOCUSED SECTION CHECKLIST VIEW (NO HORIZONTAL SCROLL) */}
                        <Tabs.Panel>
                          {activeTab === 0 && (
                          <div className="flex flex-col gap-5 lg:flex-row">
                            {/* Left Section Selector Sidebar */}
                            <div className="w-full shrink-0 lg:w-80">
                              <Card
                                variant="outline"
                                padding="sm"
                                className="flex h-full max-h-[680px] flex-col bg-slate-50/60"
                              >
                                <div className="mb-2.5">
                                  <Input
                                    name="section-search"
                                    label="Filter sections"
                                    labelClassName="sr-only"
                                    size="sm"
                                    placeholder="Filter sections..."
                                    value={sectionSearch}
                                    onChange={(e) =>
                                      setSectionSearch(e.target.value)
                                    }
                                    leftIcon={<IconSearch size={15} />}
                                  />
                                </div>

                                <div
                                  className="relative flex-1 space-y-1.5 overflow-y-auto pr-1"
                                  role="listbox"
                                  aria-label="Book sections"
                                >
                                  {filteredSections.length === 0 ? (
                                    <div className="py-8 text-center">
                                      <Text size="xs" color="muted">
                                        No sections match &ldquo;{sectionSearch}&rdquo;.
                                      </Text>
                                    </div>
                                  ) : (
                                    filteredSections.map((sec) => {
                                      const isSelected =
                                        selectedSection?._id === sec._id;
                                      const done = countCompletedInSection(sec);
                                      const badgeVar =
                                        done === TOTAL_CRITERIA_COUNT
                                          ? "success"
                                          : done > 0
                                          ? "primary"
                                          : "default";

                                      return (
                                        <button
                                          key={sec._id}
                                          type="button"
                                          role="option"
                                          aria-selected={isSelected}
                                          onClick={() =>
                                            setSelectedSectionId(sec._id)
                                          }
                                          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                            isSelected
                                              ? "border-primary bg-white shadow-xs ring-1 ring-primary/20"
                                              : "border-transparent bg-white/80 hover:border-slate-200 hover:bg-white"
                                          }`}
                                        >
                                          <Text
                                            size="sm"
                                            weight={
                                              isSelected ? "semibold" : "medium"
                                            }
                                            className="line-clamp-2 min-w-0 flex-1 text-slate-900"
                                          >
                                            {sec.sectionTitle}
                                          </Text>
                                          <Badge
                                            label={`${done}/${TOTAL_CRITERIA_COUNT}`}
                                            variant={badgeVar}
                                            size="sm"
                                          />
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </Card>
                            </div>

                            {/* Right Selected Section Criteria Categories */}
                            <div className="min-w-0 flex-1">
                              {selectedSection && (
                                <Stack direction="vertical" gap="md">
                                  <Card
                                    variant="outline"
                                    padding="md"
                                    className="bg-slate-50/50"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Heading
                                            level={3}
                                            className="m-0! text-base font-bold text-slate-900"
                                          >
                                            {selectedSection.sectionTitle}
                                          </Heading>
                                          {!isEmptyString(
                                            selectedSection.sectionURL
                                          ) && (
                                            <DavisLink
                                              href={selectedSection.sectionURL}
                                              external
                                              className="inline-flex items-center text-xs font-semibold"
                                            >
                                              Open page
                                            </DavisLink>
                                          )}
                                        </div>
                                      </div>
                                      <div className="w-full sm:w-52">
                                        <Progress
                                          value={Math.round(
                                            (countCompletedInSection(
                                              selectedSection
                                            ) /
                                              TOTAL_CRITERIA_COUNT) *
                                              100
                                          )}
                                          size="sm"
                                          showValue
                                          variant={
                                            countCompletedInSection(
                                              selectedSection
                                            ) === TOTAL_CRITERIA_COUNT
                                              ? "success"
                                              : "default"
                                          }
                                        />
                                      </div>
                                    </div>
                                  </Card>

                                  <Accordion variant="bordered" size="md">
                                    {ACCESSIBILITY_CATEGORIES.map(
                                      (category, catIdx) => {
                                        const catDone =
                                          category.criteria.reduce(
                                            (sum, crit) =>
                                              sum +
                                              (selectedSection[crit.field]
                                                ? 1
                                                : 0),
                                            0
                                          );
                                        const catTotal =
                                          category.criteria.length;

                                        return (
                                          <Accordion.Item
                                            key={category.id}
                                            defaultOpen={catIdx < 4}
                                          >
                                            <Accordion.Trigger>
                                              <div className="flex w-full items-center justify-between gap-3 pr-2">
                                                <Text
                                                  size="sm"
                                                  weight="semibold"
                                                  className="text-slate-900"
                                                >
                                                  {category.label}
                                                </Text>
                                                <Badge
                                                  label={`${catDone} / ${catTotal}`}
                                                  variant={
                                                    catDone === catTotal
                                                      ? "success"
                                                      : catDone > 0
                                                      ? "primary"
                                                      : "default"
                                                  }
                                                  size="sm"
                                                />
                                              </div>
                                            </Accordion.Trigger>
                                            <Accordion.Panel>
                                              <Stack
                                                direction="vertical"
                                                gap="sm"
                                              >
                                                {category.criteria.map(
                                                  (criterion) => (
                                                    <div
                                                      key={criterion.field}
                                                      className="rounded-md px-2 py-1.5 transition-colors hover:bg-slate-50"
                                                    >
                                                      <Checkbox
                                                        name={`${selectedSection._id}_${criterion.field}`}
                                                        label={
                                                          criterion.question
                                                        }
                                                        description={
                                                          criterion.helperText
                                                        }
                                                        checked={
                                                          !!selectedSection[
                                                            criterion.field
                                                          ]
                                                        }
                                                        onChange={(checked) =>
                                                          updateSectionItem(
                                                            selectedSection._id,
                                                            criterion.field,
                                                            checked
                                                          )
                                                        }
                                                      />
                                                    </div>
                                                  )
                                                )}
                                              </Stack>
                                            </Accordion.Panel>
                                          </Accordion.Item>
                                        );
                                      }
                                    )}
                                  </Accordion>
                                </Stack>
                              )}
                            </div>
                          </div>
                          )}
                        </Tabs.Panel>

                        {/* TAB 2: MATRIX VIEW WITH CATEGORY FILTER, PAGINATION & OPAQUE STICKY HEADERS */}
                        <Tabs.Panel>
                          {activeTab === 1 && (
                          <Stack direction="vertical" gap="sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="w-full sm:w-64">
                                <Input
                                  name="matrix-section-search"
                                  label="Filter matrix sections"
                                  labelClassName="sr-only"
                                  size="sm"
                                  placeholder="Filter sections..."
                                  value={sectionSearch}
                                  onChange={(e) => {
                                    setSectionSearch(e.target.value);
                                    setMatrixPage(1);
                                  }}
                                  leftIcon={<IconSearch size={15} />}
                                />
                              </div>
                              <Text size="xs" color="muted">
                                Showing {paginatedMatrixSections.length} of{" "}
                                {filteredSections.length} sections
                              </Text>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                size="sm"
                                variant={
                                  matrixCategoryId === "all"
                                    ? "primary"
                                    : "outline"
                                }
                                onClick={() => setMatrixCategoryId("all")}
                              >
                                All ({TOTAL_CRITERIA_COUNT})
                              </Button>
                              {ACCESSIBILITY_CATEGORIES.map((cat) => (
                                <Button
                                  key={cat.id}
                                  size="sm"
                                  variant={
                                    matrixCategoryId === cat.id
                                      ? "primary"
                                      : "outline"
                                  }
                                  onClick={() => setMatrixCategoryId(cat.id)}
                                >
                                  {cat.label} ({cat.criteria.length})
                                </Button>
                              ))}
                            </div>

                            <div className="relative max-h-[640px] overflow-auto rounded-lg border border-slate-200">
                              <table className="w-full border-collapse text-left text-sm">
                                <thead className="sticky top-0 z-20 bg-slate-100 shadow-xs">
                                  <tr>
                                    <th
                                      rowSpan={2}
                                      className="sticky left-0 z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-xs font-bold tracking-wide text-slate-700 uppercase"
                                    >
                                      Section / Page
                                    </th>
                                    {visibleMatrixCategories.map((cat) => (
                                      <th
                                        key={cat.id}
                                        colSpan={cat.criteria.length}
                                        className="border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-800"
                                      >
                                        {cat.label}
                                      </th>
                                    ))}
                                  </tr>
                                  <tr>
                                    {visibleMatrixCategories.flatMap((cat) =>
                                      cat.criteria.map((criterion) => (
                                        <th
                                          key={criterion.field}
                                          className="min-w-[165px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 align-top text-xs font-normal leading-snug text-slate-700"
                                        >
                                          <span>{criterion.question}</span>
                                          {criterion.helperText && (
                                            <Tooltip
                                              content={criterion.helperText}
                                            >
                                              <IconInfoCircle
                                                size={13}
                                                className="ml-1 inline-block text-slate-400"
                                              />
                                            </Tooltip>
                                          )}
                                        </th>
                                      ))
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedMatrixSections.map((item, rowIdx) => (
                                    <tr
                                      key={item._id}
                                      className={
                                        rowIdx % 2 === 0
                                          ? "bg-white hover:bg-primary-50/30"
                                          : "bg-slate-50/60 hover:bg-primary-50/30"
                                      }
                                    >
                                      <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2.5 font-medium text-slate-900">
                                        <div className="flex items-center justify-between gap-2">
                                          {!isEmptyString(item.sectionURL) ? (
                                            <DavisLink
                                              href={item.sectionURL}
                                              external
                                              className="text-xs font-semibold"
                                            >
                                              {item.sectionTitle}
                                            </DavisLink>
                                          ) : (
                                            <Text
                                              size="xs"
                                              weight="semibold"
                                              className="text-slate-900"
                                            >
                                              {item.sectionTitle}
                                            </Text>
                                          )}
                                          <Badge
                                            label={`${countCompletedInSection(
                                              item
                                            )}/${TOTAL_CRITERIA_COUNT}`}
                                            variant="default"
                                            size="sm"
                                          />
                                        </div>
                                      </td>
                                      {visibleMatrixCategories.flatMap((cat) =>
                                        cat.criteria.map((criterion) => (
                                          <td
                                            key={criterion.field}
                                            className="border-b border-r border-slate-200 px-3 py-2 text-center"
                                          >
                                            <div className="inline-flex justify-center">
                                              <Checkbox
                                                name={`matrix_${item._id}_${criterion.field}`}
                                                label={`${item.sectionTitle}: ${criterion.question}`}
                                                labelClassName="sr-only"
                                                checked={!!item[criterion.field]}
                                                onChange={(checked) =>
                                                  updateSectionItem(
                                                    item._id,
                                                    criterion.field,
                                                    checked
                                                  )
                                                }
                                              />
                                            </div>
                                          </td>
                                        ))
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {matrixTotalPages > 1 && (
                              <div className="flex justify-center pt-2">
                                <Pagination
                                  page={matrixPage}
                                  totalPages={matrixTotalPages}
                                  onChange={setMatrixPage}
                                  size="sm"
                                />
                              </div>
                            )}
                          </Stack>
                          )}
                        </Tabs.Panel>
                      </Tabs.Panels>
                    </Tabs>
                  )}
                </Stack>
              </Card>
            )}
          </Stack>
        )}

        {/* Add Section Modal */}
        <Modal
          open={showAddModal}
          onClose={(v) => !v && closeAddModal()}
          size="sm"
        >
          <Modal.Header>
            <Modal.Title>Add Section</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Input
              name="addSectionName"
              label="Section Name"
              required
              placeholder="e.g., Chapter 1: Introduction"
              value={addName}
              error={addNameErr}
              errorMessage="Please enter a valid section name (1–149 characters)."
              onChange={(e) => {
                setAddName(e.target.value);
                if (addNameErr) setAddNameErr(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSection();
                }
              }}
            />
          </Modal.Body>
          <Modal.Footer>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={<IconPlus size={15} />}
                loading={addLoading}
                onClick={addSection}
              >
                Add Section
              </Button>
            </div>
          </Modal.Footer>
        </Modal>

        {/* Sync TOC Modal */}
        <Modal
          open={showSyncTOCModal}
          onClose={(v) => !v && closeSyncTOCModal()}
          size="md"
        >
          <Modal.Header>
            <Modal.Title>Sync Table of Contents</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Stack direction="vertical" gap="md">
              <Card variant="outline" padding="sm" className="bg-slate-50">
                <Text size="sm" weight="semibold" className="text-slate-900">
                  Import Mode
                </Text>
                <Text size="xs" color="muted" className="mt-1 block">
                  Imports your LibreText&apos;s table of contents and{" "}
                  <strong>overwrites</strong> all existing entries in the
                  Accessibility Compliance Review Matrix.
                </Text>
              </Card>

              <Card variant="outline" padding="sm" className="bg-slate-50">
                <Text size="sm" weight="semibold" className="text-slate-900">
                  Import &amp; Merge Mode
                </Text>
                <Text size="xs" color="muted" className="mt-1 block">
                  Imports your LibreText&apos;s table of contents and attempts
                  to merge existing entries with new entries in the TOC.
                </Text>
              </Card>

              <Alert
                variant="warning"
                message="Section/page names are case- and character-sensitive. Unmatchable names may be overwritten."
              />
            </Stack>
          </Modal.Body>
          <Modal.Footer>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={closeSyncTOCModal}>
                Cancel
              </Button>
              <Button
                variant="outline"
                icon={<IconRefresh size={15} />}
                loading={syncTOCLoading}
                onClick={() => syncTOC(false)}
              >
                Import (Overwrite)
              </Button>
              <Button
                variant="primary"
                icon={<IconRefresh size={15} />}
                loading={syncTOCLoading}
                onClick={() => syncTOC(true)}
              >
                Import &amp; Merge
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
      </Stack>
    </Container>
  );
};

export default ProjectAccessibility;
