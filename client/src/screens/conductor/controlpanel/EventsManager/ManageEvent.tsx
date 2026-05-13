import { useEffect, useState, useCallback } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
import {
  Breadcrumb,
  Button,
  Divider,
  Heading,
  Stack,
} from "@libretexts/davis-react";
import {
  IconEdit,
  IconHeading,
  IconAlignLeft,
  IconQuestionMark,
  IconDeviceFloppy,
  IconX,
} from "@tabler/icons-react";
import { isEmptyString } from "../../../../components/util/HelperFunctions";
import useGlobalError from "../../../../components/error/ErrorHooks";
import EventInstructionsSegment from "../../../../components/controlpanel/EventsManager/EventInstructionsSegment";
import HeadingModal from "../../../../components/CustomForms/HeadingModal";
import TextBlockModal from "../../../../components/CustomForms/TextBlockModal";
import PromptModal from "../../../../components/CustomForms/PromptModal";
import DeleteBlockModal from "../../../../components/CustomForms/DeleteBlockModal";
import {
  CustomFormPrompt,
  CustomFormPromptType,
  CustomFormUIType,
  CustomFormElement,
  GenericKeyTextValueObj,
  OrgEvent,
} from "../../../../types";
import { useForm } from "react-hook-form";
import { useTypedSelector } from "../../../../state/hooks";
import { format as formatDate, parseISO } from "date-fns";
import { zonedTimeToUtc } from "date-fns-tz";
import {
  handleDeleteBlock,
  handleMoveBlock,
  parseAndSortElements,
} from "../../../../utils/customFormHelpers";
import EditableFormBlock from "../../../../components/CustomForms/EditableFormBlock";
import { PTDefaultTimeZone } from "../../../../components/TimeZoneInput";
import EventSettingsModal from "../../../../components/controlpanel/EventsManager/EventSettingsModal";
import ParticipantsSegment from "../../../../components/controlpanel/EventsManager/ParticipantsSegment";
import FeeWaiversSegment from "../../../../components/controlpanel/EventsManager/FeeWaiversSegment";
import EventSettingsSegment from "../../../../components/controlpanel/EventsManager/EventSettingsSegment";
import {
  initOrgEventDates,
  initOrgEventFeeWaiverDates,
} from "../../../../utils/orgEventsHelpers";
import { OrgEventFeeWaiver } from "../../../../types/OrgEvent";
import CollectShippingMessage from "../../../../components/controlpanel/EventsManager/CollectShippingMessage";
import FeeWaiverInputMessage from "../../../../components/controlpanel/EventsManager/FeeWaiverInputMessage";
import api from "../../../../api";

