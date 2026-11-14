import React, { useCallback, useEffect, useState } from "react";
import {
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
  IconButton,
  Input,
  Modal,
  Select,
  Spinner,
  Stack,
  Text,
} from "@libretexts/davis-react";
import {
  IconClipboardList,
  IconCopy,
  IconDeviceFloppy,
  IconEye,
  IconHeart,
  IconHeartOff,
  IconMessageCircle,
  IconPlus,
  IconSend,
  IconSettings,
  IconStar,
  IconTrash,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import date from "date-and-time";
import ordinal from "date-and-time/plugin/ordinal";
import day_of_week from "date-and-time/plugin/day-of-week";
import axios from "axios";

import useGlobalError from "../error/ErrorHooks";
import {
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
  getPeerReviewAuthorText,
} from "../util/ProjectHelpers";
import { useTypedSelector } from "../../state/hooks";
import Messaging from "../Messaging";

date.plugin(ordinal);
date.plugin(day_of_week);

const reviewsSortOptions = [
  { value: "author", label: "Sort by Reviewer Name" },
  { value: "date", label: "Sort by Date" },
];

const allowAnonOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const ProjectPeerReview = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);

  const [loadingData, setLoadingData] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(
    () => localStorage.getItem("conductor_show_peerdiscussion") === "true"
  );
  const [reviewSort, setReviewSort] = useState("author");

  const [project, setProject] = useState({});
  const [peerReviews, setPeerReviews] = useState([]);
  const [displayReviews, setDisplayReviews] = useState([]);
  const [reviewAverage, setReviewAverage] = useState(0);
  const [prSettingsSaved, setPRSettingsSaved] = useState(false);

  const [canViewDetails, setCanViewDetails] = useState(false);
  const [userProjectMember, setUserProjectMember] = useState(false);

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsAllowAnon, setSettingsAllowAnon] = useState("true");
  const [settingsPreferred, setSettingsPreferred] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsRubrics, setSettingsRubrics] = useState([]);
  const [settingsRubricsLoading, setSettingsRubricsLoading] = useState(false);
  const [settingsUnsaved, setSettingsUnsaved] = useState(false);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteIncludeURL, setInviteIncludeURL] = useState(true);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteEmailErr, setInviteEmailErr] = useState(false);

  const [showDelModal, setShowDelModal] = useState(false);
  const [delReviewID, setDelReviewID] = useState("");
  const [delAuthor, setDelAuthor] = useState("");
  const [delLoading, setDelLoading] = useState(false);

  const getProject = useCallback(() => {
    if (
      typeof props.match.params.id === "string" &&
      props.match.params.id.length > 0
    ) {
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
    }
  }, [props.match, handleGlobalError]);

  const getReviews = useCallback(() => {
    setLoadingData(true);
    axios
      .get("/peerreviews", { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (Array.isArray(res.data.reviews)) setPeerReviews(res.data.reviews);
          if (typeof res.data.averageRating === "number") {
            setReviewAverage(res.data.averageRating);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      })
      .catch((err) => {
        setLoadingData(false);
        handleGlobalError(err);
      });
  }, [props.match, handleGlobalError]);

  useEffect(() => {
    document.title =
      "LibreTexts Conductor | Projects | Project View | Peer Review";
    getProject();
  }, [getProject]);

  useEffect(() => {
    if (canViewDetails) getReviews();
  }, [canViewDetails, getReviews]);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Peer Review`;
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
        setUserProjectMember(true);
        setCanViewDetails(true);
      } else if (project.visibility === "public") {
        setCanViewDetails(true);
      } else {
        setCanViewDetails(checkCanViewProjectDetails(project, user));
      }
    }
  }, [project, user]);

  useEffect(() => {
    if (Array.isArray(peerReviews) && reviewSort.length > 0) {
      const sorted = [...peerReviews].sort((a, b) => {
        let aKey = null;
        let bKey = null;
        if (
          reviewSort === "author" &&
          typeof a.author === "string" &&
          typeof b.author === "string"
        ) {
          aKey = a.author.toLowerCase().replace(/[^A-Za-z]+/g, "");
          bKey = b.author.toLowerCase().replace(/[^A-Za-z]+/g, "");
        } else {
          aKey = new Date(a.createdAt);
          bKey = new Date(b.createdAt);
        }
        if (aKey < bKey) return -1;
        if (aKey > bKey) return 1;
        return 0;
      });
      setDisplayReviews(sorted);
    }
  }, [peerReviews, reviewSort]);

  const handleChangeDiscussionVis = () => {
    const next = !showDiscussion;
    setShowDiscussion(next);
    localStorage.setItem("conductor_show_peerdiscussion", String(next));
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(props.location.search);
    if (urlParams.get("returnTo") === "settings" && project.projectID) {
      handleOpenSettingsModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.location.search, project.projectID]);

  const handleOpenSettingsModal = () => {
    if (Object.prototype.hasOwnProperty.call(project, "allowAnonPR")) {
      setSettingsAllowAnon(project.allowAnonPR ? "true" : "false");
    }
    if (Object.prototype.hasOwnProperty.call(project, "preferredPRRubric")) {
      setSettingsPreferred(project.preferredPRRubric);
    }
    setShowSettingsModal(true);
    setSettingsLoading(false);
    setSettingsUnsaved(false);
    setSettingsRubricsLoading(true);
    axios
      .get("/peerreview/rubrics")
      .then((res) => {
        if (!res.data.err) {
          if (Array.isArray(res.data.rubrics)) {
            setSettingsRubrics(res.data.rubrics);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setSettingsRubricsLoading(false);
      })
      .catch((err) => {
        setSettingsRubricsLoading(false);
        handleGlobalError(err);
      });
  };

  const handleCloseSettingsModal = () => {
    setShowSettingsModal(false);
    setSettingsAllowAnon("true");
    setSettingsPreferred("");
    setSettingsLoading(false);
    setSettingsUnsaved(false);
    setSettingsRubrics([]);
    setSettingsRubricsLoading(false);
  };

  const handleOpenRubricPreviewModal = (rubricID) => {
    if (typeof rubricID === "string" && rubricID.length > 0) {
      setShowSettingsModal(false);
      props.history.push(
        `/projects/${props.match.params.id}/preview-peer-review/${rubricID}`
      );
    }
  };

  const savePeerReviewSettings = () => {
    const updateObj = { projectID: props.match.params.id };
    const anonVal = settingsAllowAnon === "true";
    if (
      project.allowAnonPR !== anonVal ||
      !Object.prototype.hasOwnProperty.call(project, "allowAnonPR")
    ) {
      updateObj.allowAnonPR = anonVal;
    }
    if (
      project.preferredPRRubric !== settingsPreferred ||
      !Object.prototype.hasOwnProperty.call(project, "preferredPRRubric")
    ) {
      updateObj.preferredPRRubric = settingsPreferred;
    }
    if (Object.keys(updateObj).length > 1) {
      setSettingsLoading(true);
      axios
        .put("/project", updateObj)
        .then((res) => {
          if (!res.data.err) {
            setPRSettingsSaved(true);
            handleCloseSettingsModal();
            getProject();
          } else {
            setSettingsLoading(false);
            handleGlobalError(res.data.errMsg);
          }
        })
        .catch((err) => {
          setSettingsLoading(false);
          handleGlobalError(err);
        });
    } else {
      handleCloseSettingsModal();
    }
  };

  const handleSendInvite = () => {
    setInviteEmailErr(false);
    if (inviteEmail.length > 0 && inviteEmail.length < 1000) {
      setInviteSending(true);
      axios
        .post("/peerreview/invite", {
          projectID: props.match.params.id,
          inviteEmail,
          sendProjectURL: inviteIncludeURL,
        })
        .then((res) => {
          if (!res.data.err) {
            setInviteSent(true);
            setInviteEmail("");
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setInviteSending(false);
        })
        .catch((err) => {
          setInviteSending(false);
          handleGlobalError(err);
        });
    } else {
      setInviteEmailErr(true);
    }
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail("");
    setInviteIncludeURL(true);
    setInviteEmailErr(false);
    setInviteCopied(false);
    setInviteSending(false);
    setInviteSent(false);
  };

  const openDeleteModal = (reviewID, reviewAuthor) => {
    if (
      typeof reviewID === "string" &&
      typeof reviewAuthor === "string" &&
      reviewID.length > 0
    ) {
      setDelReviewID(reviewID);
      setDelAuthor(reviewAuthor);
      setDelLoading(false);
      setShowDelModal(true);
    }
  };

  const closeDeleteModal = () => {
    setShowDelModal(false);
    setDelLoading(false);
    setDelReviewID("");
    setDelAuthor("");
  };

  const submitDeleteReview = () => {
    if (delReviewID.length > 0) {
      setDelLoading(true);
      axios
        .delete("/peerreview", { data: { peerReviewID: delReviewID } })
        .then((res) => {
          if (!res.data.err) {
            closeDeleteModal();
            getReviews();
          } else {
            setDelLoading(false);
            handleGlobalError(res.data.errMsg);
          }
        })
        .catch((err) => {
          setDelLoading(false);
          handleGlobalError(err);
        });
    }
  };

  const openAccessPR =
    project.visibility === "public" &&
    (project.allowAnonPR === true ||
      !Object.prototype.hasOwnProperty.call(project, "allowAnonPR"));

  const hasRating = typeof project.rating === "number" && project.rating > 0;

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
            <Breadcrumb.Item isCurrent>Peer Review</Breadcrumb.Item>
          </Breadcrumb>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Heading level={1} className="m-0! text-2xl font-bold text-slate-900">
                Peer Review{project.title ? `: ${project.title}` : ""}
              </Heading>
              <Text size="sm" color="muted" className="mt-1 block">
                Collect, configure, and inspect peer reviews and rubric ratings
                for this resource.
              </Text>
            </div>

            {canViewDetails && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<IconSend size={15} />}
                  iconClassName="items-center justify-center"
                  disabled={!userProjectMember}
                  onClick={() => setShowInviteModal(true)}
                >
                  Invite Reviewer
                </Button>
                {userProjectMember && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<IconSettings size={15} />}
                    iconClassName="items-center justify-center"
                    onClick={handleOpenSettingsModal}
                  >
                    Settings
                  </Button>
                )}
                {(userProjectMember || openAccessPR) && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<IconPlus size={15} />}
                    iconClassName="items-center justify-center"
                    onClick={() =>
                      props.history.push(
                        `/projects/${props.match.params.id}/submit-peer-review`
                      )
                    }
                  >
                    New Review
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {prSettingsSaved && (
          <Alert
            variant="success"
            dismissible
            onDismiss={() => setPRSettingsSaved(false)}
            message="Peer Review Settings updated!"
          />
        )}

        {/* Peer Reviews Card */}
        {!canViewDetails ? (
          <Alert
            variant="info"
            title="Peer Reviews"
            message="You don't have permission to view this project's Peer Reviews yet."
          />
        ) : (
          <Card variant="outline" padding="lg" className="bg-white">
            <Stack direction="vertical" gap="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <IconClipboardList size={20} className="text-primary" />
                  <Heading
                    level={2}
                    className="m-0! text-lg font-semibold text-slate-900"
                  >
                    Peer Reviews
                  </Heading>
                  <Badge
                    label={`${displayReviews.length} ${
                      displayReviews.length === 1 ? "Review" : "Reviews"
                    }`}
                    variant="primary"
                    size="sm"
                  />
                  <Badge
                    label={
                      hasRating
                        ? `Avg Rating: ${reviewAverage}/5`
                        : "Avg Rating: N/A"
                    }
                    variant={hasRating ? "success" : "default"}
                    size="sm"
                    icon={hasRating ? <IconStar size={12} /> : undefined}
                  />
                </div>

                <div className="timeline-granularity-select w-56">
                  <Select
                    name="reviewSort"
                    label="Sort peer reviews"
                    labelClassName="sr-only"
                    size="sm"
                    options={reviewsSortOptions}
                    value={reviewSort}
                    onChange={(e) => setReviewSort(e.target.value)}
                    selectClassName="h-9! py-1! text-sm!"
                  />
                </div>
              </div>

              <Divider />

              {loadingData ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <Spinner size="md" />
                  <Text size="sm" color="muted">
                    Loading peer reviews...
                  </Text>
                </div>
              ) : displayReviews.length > 0 ? (
                <ul className="divide-y divide-slate-100 list-none m-0 p-0">
                  {displayReviews.map((item) => {
                    const formattedDate = date.format(
                      new Date(item.createdAt),
                      "MMM DDD, YYYY h:mm A"
                    );
                    return (
                      <li
                        key={item.peerReviewID}
                        className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Text
                              size="base"
                              weight="semibold"
                              className="text-slate-900"
                            >
                              {item.author || "Unknown Reviewer"}
                            </Text>
                            <Badge
                              label={getPeerReviewAuthorText(item.authorType)}
                              variant="default"
                              size="sm"
                            />
                          </div>
                          <Text size="xs" color="muted" className="mt-0.5 block">
                            Submitted {formattedDate}
                          </Text>
                        </div>

                        <div className="flex items-center gap-2">
                          {userProjectMember && (
                            <IconButton
                              icon={<IconTrash size={15} />}
                              iconClassName="items-center justify-center"
                              variant="destructive"
                              size="sm"
                              aria-label={`Delete review by ${item.author || "reviewer"}`}
                              tooltip="Delete Review"
                              onClick={() =>
                                openDeleteModal(item.peerReviewID, item.author)
                              }
                            />
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<IconEye size={15} />}
                            iconClassName="items-center justify-center"
                            onClick={() =>
                              props.history.push(
                                `/projects/${props.match.params.id}/peerreview/${item.peerReviewID}`
                              )
                            }
                          >
                            View Review
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="py-6">
                  <EmptyState
                    icon={<IconClipboardList size={30} />}
                    title="No Peer Reviews yet"
                    description="Invite an external reviewer or submit a new peer review to get started."
                    action={
                      (userProjectMember || openAccessPR) && (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<IconPlus size={15} />}
                          iconClassName="items-center justify-center"
                          onClick={() =>
                            props.history.push(
                              `/projects/${props.match.params.id}/submit-peer-review`
                            )
                          }
                        >
                          Submit First Review
                        </Button>
                      )
                    }
                  />
                </div>
              )}
            </Stack>
          </Card>
        )}

        {/* Collapsible Peer Review Discussion Card */}
        {!canViewDetails ? (
          <Alert
            variant="info"
            title="Peer Review Discussion"
            message="You don't have permission to view this project's Peer Review Discussion yet."
          />
        ) : (
          userProjectMember && (
            <Card variant="outline" padding="none" className="bg-white">
              <div className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <IconMessageCircle size={19} className="text-primary" />
                  <Heading
                    level={2}
                    className="m-0! text-base font-semibold text-slate-900"
                  >
                    Peer Review Discussion
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
                  <Messaging
                    projectID={props.match.params.id}
                    user={user}
                    kind="peerreview"
                  />
                </>
              )}
            </Card>
          )
        )}
      </Stack>

      {/* Peer Review Settings Modal */}
      <Modal
        open={showSettingsModal}
        onClose={(v) => !v && handleCloseSettingsModal()}
        size="lg"
      >
        <Modal.Header>
          <Modal.Title>Peer Review Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
          <Stack direction="vertical" gap="md">
            {settingsUnsaved && (
              <Alert variant="warning" message="You have unsaved changes!" />
            )}
            <div>
              <Text
                size="xs"
                weight="semibold"
                color="muted"
                className="mb-2 block uppercase tracking-wide"
              >
                Privacy Settings
              </Text>
              <Select
                name="settingsAllowAnon"
                label="Allow Peer Reviews from Non-Conductor Users"
                helperText="Only applies if Project has 'Public' visibility. Defaults to Yes."
                options={allowAnonOptions}
                value={settingsAllowAnon}
                onChange={(e) => {
                  setSettingsAllowAnon(e.target.value);
                  const anonVal = e.target.value === "true";
                  if (
                    project.allowAnonPR !== anonVal ||
                    !Object.prototype.hasOwnProperty.call(
                      project,
                      "allowAnonPR"
                    )
                  ) {
                    setSettingsUnsaved(true);
                  }
                }}
              />
            </div>

            <Divider />

            <div>
              <Text
                size="xs"
                weight="semibold"
                color="muted"
                className="mb-1 block uppercase tracking-wide"
              >
                Preferred Rubric
              </Text>
              <Text size="xs" color="muted" className="mb-3 block">
                Select a Peer Review Rubric below to choose the rubric shown to
                new reviewers. Otherwise, your Campus&apos; or LibreTexts&apos;
                default rubric will be used.
              </Text>

              {settingsRubricsLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="md" />
                </div>
              ) : settingsRubrics.length === 0 ? (
                <Text size="sm" color="muted" className="block py-4 text-center">
                  No Rubrics available right now.
                </Text>
              ) : (
                <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 list-none m-0 p-0">
                  {settingsRubrics.map((item) => (
                    <li
                      key={item.rubricID}
                      className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <Text
                          size="sm"
                          weight="semibold"
                          className="block text-slate-900"
                        >
                          {item.rubricTitle || "Unknown Rubric"}
                        </Text>
                        <Text size="xs" color="muted">
                          {item.organization?.shortName ||
                            "Unknown Organization"}
                          {item.isOrgDefault ? " (Campus Default)" : ""}
                        </Text>
                      </div>
                      <div className="flex items-center gap-2">
                        {settingsPreferred !== item.rubricID ? (
                          <Button
                            size="sm"
                            variant="outline"
                            icon={<IconHeartOff size={14} />}
                            iconClassName="items-center justify-center"
                            onClick={() => {
                              setSettingsPreferred(item.rubricID);
                              if (item.rubricID !== project.preferredPRRubric) {
                                setSettingsUnsaved(true);
                              }
                            }}
                          >
                            Set as Preferred
                          </Button>
                        ) : (
                          <Badge
                            label="Preferred Rubric"
                            variant="success"
                            size="sm"
                            icon={<IconHeart size={13} />}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<IconEye size={14} />}
                          iconClassName="items-center justify-center"
                          onClick={() =>
                            handleOpenRubricPreviewModal(item.rubricID)
                          }
                        >
                          Preview
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseSettingsModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={settingsLoading}
              icon={<IconDeviceFloppy size={16} />}
              iconClassName="items-center justify-center"
              onClick={savePeerReviewSettings}
            >
              Save Changes
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Invite Reviewer Modal */}
      <Modal
        open={showInviteModal}
        onClose={(v) => !v && closeInviteModal()}
        size="md"
      >
        <Modal.Header>
          <Modal.Title>Invite Reviewer</Modal.Title>
        </Modal.Header>
        <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
          <Stack direction="vertical" gap="md">
            <Text size="sm" className="text-slate-700">
              You can send an invite to a reviewer without a Conductor account
              using the form below. Otherwise, we recommend adding reviewers to
              this Project as <em>Auditors</em>.
            </Text>
            {inviteSent && (
              <Alert variant="success" message="Invitation sent!" />
            )}
            {typeof project.projectURL === "string" &&
              project.projectURL.length > 0 && (
                <Checkbox
                  name="inviteIncludeURL"
                  label="Include this Project's Project URL (recommended)"
                  checked={inviteIncludeURL}
                  onChange={(checked) => setInviteIncludeURL(checked)}
                />
              )}
            <div className="flex items-end gap-2">
              <Input
                name="inviteEmail"
                label="Email address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter an email..."
                error={inviteEmailErr}
                errorMessage="Please enter a valid email address."
                className="flex-1"
              />
              <Button
                variant="primary"
                icon={<IconSend size={15} />}
                iconClassName="items-center justify-center"
                loading={inviteSending}
                onClick={handleSendInvite}
              >
                Send Invite
              </Button>
            </div>

            <Divider label="Or" />

            <Text size="sm" className="text-slate-700">
              You can also share this link with others to allow them to review
              with or without a Conductor account!
            </Text>
            {inviteCopied && (
              <Alert variant="success" message="Copied to clipboard!" />
            )}
            <div className="flex items-end gap-2">
              <Input
                name="inviteLink"
                label="Peer Review URL"
                type="url"
                value={`commons.libretexts.org/peerreview/${props.match.params.id}`}
                readOnly
                className="flex-1"
              />
              <Button
                variant="outline"
                icon={<IconCopy size={15} />}
                iconClassName="items-center justify-center"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(
                      `commons.libretexts.org/peerreview/${props.match.params.id}`
                    );
                    setInviteCopied(true);
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                Copy Link
              </Button>
            </div>
          </Stack>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end">
            <Button variant="primary" onClick={closeInviteModal}>
              Done
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Delete Review Modal */}
      <Modal open={showDelModal} onClose={(v) => !v && closeDeleteModal()}>
        <Modal.Header>
          <Modal.Title>Delete Peer Review</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Text size="sm" className="text-slate-700">
            Are you sure you want to delete this Peer Review by{" "}
            <strong>{delAuthor}</strong>{" "}
            <span className="text-slate-400">(ID: {delReviewID})</span>?{" "}
            <strong>This cannot be undone.</strong>
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeDeleteModal}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={delLoading}
              icon={<IconTrash size={15} />}
              iconClassName="items-center justify-center"
              onClick={submitDeleteReview}
            >
              Delete Review
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProjectPeerReview;
