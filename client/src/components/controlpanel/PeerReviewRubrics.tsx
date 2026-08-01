import { useState, useEffect, useCallback } from "react";
import { useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import { format as formatDate } from "date-fns";
import {
  Alert,
  Breadcrumb,
  Button,
  Heading,
  Spinner,
  Stack,
} from "@libretexts/davis-react";
import {
  IconEye,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";

import PeerReview from "../peerreview/PeerReview";
import ConfirmModal from "../ConfirmModal";
import useGlobalError from "../error/ErrorHooks";
import { isEmptyString } from "../util/HelperFunctions";
import { useTypedSelector } from "../../state/hooks";
import { PeerReviewRubric } from "../../types";

const DATE_FORMAT_STRING = "MM/dd/yyyy hh:mm aa";

const PeerReviewRubrics = () => {
  const { handleGlobalError } = useGlobalError();
  const user = useTypedSelector((state) => state.user);
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const location = useLocation();

  // UI
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [createdRubric, setCreatedRubric] = useState(false);
  const [savedRubric, setSavedRubric] = useState(false);
  const [prPreviewShow, setPRPreviewShow] = useState(false);
  const [prPreviewID, setPRPreviewID] = useState("");

  // Data
  const [rubrics, setRubrics] = useState<PeerReviewRubric[]>([]);

  // Delete Rubric Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteRubricID, setDeleteRubricID] = useState("");
  const [deleteRubricTitle, setDeleteRubricTitle] = useState("");
  const [deleteRubricLoading, setDeleteRubricLoading] = useState(false);

  const getRubrics = useCallback(async () => {
    try {
      setLoadingRubrics(true);
      const res = await axios.get("/peerreview/rubrics");
      if (res.data.err) throw new Error(res.data.errMsg);
      if (Array.isArray(res.data.rubrics)) setRubrics(res.data.rubrics);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadingRubrics(false);
    }
  }, [handleGlobalError]);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get("created") === "true") setCreatedRubric(true);
    if (urlParams.get("saved") === "true") setSavedRubric(true);
  }, [location.search]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Peer Review Rubrics";
    getRubrics();
  }, [getRubrics]);

  function handleOpenPreviewModal(rubricID: string) {
    if (isEmptyString(rubricID)) return;
    setPRPreviewID(rubricID);
    setPRPreviewShow(true);
  }

  function handleClosePreviewModal() {
    setPRPreviewShow(false);
    setPRPreviewID("");
  }

  function handleOpenDeleteModal(rubric: PeerReviewRubric) {
    if (isEmptyString(rubric.rubricID)) return;
    setDeleteRubricID(rubric.rubricID);
    setDeleteRubricTitle(rubric.rubricTitle ?? "");
    setShowDeleteModal(true);
  }

  async function submitDeleteRubric() {
    if (isEmptyString(deleteRubricID)) return;
    try {
      setDeleteRubricLoading(true);
      const res = await axios.delete("/peerreview/rubric", {
        data: { rubricID: deleteRubricID },
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      handleCloseDeleteModal();
      getRubrics();
    } catch (err) {
      handleGlobalError(err);
      setDeleteRubricLoading(false);
    }
  }

  function handleCloseDeleteModal() {
    setShowDeleteModal(false);
    setDeleteRubricID("");
    setDeleteRubricTitle("");
    setDeleteRubricLoading(false);
  }

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>Peer Review Rubrics</Heading>
        <Breadcrumb aria-label="Page navigation">
          <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Peer Review Rubrics</Breadcrumb.Item>
        </Breadcrumb>
      </Stack>

      {createdRubric && (
        <Alert
          variant="success"
          message="Rubric successfully created!"
          dismissible
          onDismiss={() => setCreatedRubric(false)}
          className="mb-4"
        />
      )}
      {savedRubric && (
        <Alert
          variant="success"
          message="Rubric successfully saved!"
          dismissible
          onDismiss={() => setSavedRubric(false)}
          className="mb-4"
        />
      )}

      <div className="border border-gray-200 border-t-4 border-t-primary rounded-lg p-6 mb-4">
        <h3 className="text-base font-semibold text-gray-800 mb-2">
          Rubric Resolution
        </h3>
        <p className="text-sm text-gray-700 mb-2">
          Conductor will always attempt to choose a rubric in the following
          order:
        </p>
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
          <li>
            The Project's <em>Preferred Peer Review Rubric</em>
          </li>
          <li>
            The <em>Campus Default Rubric</em> of the Project's originating
            campus, if applicable
          </li>
          <li>The LibreTexts default Rubric</li>
        </ol>
      </div>

      <Button
        variant="primary"
        fullWidth
        icon={<IconPlus size={16} />}
        onClick={() => history.push("/controlpanel/peerreviewrubrics/create")}
        className="mb-4"
      >
        Create Rubric
      </Button>

      {loadingRubrics ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : rubrics.length > 0 ? (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
          {rubrics.map((item) => {
            const canManage =
              item.orgID === org.orgID &&
              (user.isCampusAdmin || user.isSuperAdmin);
            return (
              <div
                key={item.rubricID}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900">
                    {item.rubricTitle || "Unknown Rubric"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {item.organization?.shortName || "Unknown Organization"}
                    {item.isOrgDefault && <em> (Campus Default)</em>}
                    {" • "}
                    <em>
                      Last Updated:{" "}
                      {item.updatedAt
                        ? formatDate(
                            new Date(item.updatedAt),
                            DATE_FORMAT_STRING
                          )
                        : "Unknown"}
                    </em>
                  </span>
                </div>
                <div className="flex gap-2">
                  {canManage && (
                    <>
                      <Button
                        variant="destructive"
                        icon={<IconTrash size={14} />}
                        onClick={() => handleOpenDeleteModal(item)}
                      >
                        Delete Rubric
                      </Button>
                      <Button
                        variant="secondary"
                        icon={<IconPencil size={14} />}
                        onClick={() =>
                          history.push(
                            `/controlpanel/peerreviewrubrics/edit/${item.rubricID}`
                          )
                        }
                      >
                        Edit Rubric
                      </Button>
                    </>
                  )}
                  <Button
                    variant="primary"
                    icon={<IconEye size={14} />}
                    onClick={() => handleOpenPreviewModal(item.rubricID)}
                  >
                    Preview Rubric
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-gray-500 py-8">No rubrics found.</p>
      )}

      {showDeleteModal && (
        <ConfirmModal
          text={`Are you sure you want to delete the "${deleteRubricTitle}" rubric (ID: ${deleteRubricID})? Projects using this as their Preferred Rubric will fallback to the Campus or LibreTexts default.`}
          onCancel={handleCloseDeleteModal}
          onConfirm={submitDeleteRubric}
          confirmText="Delete Rubric"
          confirmColor="red"
          loading={deleteRubricLoading}
        />
      )}

      <PeerReview
        open={prPreviewShow}
        onClose={handleClosePreviewModal}
        rubricID={prPreviewID}
        demoView={true}
      />
    </div>
  );
};

export default PeerReviewRubrics;
