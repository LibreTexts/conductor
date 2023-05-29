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
  Form,
  Accordion,
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
import CtlTextInput from "../../../../components/ControlledInputs/CtlTextInput";
import { required } from "../../../../utils/formRules";
import { useTypedSelector } from "../../../../state/hooks";
import CtlDateInput from "../../../../components/ControlledInputs/CtlDateInput";
import { format, parseISO } from "date-fns";
import CancelEventModalProps from "../../../../components/controlpanel/EventsManager/CancelEventModal";
import {
  handleDeleteBlock,
  handleMoveBlock,
  parseAndSortElements,
} from "../../../../utils/customFormHelpers";
import EditableFormBlock from "../../../../components/CustomForms/EditableFormBlock";
import CtlTimeInput from "../../../../components/ControlledInputs/CtlTimeInput";
import { PTDefaultTimeZone } from "../../../../components/TimeZoneInput";
import CtlTimeZoneInput from "../../../../components/ControlledInputs/CtlTimeZoneInput";

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
      regOpenDate: new Date(),
      regCloseDate: new Date(),
      startDate: new Date(),
      endDate: new Date(),
      regFee: 0,
      headings: [],
      textBlocks: [],
      prompts: [],
      timeZone: PTDefaultTimeZone,
    },
  });

  // UI
  const [manageMode, setManageMode] = useState<"create" | "edit">("create");
  const [canEdit, setCanEdit] = useState<boolean>(true);
  const [loadedOrgEvent, setLoadedOrgEvent] = useState<boolean>(false);
  const [showInstructions, setShowInstructions] = useState<boolean>(false);
  const [showChangesWarning, setShowChangesWarning] = useState(false);
  const [changesSaving, setChangesSaving] = useState(false);

  // Data
  const [allElements, setAllElements] = useState<CustomFormElement[]>([]);

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
  const [pmTypeError, setPMTypeError] = useState(false);
  const [pmTextError, setPMTextError] = useState(false);
  const [pmDropdownError, setPMDropdownError] = useState(false);

  // Delete Block Modal
  const [showDBModal, setShowDBModal] = useState(false);
  const [dbType, setDBType] = useState<CustomFormUIType>("prompt");
  const [dbBlock, setDBBlock] = useState<CustomFormElement>();
  const [dbLoading, setDBLoading] = useState<boolean>(false);

  // Cancel Event Modal
  const [showCancelEventModal, setShowCancelEventModal] =
    useState<boolean>(false);

  useEffect(() => {
    console.log(getValues("regOpenDate"));
  }, [watchValue("regOpenDate")]);

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

  /**
   * Retrieves the current Org Event configuration from the server.
   */
  const getOrgEvent = useCallback(async () => {
    try {
      if (!routeParams.eventID || isEmptyString(routeParams.eventID)) {
        handleGlobalError("No Event ID provided");
      }

      const res = await axios.get(`/orgevents/${routeParams.eventID}`);
      setLoadedOrgEvent(true);
      if (res.data.err) {
        handleGlobalError(res.data.errMsg);
      }
      resetForm(res.data.orgEvent);

      // If participants have started registering, do not allow editing
      if (
        Array.isArray(res.data.orgEvent.participants) &&
        res.data.orgEvent.participants.length > 0
      ) {
        setCanEdit(false);
      }
    } catch (err) {
      setLoadedOrgEvent(true);
      handleGlobalError(err);
    }
  }, [
    routeParams,
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

  const validateForm = () => {
    let valid = true;
    //TODO
    return valid;
  };

  /**
   * Processes the Event configuration in state and saves it to the server, then returns to Events Manager
   */
  const saveEventChanges = async () => {
    try {
      setChangesSaving(true);
      if (!validateForm()) {
        setChangesSaving(false);
      }

      console.log(getValues());
      if (routeParams.mode === "create") {
        let createRes = await axios.post("/orgevents", getValues());
        setChangesSaving(false);
        if (!createRes.data.err) {
          history.push("/controlpanel/eventsmanager");
          return;
        }
        handleGlobalError(createRes.data.errMsg);
      }

      if (routeParams.mode === "edit" && routeParams.eventID) {
        let editRes = await axios.patch(
          `/orgevents/${routeParams.eventID}`,
          getValues()
        );

        setChangesSaving(false);
        if (!editRes.data.err) {
          history.push("/controlpanel/eventsmanager");
          return;
        }

        handleGlobalError(editRes.data.errMsg);
      }
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
      let editHeading = headings.find((item) => item.order === hmOrder);
      let editHeadingIdx = headings.findIndex((item) => item.order === hmOrder);
      if (editHeading !== undefined && editHeadingIdx > -1) {
        let editedHeading = {
          ...editHeading,
          text: hmHeading.trim(),
        }; // try to preserve other fields, such as a DB ID
        headings[editHeadingIdx] = editedHeading;
      }
    } else {
      setValue("headings", [
        ...getValues("headings"),
        {
          text: hmHeading.trim(),
          order: getLastOrdering() + 1,
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
    let textBlocks = [...getValues("textBlocks")];
    if (tmMode === "edit") {
      let editItem = textBlocks.find((item) => item.order === tmOrder);
      let editIdx = textBlocks.findIndex((item) => item.order === tmOrder);
      if (editItem === undefined || editIdx > -1) {
        return;
      }

      let newTextBlock = {
        ...editItem,
        text: tmText.trim(),
      }; // try to preserve other fields, such as a DB ID
      textBlocks.splice(editIdx, 1, newTextBlock);
    } else {
      setValue("textBlocks", [
        ...getValues("textBlocks"),
        {
          text: tmText.trim(),
          order: getLastOrdering() + 1,
        },
      ]);
    }
    setUnsavedChanges();
    closeTextModal();
  };

  const openPromptModal = (mode: "add" | "edit" = "add", order?: number) => {
    setPMLoading(false);
    setPMTypeError(false);
    setPMTextError(false);
    setPMDropdownError(false);
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
    setPMTypeError(false);
    setPMTextError(false);
    setPMDropdownError(false);
  };

  /**
   * Validates the Add/Edit Prompt form.
   * @returns {Boolean} True if valid form, false otherwise.
   */
  const validatePromptForm = () => {
    let valid = true;
    if (isEmptyString(pmType)) {
      valid = false;
      setPMTypeError(true);
    }
    if (isEmptyString(pmText)) {
      valid = false;
      setPMTextError(true);
    }
    if (
      pmType === "dropdown" &&
      (pmDropdownOpts.length < 1 || pmDropdownOpts.length > 10)
    ) {
      valid = false;
      setPMDropdownError(true);
    }
    return valid;
  };

  /**
   * Saves a new or edited Prompt to state and closes the Prompt Modal.
   */
  const handleSavePrompt = () => {
    setPMLoading(true);
    setPMTypeError(false);
    setPMTextError(false);
    setPMDropdownError(false);
    if (!validatePromptForm()) {
      setPMLoading(false);
    }
    let prompts = [...getValues("prompts")];
    if (pmMode === "edit") {
      let editPrompt = prompts.find((item) => item.order === pmOrder);
      let editPromptIdx = prompts.findIndex((item) => item.order === pmOrder);
      if (editPrompt !== undefined && editPromptIdx > -1) {
        let editedPrompt = {
          ...editPrompt,
          promptType: pmType,
          promptText: pmText,
          promptRequired: pmRequired,
        }; // try to preserve other fields, such as a DB ID.
        if (pmType === "dropdown") editedPrompt.promptOptions = pmDropdownOpts;
        prompts[editPromptIdx] = editedPrompt;
        setValue("prompts", prompts);
      }
    } else {
      let newPrompt: CustomFormPrompt = {
        promptType: pmType,
        promptText: pmText.trim(),
        promptRequired: pmRequired,
        value: "",
        order: getLastOrdering() + 1,
      };
      if (pmType === "dropdown") newPrompt.promptOptions = pmDropdownOpts;
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
    if (pmDropdownNew.trim().length === 0 && pmDropdownNew.length > 250) {
      setPMDropdownError(true);
    }

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
    setPMDropdownError(false);
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
    let foundElement = allElements.find((el) => el.order === order);
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

  return (
    <Grid className="controlpanel-container" divided="vertically">
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className="component-header">
            {manageMode === "create" ? "Create" : "Edit"} Event
          </Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment>
              <div className="flex-row-div">
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
                      {manageMode === "create" ? "Create" : "Edit"} Event
                    </Breadcrumb.Section>
                  </Breadcrumb>
                </div>
                <div className="right-flex">
                  <span className="muted-text">
                    Last Updated:{" "}
                    <em>
                      {format(
                        parseISO(
                          getValues("updatedAt")?.toString() ??
                            new Date().toISOString()
                        ),
                        "MM/dd/yyyy h:mm aa"
                      )}
                    </em>
                  </span>
                </div>
              </div>
            </Segment>
            <Segment loading={!loadedOrgEvent}>
              <EventInstructionsSegment
                show={showInstructions}
                toggleVisibility={() => setShowInstructions(!showInstructions)}
                className="mb-4p"
              />
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
                  content="Participants have already registered for this Event. You cannot make changes at this time."
                  className="mt-1p"
                />
              )}
              <Segment className="mt-1p mb-3p">
                <Header as="p" size="medium">
                  General Event Settings
                </Header>
                <Form noValidate>
                  <CtlTextInput
                    name="title"
                    control={control}
                    rules={required}
                    label="Event Title"
                    placeholder="Enter Event Title..."
                    disabled={!canEdit}
                  />
                  <div className="flex-row-div left-flex">
                    <CtlDateInput
                      name="regOpenDate"
                      control={control}
                      rules={required}
                      label="Registration Open Date"
                      value={getValues("regOpenDate")}
                      error={false}
                      className="my-2p"
                      disabled={!canEdit}
                    />
                    <CtlTimeInput
                      label="Registration Open Time"
                      value={getValues("regOpenDate")}
                      name="regOpenDate"
                      control={control}
                      className="my-2p ml-2p"
                      disabled={!canEdit}
                    />
                    <CtlTimeZoneInput
                      name="timeZone"
                      control={control}
                      label="Time Zone (applies to all dates/times)"
                      value={getValues("timeZone")}
                      className="my-2p ml-2p"
                      disabled={!canEdit}
                      //onChange={setSelectedTimezone}
                    />
                  </div>
                  <div className="flex-row-div left-flex">
                    <CtlDateInput
                      name="regCloseDate"
                      control={control}
                      rules={required}
                      label="Registration Close Date"
                      value={getValues("regCloseDate")}
                      error={false}
                      className="my-2p"
                      disabled={!canEdit}
                    />
                    <CtlTimeInput
                      label="Registration Close Time"
                      value={getValues("regCloseDate")}
                      name="regCloseDate"
                      control={control}
                      className="my-2p ml-2p"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex-row-div left-flex">
                    <CtlDateInput
                      name="startDate"
                      control={control}
                      rules={required}
                      label="Event Start Date"
                      value={getValues("startDate")}
                      error={false}
                      className="my-2p"
                      disabled={!canEdit}
                    />
                    <CtlTimeInput
                      label="Event Start Time"
                      value={getValues("startDate")}
                      name="startDate"
                      control={control}
                      className="my-2p ml-2p"
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="flex-row-div left-flex">
                    <CtlDateInput
                      name="endDate"
                      control={control}
                      rules={required}
                      label="Event End Date"
                      value={getValues("endDate")}
                      error={false}
                      className="my-2p"
                      disabled={!canEdit}
                    />
                    <CtlTimeInput
                      label="Event End Time"
                      value={getValues("endDate")}
                      name="endDate"
                      control={control}
                      className="my-2p ml-2p"
                      disabled={!canEdit}
                    />
                  </div>
                  {org.orgID === "libretexts" && (
                    <CtlTextInput
                      name="regFee"
                      control={control}
                      rules={required}
                      label="Registration Fee"
                      icon="dollar sign"
                      iconPosition="left"
                      placeholder="Enter Fee.."
                      type="number"
                      disabled={!canEdit}
                    />
                  )}
                  {/*Danger zone options only applicable when editing */}
                  {getValues("eventID") && (
                    <Accordion
                      className="mt-2p"
                      panels={[
                        {
                          key: "danger",
                          title: {
                            content: (
                              <span className="color-semanticred">
                                <strong>Danger Zone</strong>
                              </span>
                            ),
                          },
                          content: {
                            content: (
                              <div>
                                <p className="color-semanticred">
                                  Use caution with the options in this area!
                                </p>
                                <Button
                                  color="red"
                                  fluid
                                  onClick={() => setShowCancelEventModal(true)}
                                >
                                  <Icon name="trash alternate" />
                                  Cancel Event
                                </Button>
                              </div>
                            ),
                          },
                        },
                      ]}
                    />
                  )}
                </Form>
              </Segment>
              <Segment className="peerreview-rubricedit-container">
                <Header as="p" size="medium">
                  Registration Form
                </Header>

                {allElements.map((item) => {
                  return (
                    <EditableFormBlock
                      item={item}
                      key={item.order}
                      onMove={(item, direction) =>
                        handleMoveBlock({
                          allElems: allElements,
                          blockToMove: item,
                          direction: direction,
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
              </Segment>
              <Divider className="mt-2p" />
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
                  <Icon name="save" />
                  <span>Save Changes</span>
                </Button>
              </Button.Group>
            </Segment>
          </Segment.Group>
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
            promptTypeError={pmTypeError}
            promptText={pmText}
            promptReq={pmRequired}
            textError={pmTextError}
            dropdownError={pmDropdownError}
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
          <CancelEventModalProps
            show={showCancelEventModal}
            eventID={watchValue("eventID")}
            onClose={() => setShowCancelEventModal(false)}
            onConfirm={handleCancelEvent}
          />
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );
};

export default ManageEvent;