const ManageEvent = () => {
  const { handleGlobalError } = useGlobalError();
  const org = useTypedSelector((state) => state.org);
  const history = useHistory();
  const routeParams = useParams<{ mode: string; eventID?: string }>();

  const {
    control,
    getValues,
    setValue,
    watch: watchValue,
    reset: resetForm,
  } = useForm<OrgEvent>({
    defaultValues: {
      title: "",
      regFee: 0,
      headings: [],
      textBlocks: [],
      prompts: [],
      timeZone: PTDefaultTimeZone,
      collectShipping: false,
    },
  });

  const [manageMode, setManageMode] = useState<"create" | "edit">("create");
  const [canEdit, setCanEdit] = useState<boolean>(true);
  const [loadedOrgEvent, setLoadedOrgEvent] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showParticipants, setShowParticipants] = useState<boolean>(true);
  const [showRegForm, setShowRegForm] = useState<boolean>(true);
  const [showChangesWarning, setShowChangesWarning] = useState(false);
  const [changesSaving, setChangesSaving] = useState(false);

  const [allElements, setAllElements] = useState<CustomFormElement[]>([]);
  const [projectSyncTitle, setProjectSyncTitle] = useState('');

  const [loadedFeeWaivers, setLoadedFeeWaivers] = useState<boolean>(false);
  const [loadedParticipants, setLoadedParticipants] = useState<boolean>(true);
  const [autoSyncSuccess, setAutoSyncSuccess] = useState<boolean>(false);
  const [itemsPerPage] = useState<number>(25);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  const [showEventSettingsModal, setShowEventSettingsModal] = useState(false);

  const [showHeadingModal, setShowHeadingModal] = useState(false);
  const [hmMode, setHMMode] = useState<"add" | "edit">("add");
  const [hmHeading, setHMHeading] = useState("");
  const [hmOrder, setHMOrder] = useState(0);
  const [hmLoading, setHMLoading] = useState(false);
  const [hmError, setHMError] = useState(false);

  const [showTextModal, setShowTextModal] = useState(false);
  const [tmMode, setTMMode] = useState<"add" | "edit">("add");
  const [tmText, setTMText] = useState("");
  const [tmOrder, setTMOrder] = useState(0);
  const [tmLoading, setTMLoading] = useState(false);
  const [tmError, setTMError] = useState(false);

  const [showPromptModal, setShowPromptModal] = useState(false);
  const [pmMode, setPMMode] = useState<"add" | "edit">("add");
  const [pmType, setPMType] = useState<CustomFormPromptType>("text");
  const [pmText, setPMText] = useState("");
  const [pmOrder, setPMOrder] = useState(0);
  const [pmRequired, setPMRequired] = useState(false);
  const [pmDropdownOpts, setPMDropdownOpts] = useState<GenericKeyTextValueObj<string>[]>([]);
  const [pmDropdownNew, setPMDropdownNew] = useState<string>("");
  const [pmLoading, setPMLoading] = useState(false);

  const [showDBModal, setShowDBModal] = useState(false);
  const [dbType, setDBType] = useState<CustomFormUIType>("prompt");
  const [dbBlock, setDBBlock] = useState<CustomFormElement>();
  const [dbLoading, setDBLoading] = useState<boolean>(false);

  useEffect(() => {
    let allElem = parseAndSortElements({
      getValueFn: getValues,
      onError: (err) => handleGlobalError(err),
    });
    setAllElements(allElem);
  }, [setAllElements, watchValue("prompts"), watchValue("headings"), watchValue("textBlocks")]);

  const getOrgEventFeeWaivers = useCallback(async () => {
    try {
      if (!routeParams.eventID || manageMode === "create") return;
      setLoadedFeeWaivers(false);
      const res = await axios.get(`/orgevents/${routeParams.eventID}/feewaivers`);
      if (res.data.err) throw new Error(res.data.errMsg);
      const feeWaivers = res.data.feeWaivers.map((item: OrgEventFeeWaiver) => initOrgEventFeeWaiverDates(item));
      setValue("feeWaivers", feeWaivers);
    } catch (err) {
      handleGlobalError(err);
    }
    setLoadedFeeWaivers(true);
  }, [routeParams, manageMode, setLoadedFeeWaivers, handleGlobalError]);

  const getOrgParticipants = useCallback(async () => {
    try {
      if (!routeParams.eventID || manageMode === "create") return;
      setLoadedParticipants(false);
      const res = await axios.get(`/orgevents/${routeParams.eventID}/participants?page=${activePage}`);
      if (res.data.err) throw new Error(res.data.errMsg);
      if (Array.isArray(res.data.participants) && res.data.participants.length > 0) {
        setCanEdit(false);
      }
      setValue("participants", res.data.participants);
      setTotalItems(res.data.totalCount ?? 0);
      setTotalPages(res.data.totalCount ? Math.ceil(res.data.totalCount / itemsPerPage) : 1);
    } catch (err) {
      handleGlobalError(err);
    }
    setLoadedParticipants(true);
  }, [routeParams, manageMode, activePage, itemsPerPage, handleGlobalError]);

  useEffect(() => { getOrgParticipants(); }, [activePage]);

  const getOrgEvent = useCallback(async () => {
    try {
      if (routeParams.mode !== "edit" || !routeParams.eventID || isEmptyString(routeParams.eventID)) return;
      const res = await axios.get(`/orgevents/${routeParams.eventID}`);
      setLoadedOrgEvent(true);
      if (res.data.err) { handleGlobalError(res.data.errMsg); }
      resetForm(initOrgEventDates(res.data.orgEvent));
      getOrgParticipants();
      getOrgEventFeeWaivers();
    } catch (err) {
      setLoadedOrgEvent(true);
      handleGlobalError(err);
    }
  }, [routeParams, resetForm, handleGlobalError]);

  const getSyncedProject = useCallback(async () => {
    const projectID = getValues('projectSyncID');
    if (projectID) {
      const res = await api.getProject(projectID);
      if (res.data.err) { console.error(res.data.errMsg); }
      setProjectSyncTitle(res.data?.project?.title ?? '');
    }
  }, [watchValue('projectSyncID'), setProjectSyncTitle]);

  useEffect(() => { getSyncedProject(); }, [getSyncedProject]);

  useEffect(() => {
    document.title = "LibreTexts Conductor | Events | Manage Events";
    if (!routeParams.mode) return;
    if (routeParams.mode === "edit" && routeParams.eventID) {
      document.title = "LibreTexts Conductor | Events | Edit Event";
      setManageMode("edit");
      getOrgEvent();
    } else {
      document.title = "LibreTexts Conductor | Events | Create Event";
      setManageMode("create");
      setLoadedOrgEvent(true);
      setShowEventSettingsModal(true);
    }
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, [routeParams]);

  function updateStateAndSave(newData: OrgEvent) {
    resetForm(newData);
    saveEventChanges();
  }

  const saveEventChanges = async () => {
    try {
      setChangesSaving(true);
      if (routeParams.mode === "create") {
        const createRes = await axios.post("/orgevents", {
          ...getValues(),
          regOpenDate: zonedTimeToUtc(getValues().regOpenDate, getValues().timeZone.value),
          regCloseDate: zonedTimeToUtc(getValues().regCloseDate, getValues().timeZone.value),
          startDate: zonedTimeToUtc(getValues().startDate, getValues().timeZone.value),
          endDate: zonedTimeToUtc(getValues().endDate, getValues().timeZone.value),
        });
        setChangesSaving(false);
        if (createRes.data.err) throw new Error(createRes.data.errMsg);
        if (createRes.data.orgEvent.eventID) {
          history.push(`/controlpanel/eventsmanager/edit/${createRes.data.orgEvent.eventID}`);
        }
      }
      if (routeParams.mode === "edit" && routeParams.eventID) {
        const editRes = await axios.patch(`/orgevents/${routeParams.eventID}`, {
          ...getValues(),
          regOpenDate: zonedTimeToUtc(getValues().regOpenDate, getValues().timeZone.value),
          regCloseDate: zonedTimeToUtc(getValues().regCloseDate, getValues().timeZone.value),
          startDate: zonedTimeToUtc(getValues().startDate, getValues().timeZone.value),
          endDate: zonedTimeToUtc(getValues().endDate, getValues().timeZone.value),
        });
        setChangesSaving(false);
        if (editRes.data.err) throw new Error(editRes.data.errMsg);
        await getOrgEvent();
      }
      if (showEventSettingsModal) setShowEventSettingsModal(false);
      setShowChangesWarning(false);
    } catch (err) {
      setChangesSaving(false);
      handleGlobalError(err);
    }
  };

  async function handleCancelEvent() {
    try {
      setChangesSaving(true);
      if (routeParams.mode === "create" || !getValues("eventID")) return;
      let deleteRes = await axios.delete(`/orgevents/${getValues("eventID")}`);
      setChangesSaving(false);
      if (!deleteRes.data.err) { history.push("/controlpanel/eventsmanager"); return; }
      handleGlobalError(deleteRes.data.errMsg);
    } catch (err) { handleGlobalError(err); }
  }

  async function handleDownloadParticipants() {
    try {
      if (routeParams.mode !== "edit" || !getValues("eventID")) return;
      if (!getValues("participants") || getValues("participants").length === 0) return;
      const response = await axios.get(`/orgevents/${getValues("eventID")}/participants/download`);
      if (response.data.err) throw new Error(response.data.errMsg);
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${getValues("title")} Participants.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) { handleGlobalError(err); }
  }

  async function handleUnregisterParticipants(regIds: string[]) {
    try {
      if (routeParams.mode !== "edit" || !getValues("eventID")) return;
      const response = await axios.delete(`/orgevents/${getValues("eventID")}/participants`, { data: { participants: regIds } });
      if (response.data.err) throw new Error(response.data.errMsg);
      getOrgParticipants();
    } catch (err) { handleGlobalError(err); }
  }

  async function handleConfigureAutoSync(projectID: string) {
    try {
      if (!projectID || !getValues("eventID")) return;
      const res = await axios.put(`/orgevents/${getValues("eventID")}/configure-sync/${projectID}`);
      if (res.data.err) throw new Error(res.data.errMsg);
      setAutoSyncSuccess(true);
      getOrgEvent();
    } catch (err) { handleGlobalError(err); }
  }

  const setUnsavedChanges = () => { if (!showChangesWarning) setShowChangesWarning(true); };

  const openHeadingModal = (mode: "add" | "edit" = "add", order?: number) => {
    setHMLoading(false); setHMError(false);
    if (mode === "edit" && order && order > 0) {
      let editHeading = [...getValues("headings")].find((item) => item.order === order);
      if (editHeading !== undefined && typeof editHeading.text === "string") {
        setHMMode("edit"); setHMHeading(editHeading.text); setHMOrder(editHeading.order); setShowHeadingModal(true);
      }
      return;
    }
    setHMHeading(""); setShowHeadingModal(true);
  };

  const closeHeadingModal = () => {
    setShowHeadingModal(false); setHMHeading(""); setHMOrder(0); setHMMode("add"); setHMLoading(false); setHMError(false);
  };

  const handleSaveHeading = () => {
    if (hmHeading.trim().length === 0 && hmHeading.trim().length > 500) setHMError(true);
    setHMLoading(true);
    let headings = [...getValues("headings")];
    if (hmMode === "edit") {
      const editHeading = headings.find((item) => item.order === hmOrder);
      const editHeadingIdx = headings.findIndex((item) => item.order === hmOrder);
      if (editHeading !== undefined && editHeadingIdx > -1) {
        headings[editHeadingIdx] = { ...editHeading, text: hmHeading.trim() };
        setValue("headings", headings);
      }
    } else {
      setValue("headings", [...getValues("headings"), { text: hmHeading.trim(), order: getNextOrdering() }]);
    }
    setUnsavedChanges(); closeHeadingModal();
  };

  const openTextModal = (mode: "add" | "edit" = "add", order?: number) => {
    setTMLoading(false); setTMError(false);
    if (mode === "edit" && order && order > 0) {
      let editText = [...getValues("textBlocks")].find((item) => item.order === order);
      if (!editText) return;
      setTMMode("edit"); setTMText(editText.text); setTMOrder(editText.order); setShowTextModal(true);
      return;
    }
    setTMText(""); setShowTextModal(true);
  };

  const closeTextModal = () => {
    setShowTextModal(false); setTMText(""); setTMOrder(0); setTMMode("add"); setTMError(false); setTMLoading(false);
  };

  const handleSaveTextBlock = () => {
    if (tmText.trim().length === 0 && tmText.trim().length > 5000) setTMError(true);
    setTMLoading(true);
    if (!Array.isArray(getValues("textBlocks"))) return;
    const textBlocks = [...getValues("textBlocks")];
    if (tmMode === "edit") {
      const editItem = textBlocks.find((item) => item.order === tmOrder);
      const editIdx = textBlocks.findIndex((item) => item.order === tmOrder);
      if (editItem !== undefined && editIdx > -1) {
        textBlocks[editIdx] = { ...editItem, text: tmText.trim() };
        setValue("textBlocks", textBlocks);
      }
    } else {
      setValue("textBlocks", [...getValues("textBlocks"), { text: tmText.trim(), order: getNextOrdering() }]);
    }
    setUnsavedChanges(); closeTextModal();
  };

  const openPromptModal = (mode: "add" | "edit" = "add", order?: number) => {
    setPMLoading(false);
    if (mode === "edit" && order && order > 0) {
      let editPrompt = [...getValues("prompts")].find((item) => item.order === order);
      if (editPrompt !== undefined && typeof editPrompt.promptType === "string") {
        setPMMode("edit"); setPMText(editPrompt.promptText); setPMType(editPrompt.promptType);
        setPMRequired(editPrompt.promptRequired); setPMOrder(editPrompt.order);
        if (editPrompt.promptType === "dropdown" && Array.isArray(editPrompt.promptOptions)) {
          setPMDropdownOpts(editPrompt.promptOptions);
        } else { setPMDropdownOpts([]); }
        setShowPromptModal(true);
      }
      return;
    }
    setPMText(""); setPMType("text"); setShowPromptModal(true);
  };

  const closePromptModal = () => {
    setShowPromptModal(false); setPMText(""); setPMType("text"); setPMMode("add"); setPMOrder(0);
    setPMLoading(false); setPMRequired(false); setPMDropdownOpts([]); setPMDropdownNew("");
  };

  const handleSavePrompt = () => {
    setPMLoading(true);
    const prompts = [...getValues("prompts")];
    if (pmMode === "edit") {
      const editPrompt = prompts.find((item) => item.order === pmOrder);
      const editPromptIdx = prompts.findIndex((item) => item.order === pmOrder);
      if (editPrompt !== undefined && editPromptIdx > -1) {
        prompts[editPromptIdx] = {
          ...editPrompt, promptType: pmType, promptText: pmText, promptRequired: pmRequired,
          ...(pmType === "dropdown" && { promptOptions: pmDropdownOpts }),
        };
        setValue("prompts", prompts);
      }
    } else {
      const newPrompt: CustomFormPrompt = {
        promptType: pmType, promptText: pmText.trim(), promptRequired: pmRequired, value: "",
        order: getNextOrdering(), ...(pmType === "dropdown" && { promptOptions: pmDropdownOpts }),
      };
      prompts.push(newPrompt);
      setValue("prompts", [...getValues("prompts"), newPrompt]);
    }
    setUnsavedChanges(); closePromptModal();
  };

  const handleAddDropdownPromptOption = () => {
    let normalOption = pmDropdownNew.trim().toLowerCase().replace(/[^a-zA-Z]/gm, "");
    setPMDropdownOpts([...pmDropdownOpts, { key: normalOption, text: pmDropdownNew, value: normalOption }]);
    setPMDropdownNew("");
  };

  const handleMoveDropdownPromptOption = (idx: number, direction = "up") => {
    if ((direction === "up" && idx > 0) || (direction === "down" && idx < pmDropdownOpts.length)) {
      let opts = [...pmDropdownOpts];
      let removed = opts.splice(idx, 1);
      if (direction === "up") opts.splice(idx - 1, 0, removed[0]);
      else opts.splice(idx + 1, 0, removed[0]);
      setPMDropdownOpts(opts);
    }
  };

  const handleDeleteDropdownPromptOption = (idx: number) => {
    let opts = [...pmDropdownOpts];
    opts.splice(idx, 1);
    setPMDropdownOpts(opts);
  };

  const handleRequestEditBlock = (order: number) => {
    const foundElement = allElements.find((el) => el.order === order);
    if (!foundElement) return;
    if (foundElement.uiType === "heading") openHeadingModal("edit", order);
    else if (foundElement.uiType === "prompt") openPromptModal("edit", order);
    else if (foundElement.uiType === "textBlock") openTextModal("edit", order);
  };

  const openDeleteBlockModal = (order: number) => {
    setDBLoading(false);
    const foundElement = allElements.find((el) => el.order === order);
    if (!foundElement) return;
    let blockType: "heading" | "prompt" | "textBlock";
    if (foundElement.uiType === "heading") blockType = "heading";
    else if (foundElement.uiType === "prompt") blockType = "prompt";
    else if (foundElement.uiType === "textBlock") blockType = "textBlock";
    else return;
    setDBType(blockType); setDBBlock(foundElement); setShowDBModal(true);
  };

  const closeDeleteBlockModal = () => {
    setShowDBModal(false); setDBLoading(false); setDBType("heading"); setDBBlock(undefined);
  };

  const getLastOrdering = () => {
    let lastOrdering = 0;
    allElements.forEach((block) => { if (block.order > lastOrdering) lastOrdering = block.order; });
    return lastOrdering;
  };

  const getNextOrdering = () => getLastOrdering() + 1;

  const pageTitle = manageMode === "create" ? "Create Event" : getValues("title");

  return (
    <div className="bg-white h-full px-8 pt-8">
      <Stack direction="vertical" gap="md" className="mb-4">
        <Heading level={2}>{pageTitle}</Heading>
        <div className="flex items-center justify-between">
          <Breadcrumb aria-label="Page navigation">
            <Breadcrumb.Item href="/controlpanel">Control Panel</Breadcrumb.Item>
            <Breadcrumb.Item href="/controlpanel/eventsmanager">Events Manager</Breadcrumb.Item>
            <Breadcrumb.Item isCurrent>{pageTitle}</Breadcrumb.Item>
          </Breadcrumb>
          <span className="text-sm text-gray-500">
            Last Updated:{" "}
            <em>
              {formatDate(
                parseISO(getValues("updatedAt")?.toString() ?? new Date().toISOString()),
                "MM/dd/yyyy h:mm aa"
              )}
            </em>
          </span>
        </div>
      </Stack>

      {showChangesWarning && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800 text-sm">
          You have unsaved changes!
        </div>
      )}
      {!canEdit && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-md text-yellow-800 text-sm">
          Participants have already started registering for this Event. Some settings cannot be changed.
        </div>
      )}

      {!loadedOrgEvent ? (
        <div className="flex justify-center py-16">
          <span className="text-gray-400">Loading...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* General Settings */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <Heading level={4} style={{ margin: 0 }}>General Settings</Heading>
              <Button
                variant="primary"
                icon={<IconEdit size={16} />}
                onClick={() => setShowEventSettingsModal(true)}
              >
                Edit
              </Button>
            </div>
            <Divider />
            <div className="mt-4">
              <EventSettingsSegment
                getValuesFn={getValues}
                org={org}
                manageMode={manageMode}
                loading={!loadedOrgEvent}
                projectSyncID={getValues('projectSyncID')}
                projectSyncTitle={projectSyncTitle}
              />
            </div>
          </div>

          {/* Fee Waivers */}
          {org.orgID === "libretexts" && manageMode === "edit" && !!watchValue("regFee") && (
            <FeeWaiversSegment
              feeWaivers={watchValue("feeWaivers")}
              orgEvent={getValues()}
              loading={!loadedFeeWaivers}
              canEdit={canEdit}
              onUpdate={getOrgEvent}
            />
          )}

          {/* Participants */}
          {manageMode === "edit" && (
            <ParticipantsSegment
              show={showParticipants}
              toggleVisibility={() => setShowParticipants(!showParticipants)}
              participants={getValues("participants")}
              orgEvent={getValues()}
              loading={!loadedParticipants}
              canEdit={canEdit}
              autoSyncSuccess={autoSyncSuccess}
              activePage={activePage}
              onDownloadParticipants={handleDownloadParticipants}
              onChangeActivePage={(page) => setActivePage(page)}
              onUnregisterParticipants={(regIds) => handleUnregisterParticipants(regIds)}
              onConfigureAutoSync={(projectID) => handleConfigureAutoSync(projectID)}
              totalItems={totalItems}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
            />
          )}

          {/* Registration Form */}
          {manageMode === "edit" && (
            <div className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <Heading level={4} style={{ margin: 0 }}>Registration Form</Heading>
                <Button variant="secondary" onClick={() => setShowRegForm(!showRegForm)}>
                  {showRegForm ? "Hide" : "Show"}
                </Button>
              </div>
              <Divider />
              {showRegForm ? (
                <div className="mt-4 flex flex-col gap-3">
                  <EventInstructionsSegment
                    show={showInstructions}
                    toggleVisibility={() => setShowInstructions(!showInstructions)}
                  />
                  {watchValue("collectShipping") && <CollectShippingMessage />}
                  {org.orgID === "libretexts" && manageMode === "edit" &&
                    watchValue("regFee") !== 0 && loadedFeeWaivers &&
                    watchValue("feeWaivers")?.length > 0 && (
                      <FeeWaiverInputMessage />
                    )}

                  <div className="space-y-2">
                    {allElements.map((item) => (
                      <EditableFormBlock
                        item={item}
                        key={item.order}
                        onMove={(item, direction) =>
                          handleMoveBlock({
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
                        disabled={!canEdit}
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      icon={<IconHeading size={16} />}
                      onClick={() => openHeadingModal("add")}
                      disabled={!canEdit}
                    >
                      Add Heading
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<IconAlignLeft size={16} />}
                      onClick={() => openTextModal("add")}
                      disabled={!canEdit}
                    >
                      Add Text
                    </Button>
                    <Button
                      variant="secondary"
                      icon={<IconQuestionMark size={16} />}
                      onClick={() => openPromptModal("add")}
                      disabled={!canEdit}
                    >
                      Add Prompt
                    </Button>
                  </div>

                  <Divider className="my-4" />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      icon={<IconX size={16} />}
                      onClick={() => history.push("/controlpanel/eventsmanager")}
                      disabled={!canEdit}
                    >
                      Discard Changes
                    </Button>
                    <Button
                      variant="primary"
                      icon={<IconDeviceFloppy size={16} />}
                      loading={changesSaving}
                      onClick={saveEventChanges}
                      disabled={!canEdit}
                    >
                      {showChangesWarning ? "Save Registration Form" : "Saved"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-gray-500 text-sm">Collapsed for brevity… Click "Show" to view</p>
              )}
            </div>
          )}
        </div>
      )}

      <EventSettingsModal
        show={showEventSettingsModal}
        canEdit={canEdit}
        orgEvent={getValues()}
        onClose={() => setShowEventSettingsModal(false)}
        onRequestSave={(newData) => updateStateAndSave(newData)}
        onRequestCancelEvent={handleCancelEvent}
      />
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
          handleDeleteBlock({
            dbBlock,
            setValueFn: setValue,
            getValueFn: getValues,
            onError: (err) => handleGlobalError(err),
            onStart: () => setDBLoading(true),
            onFinish: () => { setDBLoading(false); setUnsavedChanges(); closeDeleteBlockModal(); },
          })
        }
        onRequestClose={() => closeDeleteBlockModal()}
        blockType={dbType}
        loading={dbLoading}
      />
    </div>
  );
};

export default ManageEvent;
