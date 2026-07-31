import { useState, useEffect, useCallback, useRef } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import axios from "axios";
import DOMPurify from "dompurify";
import { format as formatDate, parseISO } from "date-fns";
import {
  Breadcrumb,
  Button,
  Checkbox,
  Divider,
  Heading,
  Input,
  Stack,
} from "@libretexts/davis-react";
import {
  IconAlignLeft,
  IconDeviceFloppy,
  IconHeading,
  IconQuestionMark,
  IconX,
} from "@tabler/icons-react";

import PeerReviewRubricInstructionsSegment from "./PeerReviewRubricInstructionsSegment";
import EditableFormBlock from "../CustomForms/EditableFormBlock";
import HeadingModal from "../CustomForms/HeadingModal";
import TextBlockModal from "../CustomForms/TextBlockModal";
import PromptModal from "../CustomForms/PromptModal";
import DeleteBlockModal from "../CustomForms/DeleteBlockModal";
import useGlobalError from "../error/ErrorHooks";
import { useTypedSelector } from "../../state/hooks";
import {
  CustomFormElement,
  CustomFormPromptType,
  CustomFormUIType,
  GenericKeyTextValueObj,
  PeerReviewRubric,
} from "../../types";
import {
  handleDeleteRubricBlock,
  handleMoveRubricBlock,
  parseAndSortRubricElements,
} from "../../utils/peerReviewRubricHelpers";

const DATE_FORMAT_STRING = "MM/dd/yyyy h:mm aa";

