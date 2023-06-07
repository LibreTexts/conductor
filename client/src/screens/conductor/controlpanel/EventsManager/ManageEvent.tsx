import "../../../../components/controlpanel/ControlPanel.css";

import {
  Grid,
  Header,
  Segment,
  Button,
  Icon,
  Breadcrumb,
  Message,
  Divider,
} from "semantic-ui-react";
import { useEffect, useState, useCallback } from "react";
import { Link, useHistory, useParams } from "react-router-dom";
import axios from "axios";
import DOMPurify from "dompurify";
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

const ManageEvent = () => {
  // Global State
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

  // UI
  const [manageMode, setManageMode] = useState<"create" | "edit">("create");
  const [canEdit, setCanEdit] = useState<boolean>(true);
  const [loadedOrgEvent, setLoadedOrgEvent] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showParticipants, setShowParticipants] = useState<boolean>(true);
  const [showChangesWarning, setShowChangesWarning] = useState(false);
  const [changesSaving, setChangesSaving] = useState(false);

  // Data
  const [allElements, setAllElements] = useState<CustomFormElement[]>([]);

  // Fee Waivers Segment
  const [loadedFeeWaivers, setLoadedFeeWaivers] = useState<boolean>(false);

  // Participants Segment
  const [loadedParticipants, setLoadedParticipants] = useState<boolean>(true);
  const [itemsPerPage, setItemsPerPage] = useState<number>(25);
  const [activePage, setActivePage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Event Settings Modal
  const [showEventSettingsModal, setShowEventSettingsModal] = useState(false);

  // Add/Edit Heading Modal
  const [showHeadingModal, setShowHeadingModal] = useState(false);
  const [hmMode, setHMMode] = useState<"add" | "edit">("add");
  const [hmHeading, setHMHeading] = useState("");
  const [hmOrder, setHMOrder] = useState(0);
  const [hmLoading, setHMLoading] = useState(false);
  const [hmError, setHMError] = useState(false);

  // Add/Edit Text Modal
  const [showTextModal, setShowTextModal] = useState(false);
  const [tmMode, setTMMode] = useState<"add" | "edit">("add");
  const [tmText, setTMText] = useState("");
  const [tmOrder, setTMOrder] = useState(0);
  const [tmLoading, setTMLoading] = useState(false);
  const [tmError, setTMError] = useState(false);

  // Add/Edit Prompt Modal
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [pmMode, setPMMode] = useState<"add" | "edit">("add");
  const [pmType, setPMType] = useState<CustomFormPromptType>("text");
  const [pmText, setPMText] = useState("");
  const [pmOrder, setPMOrder] = useState(0);
  const [pmRequired, setPMRequired] = useState(false);
  const [pmDropdownOpts, setPMDropdownOpts] = useState<
    GenericKeyTextValueObj<string>[]
  >([]);
  const [pmDropdownNew, setPMDropdownNew] = useState<string>("");
  const [pmLoading, setPMLoading] = useState(false);

  // Delete Block Modal
  const [showDBModal, setShowDBModal] = useState(false);
  const [dbType, setDBType] = useState<CustomFormUIType>("prompt");
  const [dbBlock, setDBBlock] = useState<CustomFormElement>();
  const [dbLoading, setDBLoading] = useState<boolean>(false);

  /**
   * Processes all rubric elements for UI presentation whenever the rubric state changes.
   */
  useEffect(() => {
    let allElem = parseAndSortElements({
      getValueFn: getValues,
      onError: (err) => handleGlobalError(err),
    });
    setAllElements(allElem);
  }, [
    setAllElements,
    watchValue("prompts"),
    watchValue("headings"),
    watchValue("textBlocks"),
  ]);

  const getOrgEventFeeWaivers = useCallback(async () => {
    try {
      if (!routeParams.eventID || manageMode === "create") return;

      setLoadedFeeWaivers(false);
      const res = await axios.get(
        `/orgevents/${routeParams.eventID}/feewaivers`
      );
      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      const feeWaivers = res.data.feeWaivers.map((item: OrgEventFeeWaiver) =>
        initOrgEventFeeWaiverDates(item)
      );
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
      const res = await axios.get(
        `/orgevents/${routeParams.eventID}/participants?page=${activePage}`
      );

      if (res.data.err) {
        throw new Error(res.data.errMsg);
      }

      // If participants have started registering, do not allow editing
      if (
        Array.isArray(res.data.participants) &&
        res.data.participants.length > 0
      ) {
        setCanEdit(false);
      }

      setValue("participants", res.data.participants);
      setTotalItems(res.data.totalCount ?? 0);
      setTotalPages(
        res.data.totalCount ? Math.ceil(res.data.totalCount / itemsPerPage) : 1
      );
    } catch (err) {
      handleGlobalError(err);
    }
    setLoadedParticipants(true);
  }, [
    routeParams,
    manageMode,
    activePage,
    itemsPerPage,
    setLoadedParticipants,
    setCanEdit,
    setTotalItems,
    setTotalPages,
    handleGlobalError,
  ]);

  /**
   * Retrieves the current Org Event configuration from the server.
   */
  const getOrgEvent = useCallback(async () => {
    try {
      if (manageMode !== "edit") return;
      if (!routeParams.eventID || isEmptyString(routeParams.eventID)) {
        handleGlobalError("No Event ID provided");
      }

      const res = await axios.get(`/orgevents/${routeParams.eventID}`);
      setLoadedOrgEvent(true);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
      }
      resetForm(initOrgEventDates(res.data.orgEvent));

      getOrgParticipants();
      getOrgEventFeeWaivers();
    } catch (err) {
      setLoadedOrgEvent(true);
      handleGlobalError(err);
    }
  }, [
    routeParams,
    manageMode,
    resetForm,
    setCanEdit,
    isEmptyString,
    setShowChangesWarning,
    setLoadedOrgEvent,
    handleGlobalError,
  ]);

  /**
   * Loads current rubric configuration and initializes editing mode, if applicable.
   */
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
      setShowEventSettingsModal(true); // Show Event Settings modal on first load
    }

    // Hook to force Markdown links to open in new window
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, [
    routeParams,
    setManageMode,
    setLoadedOrgEvent,
    setShowInstructions,
    getOrgEvent,
  ]);

  /**
   * Processes the Event configuration in state and saves it to the server, then returns to Events Manager
   */
  const saveEventChanges = async () => {
    try {
      setChangesSaving(true);

      if (routeParams.mode === "create") {
        const createRes = await axios.post("/orgevents", getValues());
        setChangesSaving(false);
        if (createRes.data.err) {
          throw new Error(createRes.data.errMsg);
        }
        if (createRes.data.orgEvent.eventID) {
          history.push(
            `/controlpanel/eventsmanager/edit/${createRes.data.orgEvent.eventID}`
          );
        }
      }

      if (routeParams.mode === "edit" && routeParams.eventID) {
        const editRes = await axios.patch(
          `/orgevents/${routeParams.eventID}`,
          getValues()
        );

        setChangesSaving(false);
        if (editRes.data.err) {
          throw new Error(editRes.data.errMsg);
        }
        getOrgEvent();
      }

      if (showEventSettingsModal) {
        setShowEventSettingsModal(false);
      }

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
      if (!deleteRes.data.err) {
        history.push("/controlpanel/eventsmanager");
        return;
      }

      handleGlobalError(deleteRes.data.errMsg);
    } catch (err) {
      handleGlobalError(err);
    }
  }

  /**
   * Enables the 'Unsaved Changes' warning if not yet visible.
   */
  const setUnsavedChanges = () => {
    if (!showChangesWarning) setShowChangesWarning(true);
  };

  const openHeadingModal = (mode: "add" | "edit" = "add", order?: number) => {
    setHMLoading(false);
    setHMError(false);
    if (mode === "edit" && order && order > 0) {
      let editHeading = [...getValues("headings")].find(
        (item) => item.order === order
      );
      if (editHeading !== undefined && typeof editHeading.text === "string") {
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

  /**
   * Closes the Heading Modal and resets its state.
   */
  const closeHeadingModal = () => {
    setShowHeadingModal(false);
    setHMHeading("");
    setHMOrder(0);
    setHMMode("add");
    setHMLoading(false);
    setHMError(false);
  };

  /**
   * Saves a new or edited Heading to state and closes the Heading Modal.
   */
  const handleSaveHeading = () => {
    if (hmHeading.trim().length === 0 && hmHeading.trim().length > 500) {
      setHMError(true);
    }

    setHMLoading(true);
    let headings = [...getValues("headings")];
    if (hmMode === "edit") {
      const editHeading = headings.find((item) => item.order === hmOrder);
      const editHeadingIdx = headings.findIndex(
        (item) => item.order === hmOrder
      );
      if (editHeading !== undefined && editHeadingIdx > -1) {
        const editedHeading = {
          ...editHeading,
          text: hmHeading.trim(),
        }; // try to preserve other fields, such as a DB ID
        headings[editHeadingIdx] = editedHeading;
        setValue("headings", headings);
      }
    } else {
      setValue("headings", [
        ...getValues("headings"),
        {
          text: hmHeading.trim(),
          order: getNextOrdering(),
        },
      ]);
    }
    setUnsavedChanges();
    closeHeadingModal();
  };

  const openTextModal = (mode: "add" | "edit" = "add", order?: number) => {
    setTMLoading(false);
    setTMError(false);

    if (mode === "edit" && order && order > 0) {
      let editText = [...getValues("textBlocks")].find(
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

  /**
   * Closes the Text Modal and resets its state.
   */
  const closeTextModal = () => {
    setShowTextModal(false);
    setTMText("");
    setTMOrder(0);
    setTMMode("add");
    setTMError(false);
    setTMLoading(false);
  };

  /**
   * Saves a new or edited Text Block to state and closes the Text Modal.
   */
  const handleSaveTextBlock = () => {
    if (tmText.trim().length === 0 && tmText.trim().length > 5000) {
      setTMError(true);
    }

    setTMLoading(true);
    if (!Array.isArray(getValues("textBlocks"))) return;
    const textBlocks = [...getValues("textBlocks")];
    if (tmMode === "edit") {
      const editItem = textBlocks.find((item) => item.order === tmOrder);
      const editIdx = textBlocks.findIndex((item) => item.order === tmOrder);
      if (editItem !== undefined && editIdx > -1) {
        const editedTextBlock = {
          ...editItem,
          text: tmText.trim(),
        }; // try to preserve other fields, such as a DB ID
        textBlocks[editIdx] = editedTextBlock;
        setValue("textBlocks", textBlocks);
      }
    } else {
      setValue("textBlocks", [
        ...getValues("textBlocks"),
        {
          text: tmText.trim(),
          order: getNextOrdering(),
        },
      ]);
    }
    setUnsavedChanges();
    closeTextModal();
  };

  const openPromptModal = (mode: "add" | "edit" = "add", order?: number) => {
    setPMLoading(false);
    if (mode === "edit" && order && order > 0) {
      let editPrompt = [...getValues("prompts")].find(
        (item) => item.order === order
      );
      if (
        editPrompt !== undefined &&
        typeof editPrompt.promptType === "string"
      ) {
        setPMMode("edit");
        setPMText(editPrompt.promptText);
        setPMType(editPrompt.promptType);
        setPMRequired(editPrompt.promptRequired);
        setPMOrder(editPrompt.order);
        if (
          editPrompt.promptType === "dropdown" &&
          Array.isArray(editPrompt.promptOptions)
        ) {
          setPMDropdownOpts(editPrompt.promptOptions);
        } else {
          setPMDropdownOpts([]);
        }
        setShowPromptModal(true);
      }
      return;
    }

    setPMText("");
    setPMType("text");
    setShowPromptModal(true);
  };

  /**
   * Closes the Prompt Modal and resets its state.
   */
  const closePromptModal = () => {
    setShowPromptModal(false);
    setPMText("");
    setPMType("text");
    setPMMode("add");
    setPMOrder(0);
    setPMLoading(false);
    setPMRequired(false);
    setPMDropdownOpts([]);
    setPMDropdownNew("");
  };

  /**
   * Saves a new or edited Prompt to state and closes the Prompt Modal.
   */
  const handleSavePrompt = () => {
    setPMLoading(true);
    const prompts = [...getValues("prompts")];
    if (pmMode === "edit") {
      const editPrompt = prompts.find((item) => item.order === pmOrder);
      const editPromptIdx = prompts.findIndex((item) => item.order === pmOrder);
      if (editPrompt !== undefined && editPromptIdx > -1) {
        const editedPrompt = {
          ...editPrompt,
          promptType: pmType,
          promptText: pmText,
          promptRequired: pmRequired,
          ...(pmType === "dropdown" && {
            promptOptions: pmDropdownOpts,
          }),
        }; // try to preserve other fields, such as a DB ID.
        prompts[editPromptIdx] = editedPrompt;
        setValue("prompts", prompts);
      }
    } else {
      const newPrompt: CustomFormPrompt = {
        promptType: pmType,
        promptText: pmText.trim(),
        promptRequired: pmRequired,
        value: "",
        order: getNextOrdering(),
        ...(pmType === "dropdown" && {
          promptOptions: pmDropdownOpts,
        }),
      };
      prompts.push(newPrompt);
      setValue("prompts", [...getValues("prompts"), newPrompt]);
    }

    setUnsavedChanges();
    closePromptModal();
  };

  /**
   * Adds a new Dropdown Prompt option to state and resets the option entry input.
   */
  const handleAddDropdownPromptOption = () => {
    let normalOption = pmDropdownNew
      .trim()
      .toLowerCase()
      .replace(/[^a-zA-Z]/gm, "");
    setPMDropdownOpts([
      ...pmDropdownOpts,
      {
        key: normalOption,
        text: pmDropdownNew,
        value: normalOption,
      },
    ]);
    setPMDropdownNew("");
  };

  /**
   * Shifts a option in a Prompt's dropdown choices to a new position.
   * @param {Number} idx - The current index of the option to move.
   * @param {String} [direction=up] - The direction to move the option in.
   */
  const handleMoveDropdownPromptOption = (idx: number, direction = "up") => {
    if (
      (direction === "up" && idx > 0) ||
      (direction === "down" && idx < pmDropdownOpts.length)
    ) {
      // dont move an element up already at the top; don't move down if already at bottom
      let dropdownOptions = [...pmDropdownOpts];
      let removedItems = dropdownOptions.splice(idx, 1);
      if (direction === "up") {
        dropdownOptions.splice(idx - 1, 0, removedItems[0]);
      } else if (direction === "down") {
        dropdownOptions.splice(idx + 1, 0, removedItems[0]);
      }
      setPMDropdownOpts(dropdownOptions);
    }
  };

  /**
   * Removes a Dropdown Prompt option from state.
   * @param {Number} idx - The option's index in the dropdown options array.
   */
  const handleDeleteDropdownPromptOption = (idx: number) => {
    let dropdownOptions = [...pmDropdownOpts];
    dropdownOptions.splice(idx, 1);
    setPMDropdownOpts(dropdownOptions);
  };

  /**
   * Determines which modal to open based on the block's type.
   * @param {number} order - The order # of the block to edit
   */
  const handleRequestEditBlock = (order: number) => {
    const foundElement = allElements.find((el) => el.order === order);
    if (!foundElement) return;

    if (foundElement.uiType === "heading") {
      openHeadingModal("edit", order);
    } else if (foundElement.uiType === "prompt") {
      openPromptModal("edit", order);
    } else if (foundElement.uiType === "textBlock") {
      openTextModal("edit", order);
    }
  };

  /**
   * Opens the Delete Block modal and saves the block to manipulate into state for later usage.
   * @param {number} order - The order # of the block to delete
   * @param {String} type - The block's type (UI-ready).
   */
  const openDeleteBlockModal = (order: number) => {
    setDBLoading(false);
    const foundElement = allElements.find((el) => el.order === order);
    if (!foundElement) return;

    let blockType: "heading" | "prompt" | "textBlock";
    if (foundElement.uiType === "heading") {
      blockType = "heading";
    } else if (foundElement.uiType === "prompt") {
      blockType = "prompt";
    } else if (foundElement.uiType === "textBlock") {
      blockType = "textBlock";
    } else {
      return;
    }

    setDBType(blockType);
    setDBBlock(foundElement);
    setShowDBModal(true);
  };

  /**
   * Closes the Delete Block Modal and resets its state.
   */
  const closeDeleteBlockModal = () => {
    setShowDBModal(false);
    setDBLoading(false);
    setDBType("heading");
    setDBBlock(undefined);
  };

  /**
   * Retrieves the 'order' property of the last inserted block in the rubric.
   * @returns {Number} The last ordering index, or 0.
   */
  const getLastOrdering = () => {
    let lastOrdering = 0;
    allElements.forEach((block) => {
      if (block.order > lastOrdering) {
        lastOrdering = block.order;
      }
    });
    return lastOrdering;
  };

  /**
   * Get the next ordering index for a new block.
   * @returns {Number} The next ordering index, or 1.
   */
  const getNextOrdering = () => {
    return getLastOrdering() + 1;
  };

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column>
          <Header className="component-header">
            {manageMode === "create" ? "Create Event" : `${getValues("title")}`}
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column>
          <Segment.Group>
            <Segment className="flex-row-div flex-row-verticalcenter">
              <div className="left-flex">
                <Breadcrumb>
                  <Breadcrumb.Section as={Link} to="/controlpanel">
                    Control Panel
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section
                    as={Link}
                    to="/controlpanel/eventsmanager"
                  >
                    Events Manager
                  </Breadcrumb.Section>
                  <Breadcrumb.Divider icon="right chevron" />
                  <Breadcrumb.Section active>
                    {manageMode === "create"
                      ? "Create Event"
                      : `${getValues("title")}`}
                  </Breadcrumb.Section>
                </Breadcrumb>
              </div>
              <div className="right-flex">
                <span className="muted-text">
                  Last Updated:{" "}
                  <em>
                    {formatDate(
                      parseISO(
                        getValues("updatedAt")?.toString() ??
                          new Date().toISOString()
                      ),
                      "MM/dd/yyyy h:mm aa"
                    )}
                  </em>
                </span>
              </div>
            </Segment>
            <Segment loading={!loadedOrgEvent}>
              {showChangesWarning && (
                <Message
                  warning
                  icon="warning sign"
                  content="You have unsaved changes!"
                  className="mt-1p"
                />
              )}
              {!canEdit && (
                <Message
                  warning
                  icon="warning sign"
                  content="Participants have already started registering for this Event. Some settings cannot be changed."
                  className="mt-1p"
                />
              )}
              <Grid padded="horizontally" relaxed>
                <Grid.Row className="mt-1p">
                  <Grid.Column>
                    <Header
                      as="h2"
                      dividing
                      className="flex-row-div flex-row-verticalcenter"
                    >
                      <span>General Settings</span>
                      <div className="right-flex">
                        <Button
                          color="blue"
                          onClick={() => setShowEventSettingsModal(true)}
                        >
                          <Icon name="edit" />
                          Edit
                        </Button>
                      </div>
                    </Header>
                    <Segment.Group size="large" raised className="mb-4p">
                      <EventSettingsSegment
                        getValuesFn={getValues}
                        org={org}
                        manageMode={manageMode}
                        loading={!loadedOrgEvent}
                      />
                    </Segment.Group>
                  </Grid.Column>
                </Grid.Row>
                {org.orgID === "libretexts" &&
                  manageMode === "edit" &&
                  !!getValues("regFee") && (
                    <Grid.Row>
                      <FeeWaiversSegment
                        feeWaivers={getValues("feeWaivers")}
                        orgEvent={getValues()}
                        loading={!loadedFeeWaivers}
                        canEdit={canEdit}
                        onUpdate={getOrgEvent}
                      />
                    </Grid.Row>
                  )}
                {manageMode === "edit" && (
                  <>
                    <Grid.Row>
                      <ParticipantsSegment
                        show={showParticipants}
                        toggleVisibility={() =>
                          setShowParticipants(!showParticipants)
                        }
                        participants={getValues("participants")}
                        orgEvent={getValues()}
                        loading={!loadedParticipants}
                        canEdit={canEdit}
                        activePage={activePage}
                        onChangeActivePage={(page) => setActivePage(page)}
                        totalItems={totalItems}
                        totalPages={totalPages}
                        itemsPerPage={itemsPerPage}
                      />
                    </Grid.Row>
                    <Grid.Row>
                      <Grid.Column>
                        <Header as="h2" dividing>
                          Registration Form
                        </Header>
                        <Segment.Group size="large" raised className="mb-4p">
                          <Segment className="peerreview-rubricedit-container">
                            <EventInstructionsSegment
                              show={showInstructions}
                              toggleVisibility={() =>
                                setShowInstructions(!showInstructions)
                              }
                            />
                            {getValues("collectShipping") && (
                              <CollectShippingMessage />
                            )}
                            {org.orgID === "libretexts" &&
                              manageMode === "edit" &&
                              getValues("regFee") !== 0 &&
                              loadedFeeWaivers &&
                              getValues("feeWaivers")?.length > 0 && (
                                <FeeWaiverInputMessage />
                              )}

                            {allElements.map((item) => {
                              return (
                                <EditableFormBlock
                                  item={item}
                                  key={item.order}
                                  onMove={(item, direction) =>
                                    handleMoveBlock({
                                      blockToMove: item,
                                      direction: direction,
                                      getValueFn: getValues,
                                      setValueFn: setValue,
                                      onError: (err) => handleGlobalError(err),
                                      onFinish: () => setUnsavedChanges(),
                                    })
                                  }
                                  onRequestEdit={(order) =>
                                    handleRequestEditBlock(order)
                                  }
                                  onRequestDelete={(order) =>
                                    openDeleteBlockModal(order)
                                  }
                                  disabled={!canEdit}
                                />
                              );
                            })}

                            <div className="peerreview-rubricedit-placeholder">
                              <Button.Group fluid color="blue">
                                <Button
                                  onClick={() => openHeadingModal("add")}
                                  disabled={!canEdit}
                                >
                                  <Icon name="heading" />
                                  Add Heading
                                </Button>
                                <Button
                                  onClick={() => openTextModal("add")}
                                  disabled={!canEdit}
                                >
                                  <Icon name="paragraph" />
                                  Add Text
                                </Button>
                                <Button
                                  onClick={() => openPromptModal("add")}
                                  disabled={!canEdit}
                                >
                                  <Icon name="question" />
                                  Add Prompt
                                </Button>
                              </Button.Group>
                            </div>
                            <Divider />
                            <Button.Group fluid>
                              <Button
                                as={Link}
                                to="/controlpanel/eventsmanager"
                                disabled={!canEdit}
                              >
                                <Icon name="cancel" />
                                Discard Changes
                              </Button>
                              <Button
                                color="green"
                                loading={changesSaving}
                                onClick={saveEventChanges}
                                disabled={!canEdit}
                              >
                                {showChangesWarning ? (
                                  <>
                                    <Icon name="save" />
                                    <span>Save Registration Form</span>
                                  </>
                                ) : (
                                  <Icon name="check" />
                                )}
                              </Button>
                            </Button.Group>
                          </Segment>
                        </Segment.Group>
                      </Grid.Column>
                    </Grid.Row>
                  </>
                )}
              </Grid>
            </Segment>
          </Segment.Group>
          <EventSettingsModal
            show={showEventSettingsModal}
            canEdit={canEdit}
            getValuesFn={getValues}
            setValueFn={setValue}
            watchValuesFn={watchValue}
            control={control}
            onClose={() => setShowEventSettingsModal(false)}
            onRequestSave={saveEventChanges}
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
            onDeleteDropdownPromptOption={(n) =>
              handleDeleteDropdownPromptOption(n)
            }
            onChangePromptReq={(n) => setPMRequired(n)}
            onAddDropdownPromptOption={handleAddDropdownPromptOption}
            onMoveDropdownPromptOption={(n, d) =>
              handleMoveDropdownPromptOption(n, d)
            }
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
                dbBlock: dbBlock,
                setValueFn: setValue,
                getValueFn: getValues,
                onError: (err) => handleGlobalError(err),
                onStart: () => {
                  setDBLoading(true);
                },
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
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default ManageEvent;