const PeerReviewRubricManage = () => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const routeParams = useParams<{ mode: string; rubricID?: string }>();

  const {
    control,
    getValues,
    setValue,
    watch,
    reset: resetForm,
  } = useForm<PeerReviewRubric>({
    defaultValues: {
      orgID: "",
      rubricID: "",
      isOrgDefault: false,
      rubricTitle: "",
      headings: [],
      textBlocks: [],
      prompts: [],
    },
  });

  const originalTitleRef = useRef("");

  // UI
  const [manageMode, setManageMode] = useState<"create" | "edit">("create");
  const [loadedRubric, setLoadedRubric] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showChangesWarning, setShowChangesWarning] = useState(false);
  const [changesSaving, setChangesSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("N/A");
  const [disableRubricTitle, setDisableRubricTitle] = useState(false);
  const [disableRubricOrgDefault, setDisableRubricOrgDefault] =
    useState(true);
  const [rubricTitleErr, setRubricTitleErr] = useState(false);

  const [allElements, setAllElements] = useState<CustomFormElement[]>([]);

  // Heading Modal
  const [showHeadingModal, setShowHeadingModal] = useState(false);
  const [hmMode, setHMMode] = useState<"add" | "edit">("add");
  const [hmHeading, setHMHeading] = useState("");
  const [hmOrder, setHMOrder] = useState(0);
  const [hmLoading, setHMLoading] = useState(false);
  const [hmError, setHMError] = useState(false);

  // Text Modal
  const [showTextModal, setShowTextModal] = useState(false);
  const [tmMode, setTMMode] = useState<"add" | "edit">("add");
  const [tmText, setTMText] = useState("");
  const [tmOrder, setTMOrder] = useState(0);
  const [tmLoading, setTMLoading] = useState(false);
  const [tmError, setTMError] = useState(false);

  // Prompt Modal
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [pmMode, setPMMode] = useState<"add" | "edit">("add");
  const [pmType, setPMType] = useState<CustomFormPromptType | "">("");
  const [pmText, setPMText] = useState("");
  const [pmOrder, setPMOrder] = useState(0);
  const [pmRequired, setPMRequired] = useState(false);
  const [pmDropdownOpts, setPMDropdownOpts] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pmDropdownNew, setPMDropdownNew] = useState("");
  const [pmLoading, setPMLoading] = useState(false);

  // Delete Block Modal
  const [showDBModal, setShowDBModal] = useState(false);
  const [dbType, setDBType] = useState<CustomFormUIType>("prompt");
  const [dbBlock, setDBBlock] = useState<CustomFormElement>();
  const [dbLoading, setDBLoading] = useState(false);

  useEffect(() => {
    setAllElements(
      parseAndSortRubricElements({
        getValueFn: getValues,
        onError: (err) => handleGlobalError(err),
      })
    );
  }, [watch("headings"), watch("prompts"), watch("textBlocks")]);

  const checkOrganizationHasDefault = useCallback(async () => {
    try {
      const res = await axios.get("/peerreview/rubric/orgdefault");
      if (res.data.err) throw new Error(res.data.errMsg);
      if (res.data.orgID === org.orgID && res.data.hasDefault === false) {
        setDisableRubricOrgDefault(false);
      }
    } catch (err) {
      handleGlobalError(err);
    }
  }, [org.orgID, handleGlobalError]);

  const getReviewRubric = useCallback(async () => {
    try {
      if (!routeParams.rubricID) {
        handleGlobalError("No Rubric ID provided.");
        return;
      }
      const res = await axios.get("/peerreview/rubric", {
        params: { rubricID: routeParams.rubricID },
      });
      if (res.data.err) throw new Error(res.data.errMsg);
      const rubric: PeerReviewRubric = res.data.rubric;
      if (rubric.rubricID !== routeParams.rubricID) {
        throw new Error("Unable to locate rubric.");
      }
      resetForm(rubric);
      originalTitleRef.current = rubric.rubricTitle ?? "";
      if (rubric.isOrgDefault === true) {
        setDisableRubricOrgDefault(true);
        setDisableRubricTitle(true);
      } else {
        setDisableRubricOrgDefault(false);
        setDisableRubricTitle(false);
      }
      if (rubric.updatedAt) {
        setLastUpdated(formatDate(parseISO(rubric.updatedAt), DATE_FORMAT_STRING));
      } else if (rubric.createdAt) {
        setLastUpdated(formatDate(parseISO(rubric.createdAt), DATE_FORMAT_STRING));
      } else {
        setLastUpdated("Unknown");
      }
      setShowChangesWarning(false);
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setLoadedRubric(true);
    }
  }, [routeParams.rubricID, resetForm, handleGlobalError]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Peer Review Rubrics | Manage Rubric";
    if (routeParams.mode === "create") {
      setManageMode("create");
      document.title = "LibreTexts Conductor | Peer Review Rubrics | Add Rubric";
      checkOrganizationHasDefault();
      setLoadedRubric(true);
    } else if (routeParams.mode === "edit" && routeParams.rubricID) {
      setManageMode("edit");
      document.title = "LibreTexts Conductor | Peer Review Rubrics | Edit Rubric";
      getReviewRubric();
    }
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, [routeParams.mode, routeParams.rubricID]);

  const setUnsavedChanges = () => {
    if (!showChangesWarning) setShowChangesWarning(true);
  };

  function handleToggleOrgDefault(checked: boolean) {
    if (checked) {
      setValue("isOrgDefault", true);
      setDisableRubricTitle(true);
      setValue("rubricTitle", org.shortName || org.name || "");
    } else {
      setValue("isOrgDefault", false);
      setDisableRubricTitle(false);
      setValue("rubricTitle", "");
    }
    setUnsavedChanges();
  }

  function validateForm() {
    const title = getValues("rubricTitle");
    const valid = title.length >= 3 && title.length <= 201;
    setRubricTitleErr(!valid);
    return valid;
  }

  const saveRubricChanges = async () => {
    setChangesSaving(true);
    if (!validateForm()) {
      setChangesSaving(false);
      return;
    }
    try {
      const values = getValues();
      const payload: Record<string, unknown> = {
        mode: manageMode,
        headings: values.headings,
        textBlocks: values.textBlocks,
        prompts: values.prompts,
      };
      if (manageMode === "create") {
        payload.rubricTitle = values.rubricTitle;
        if (values.isOrgDefault) payload.orgDefault = true;
      } else {
        payload.rubricID = values.rubricID;
        if (values.rubricTitle !== originalTitleRef.current) {
          payload.rubricTitle = values.rubricTitle;
        }
      }
      const res = await axios.put("/peerreview/rubric", payload);
      if (res.data.err) throw new Error(res.data.errMsg);
      const rubricsURL = "/controlpanel/peerreviewrubrics";
      if (manageMode === "create") {
        history.push(`${rubricsURL}?created=true`);
      } else {
        history.push(`${rubricsURL}?saved=true`);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setChangesSaving(false);
    }
  };

  const getLastOrdering = () => {
    let lastOrdering = 0;
    allElements.forEach((block) => {
      if (block.order > lastOrdering) lastOrdering = block.order;
    });
    return lastOrdering;
  };
  const getNextOrdering = () => getLastOrdering() + 1;

  const openHeadingModal = (mode: "add" | "edit" = "add", order?: number) => {
    setHMLoading(false);
    setHMError(false);
    if (mode === "edit" && order && order > 0) {
      const editHeading = [...getValues("headings")].find(
        (item) => item.order === order
      );
      if (editHeading !== undefined) {
        setHMMode("edit");
        setHMHeading(editHeading.text);
        setHMOrder(editHeading.order);
        setShowHeadingModal(true);
      }
      return;
    }
    setHMHeading("");
    setShowHeadingModal(true);
  };

  const closeHeadingModal = () => {
    setShowHeadingModal(false);
    setHMHeading("");
    setHMOrder(0);
    setHMMode("add");
    setHMLoading(false);
    setHMError(false);
  };

  const handleSaveHeading = () => {
    if (hmHeading.trim().length === 0 || hmHeading.trim().length > 500) {
      setHMError(true);
      return;
    }
    setHMLoading(true);
    const headings = [...getValues("headings")];
    if (hmMode === "edit") {
      const editIdx = headings.findIndex((item) => item.order === hmOrder);
      if (editIdx > -1) {
        headings[editIdx] = { ...headings[editIdx], text: hmHeading.trim() };
        setValue("headings", headings);
      }
    } else {
      setValue("headings", [
        ...headings,
        { text: hmHeading.trim(), order: getNextOrdering() },
      ]);
    }
    setUnsavedChanges();
    closeHeadingModal();
  };

  const openTextModal = (mode: "add" | "edit" = "add", order?: number) => {
    setTMLoading(false);
    setTMError(false);
    if (mode === "edit" && order && order > 0) {
      const editText = [...getValues("textBlocks")].find(
        (item) => item.order === order
      );
      if (!editText) return;
      setTMMode("edit");
      setTMText(editText.text);
      setTMOrder(editText.order);
      setShowTextModal(true);
      return;
    }
    setTMText("");
    setShowTextModal(true);
  };

  const closeTextModal = () => {
    setShowTextModal(false);
    setTMText("");
    setTMOrder(0);
    setTMMode("add");
    setTMError(false);
    setTMLoading(false);
  };

  const handleSaveTextBlock = () => {
    if (tmText.trim().length === 0 || tmText.trim().length > 5000) {
      setTMError(true);
      return;
    }
    setTMLoading(true);
    const textBlocks = [...getValues("textBlocks")];
    if (tmMode === "edit") {
      const editIdx = textBlocks.findIndex((item) => item.order === tmOrder);
      if (editIdx > -1) {
        textBlocks[editIdx] = { ...textBlocks[editIdx], text: tmText.trim() };
        setValue("textBlocks", textBlocks);
      }
    } else {
      setValue("textBlocks", [
        ...textBlocks,
        { text: tmText.trim(), order: getNextOrdering() },
      ]);
    }
    setUnsavedChanges();
    closeTextModal();
  };

  const openPromptModal = (mode: "add" | "edit" = "add", order?: number) => {
    setPMLoading(false);
    if (mode === "edit" && order && order > 0) {
      const editPrompt = [...getValues("prompts")].find(
        (item) => item.order === order
      );
      if (editPrompt !== undefined) {
        setPMMode("edit");
        setPMText(editPrompt.promptText);
        setPMType(editPrompt.promptType);
        setPMRequired(editPrompt.promptRequired);
        setPMOrder(editPrompt.order);
        setPMDropdownOpts(
          editPrompt.promptType === "dropdown" && editPrompt.promptOptions
            ? editPrompt.promptOptions
            : []
        );
        setShowPromptModal(true);
      }
      return;
    }
    setPMText("");
    setPMType("");
    setPMRequired(false);
    setPMDropdownOpts([]);
    setShowPromptModal(true);
  };

  const closePromptModal = () => {
    setShowPromptModal(false);
    setPMText("");
    setPMType("");
    setPMMode("add");
    setPMOrder(0);
    setPMLoading(false);
    setPMRequired(false);
    setPMDropdownOpts([]);
    setPMDropdownNew("");
  };

  const handleSavePrompt = () => {
    if (pmType === "" || pmText.trim().length === 0) return;
    if (pmType === "dropdown" && pmDropdownOpts.length === 0) return;
    setPMLoading(true);
    const prompts = [...getValues("prompts")];
    if (pmMode === "edit") {
      const editIdx = prompts.findIndex((item) => item.order === pmOrder);
      if (editIdx > -1) {
        prompts[editIdx] = {
          ...prompts[editIdx],
          promptType: pmType,
          promptText: pmText,
          promptRequired: pmRequired,
          ...(pmType === "dropdown" && { promptOptions: pmDropdownOpts }),
        };
        setValue("prompts", prompts);
      }
    } else {
      setValue("prompts", [
        ...prompts,
        {
          promptType: pmType,
          promptText: pmText.trim(),
          promptRequired: pmRequired,
          order: getNextOrdering(),
          ...(pmType === "dropdown" && { promptOptions: pmDropdownOpts }),
        },
      ]);
    }
    setUnsavedChanges();
    closePromptModal();
  };

  const handleAddDropdownPromptOption = () => {
    const normalOption = pmDropdownNew
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z]/gm, "");
    setPMDropdownOpts([
      ...pmDropdownOpts,
      { key: normalOption, text: pmDropdownNew, value: normalOption },
    ]);
    setPMDropdownNew("");
  };

  const handleMoveDropdownPromptOption = (
    idx: number,
    direction: "up" | "down" = "up"
  ) => {
    if (
      (direction === "up" && idx > 0) ||
      (direction === "down" && idx < pmDropdownOpts.length)
    ) {
      const opts = [...pmDropdownOpts];
      const removed = opts.splice(idx, 1);
      if (direction === "up") opts.splice(idx - 1, 0, removed[0]);
      else opts.splice(idx + 1, 0, removed[0]);
      setPMDropdownOpts(opts);
    }
  };

  const handleDeleteDropdownPromptOption = (idx: number) => {
    const opts = [...pmDropdownOpts];
    opts.splice(idx, 1);
    setPMDropdownOpts(opts);
  };

  const handleRequestEditBlock = (order: number) => {
    const found = allElements.find((el) => el.order === order);
    if (!found) return;
    if (found.uiType === "heading") openHeadingModal("edit", order);
    else if (found.uiType === "prompt") openPromptModal("edit", order);
    else if (found.uiType === "textBlock") openTextModal("edit", order);
  };

  const openDeleteBlockModal = (order: number) => {
    setDBLoading(false);
    const found = allElements.find((el) => el.order === order);
    if (!found) return;
    setDBType(found.uiType);
    setDBBlock(found);
    setShowDBModal(true);
  };

  const closeDeleteBlockModal = () => {
    setShowDBModal(false);
    setDBLoading(false);
    setDBType("prompt");
    setDBBlock(undefined);
  };

  const pageTitle =
    manageMode === "create" ? "Create Peer Review Rubric" : "Edit Peer Review Rubric";

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>{pageTitle}</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item href="/controlpanel/peerreviewrubrics">
              Peer Review Rubrics
            </Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>{pageTitle}</Breadcrumb.Item>
          </Breadcrumb>
          <span className="text-sm text-gray-500">
            Last Updated: <em>{lastUpdated}</em>
          </span>
        </div>
      </Stack>

      {showChangesWarning && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800 text-sm">
          You have unsaved changes!
        </div>
      )}

      {!loadedRubric ? (
        <div className="flex justify-center py-16">
          <span className="text-gray-400">Loading...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <PeerReviewRubricInstructionsSegment
            show={showInstructions}
            toggleVisibility={() => setShowInstructions(!showInstructions)}
          />

          <div className="border border-gray-200 rounded-lg p-6">
            <Heading level={4} style={{ margin: 0 }}>
              General Rubric Settings
            </Heading>
            <Divider className="my-4" />
            <div className="max-w-md space-y-4">
              <Input
                name="rubricTitle"
                label="Rubric Title"
                value={watch("rubricTitle")}
                onChange={(e) => {
                  setValue("rubricTitle", e.target.value);
                  if (rubricTitleErr) setRubricTitleErr(false);
                  setUnsavedChanges();
                }}
                placeholder="Enter Rubric Title..."
                disabled={disableRubricTitle}
                error={rubricTitleErr}
                errorMessage="Title must be between 3 and 201 characters."
              />
              <Checkbox
                name="isOrgDefault"
                label="Use as Campus Default Rubric"
                checked={watch("isOrgDefault") === true}
                onChange={handleToggleOrgDefault}
                disabled={disableRubricOrgDefault}
              />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <Heading level={4} style={{ margin: 0 }}>
              New Peer Review
            </Heading>
            <Divider className="my-4" />
            <div className="space-y-2">
              {allElements.map((item) => (
                <EditableFormBlock
                  item={item}
                  key={item.order}
                  onMove={(item, direction) =>
                    handleMoveRubricBlock({
                      blockToMove: item,
                      direction,
                      getValueFn: getValues,
                      setValueFn: setValue,
                      onError: (err) => handleGlobalError(err),
                      onFinish: () => setUnsavedChanges(),
                    })
                  }
                  onRequestEdit={(order) => handleRequestEditBlock(order)}
                  onRequestDelete={(order) => openDeleteBlockModal(order)}
                />
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                icon={<IconHeading size={16} />}
                onClick={() => openHeadingModal("add")}
              >
                Add Heading
              </Button>
              <Button
                variant="secondary"
                icon={<IconAlignLeft size={16} />}
                onClick={() => openTextModal("add")}
              >
                Add Text
              </Button>
              <Button
                variant="secondary"
                icon={<IconQuestionMark size={16} />}
                onClick={() => openPromptModal("add")}
              >
                Add Prompt
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              icon={<IconX size={16} />}
              onClick={() => history.push("/controlpanel/peerreviewrubrics")}
            >
              Discard Changes
            </Button>
            <Button
              variant="primary"
              icon={<IconDeviceFloppy size={16} />}
              loading={changesSaving}
              onClick={saveRubricChanges}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}

      <HeadingModal
        show={showHeadingModal}
        value={hmHeading}
        onChange={(val) => setHMHeading(val)}
        hasError={hmError}
        onClose={closeHeadingModal}
        onSave={handleSaveHeading}
        mode={hmMode}
        loading={hmLoading}
      />
      <TextBlockModal
        show={showTextModal}
        value={tmText}
        onChange={(val) => setTMText(val)}
        hasError={tmError}
        onClose={closeTextModal}
        onSave={handleSaveTextBlock}
        mode={tmMode}
        loading={tmLoading}
      />
      <PromptModal
        promptType={pmType}
        promptText={pmText}
        promptReq={pmRequired}
        dropdownOptions={pmDropdownOpts}
        newOptionValue={pmDropdownNew}
        onChangeNewOptionValue={(n) => setPMDropdownNew(n)}
        onChangePromptType={(newVal) => setPMType(newVal)}
        onChangePromptText={(n) => setPMText(n)}
        onDeleteDropdownPromptOption={(n) => handleDeleteDropdownPromptOption(n)}
        onChangePromptReq={(n) => setPMRequired(n)}
        onAddDropdownPromptOption={handleAddDropdownPromptOption}
        onMoveDropdownPromptOption={(n, d) => handleMoveDropdownPromptOption(n, d)}
        show={showPromptModal}
        onClose={closePromptModal}
        onSave={handleSavePrompt}
        mode={pmMode}
        loading={pmLoading}
      />
      <DeleteBlockModal
        show={showDBModal}
        onSave={() =>
          handleDeleteRubricBlock({
            dbBlock,
            setValueFn: setValue,
            getValueFn: getValues,
            onError: (err) => handleGlobalError(err),
            onStart: () => setDBLoading(true),
            onFinish: () => {
              setDBLoading(false);
              setUnsavedChanges();
              closeDeleteBlockModal();
            },
          })
        }
        onRequestClose={() => closeDeleteBlockModal()}
        blockType={dbType}
        loading={dbLoading}
      />
    </div>
  );
};

export default PeerReviewRubricManage;
