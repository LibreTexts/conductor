import './ControlPanel.css';

import {
    Grid,
    Header,
    Segment,
    Button,
    Icon,
    Breadcrumb,
    Message,
    Divider,
    Label,
    Modal,
    Input,
    Form,
    List,
    Popup
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import TextArea from '../TextArea';

import { peerReviewPromptTypes } from '../util/ProjectHelpers';
import { isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const PeerReviewRubricManage = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    // UI
    const [manageMode, setManageMode] = useState('create');
    const [loadedRubric, setLoadedRubric] = useState(false);
    const [showInstructions, setShowInstructions] = useState(true);
    const [showChangesWarning, setShowChangesWarning] = useState(false);
    const [changesSaving, setChangesSaving] = useState(false);

    // Data
    const [rubricID, setRubricID] = useState('');
    const [rubric, setRubric] = useState({});
    const [allElements, setAllElements] = useState([]);
    const [lastUpdated, setLastUpdated] = useState('N/A');
    const [rubricTitle, setRubricTitle] = useState('');
    const [rubricOrgDefault, setRubricOrgDefault] = useState(false);
    const [rubricTitleErr, setRubricTitleErr] = useState(false);
    const [disableRubricTitle, setDisableRubricTitle] = useState(false);
    const [disableRubricOrgDefault, setDisableRubricOrgDefault] = useState(true);

    // Add/Edit Heading Modal
    const [showHeadingModal, setShowHeadingModal] = useState(false);
    const [hmMode, setHMMode] = useState('add');
    const [hmHeading, setHMHeading] = useState('');
    const [hmOrder, setHMOrder] = useState(0);
    const [hmLoading, setHMLoading] = useState(false);
    const [hmError, setHMError] = useState(false);

    // Add/Edit Text Modal
    const [showTextModal, setShowTextModal] = useState(false);
    const [tmMode, setTMMode] = useState('add');
    const [tmText, setTMText] = useState('');
    const [tmOrder, setTMOrder] = useState(0);
    const [tmLoading, setTMLoading] = useState(false);
    const [tmError, setTMError] = useState(false);

    // Add/Edit Prompt Modal
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [pmMode, setPMMode] = useState('add');
    const [pmType, setPMType] = useState('');
    const [pmText, setPMText] = useState('');
    const [pmOrder, setPMOrder] = useState(0);
    const [pmRequired, setPMRequired] = useState(false);
    const [pmDropdownOpts, setPMDropdownOpts] = useState([]);
    const [pmDropdownNew, setPMDropdownNew] = useState('');
    const [pmLoading, setPMLoading] = useState(false);
    const [pmTypeError, setPMTypeError] = useState(false);
    const [pmTextError, setPMTextError] = useState(false);
    const [pmDropdownError, setPMDropdownError] = useState(false);

    // Delete Block Modal
    const [showDBModal, setShowDBModal] = useState(false);
    const [dbType, setDBType] = useState('');
    const [dbBlock, setDBBlock] = useState({});
    const [dbLoading, setDBLoading] = useState(false);


    /**
     * Processes all rubric elements for UI presentation whenever the rubric state changes.
     */
    useEffect(() => {
        let allElem = [];
        if (Array.isArray(rubric.headings)) {
            let headings = rubric.headings.map((item) => {
                return {
                    ...item,
                    uiType: 'heading'
                }
            });
            allElem = [...allElem, ...headings];
        }
        if (Array.isArray(rubric.textBlocks)) {
            let textBlocks = rubric.textBlocks.map((item) => {
                return {
                    ...item,
                    uiType: 'textBlock'
                };
            });
            allElem = [...allElem, ...textBlocks];
        }
        if (Array.isArray(rubric.prompts)) {
            let prompts = rubric.prompts.map((item) => {
                return {
                    ...item,
                    uiType: 'prompt'
                };
            });
            allElem = [...allElem, ...prompts];
        }
        allElem.sort((a, b) => {
            let aOrder = a.order;
            let bOrder = b.order;
            if (typeof (aOrder) !== 'number') aOrder = 1;
            if (typeof (bOrder) !== 'number') bOrder = 1;
            if (aOrder < bOrder) return -1;
            if (aOrder > bOrder) return 1;
            return 0;
        });
        setAllElements(allElem);
    }, [rubric, setAllElements]);


    /**
     * Retrieves the current Peer Review Form configuration from the server.
     */
    const getReviewRubric = useCallback(() => {
        let getRubricID = ''; // handle race condition on state update
        if (!isEmptyString(rubricID)) {
            getRubricID = rubricID;
        } else if (!isEmptyString(props.match.params.rubricID)) {
            getRubricID = props.match.params.rubricID;
        }
        if (!isEmptyString(getRubricID)) {
            axios.get('/peerreview/rubric', {
                params: {
                    rubricID: getRubricID
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (typeof (res.data.rubric) === 'object') {
                        if (res.data.rubric.rubricID === getRubricID) {
                            setRubric(res.data.rubric);
                            if (typeof (res.data.rubric.rubricTitle) === 'string') {
                                setRubricTitle(res.data.rubric.rubricTitle);
                            }
                            if (res.data.rubric.isOrgDefault === true) {
                                setRubricOrgDefault(true);
                                setDisableRubricOrgDefault(true);
                                setDisableRubricTitle(true);
                            } else {
                                setDisableRubricOrgDefault(false);
                                setDisableRubricTitle(false);
                            }
                            if (typeof (res.data.rubric.updatedAt) === 'string') {
                                let updated = new Date(res.data.rubric.updatedAt);
                                setLastUpdated(updated.toDateString());
                            } else if (typeof (res.data.rubric.createdAt) === 'string') {
                                let created = new Date(res.data.rubric.createdAt);
                                setLastUpdated(created.toDateString());
                            } else {
                                setLastUpdated('Unknown');
                            }
                            setShowChangesWarning(false);
                        } else {
                            handleGlobalError("Unable to locate rubric.");
                        }
                    }
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setLoadedRubric(true);
            }).catch((err) => {
                setLoadedRubric(true);
                handleGlobalError(err);
            });
        } else {
            handleGlobalError("No Rubric ID provided.");
        }
    }, [props.match, rubricID, setRubric, setRubricOrgDefault,
        setDisableRubricOrgDefault, setLastUpdated, setShowChangesWarning,
        setLoadedRubric, handleGlobalError]);


    /**
     * Sends a request to the server to see if the current Organization
     * already has a default Peer Review Rubric set up.
     */
    const checkOrganizationHasDefault = useCallback(() => {
        axios.get('/peerreview/rubric/orgdefault').then((res) => {
            if (!res.data.err) {
                if (res.data.orgID === org.orgID && res.data.hasDefault === false) {
                    setDisableRubricOrgDefault(false);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    }, [setDisableRubricOrgDefault, handleGlobalError]);


    /**
     * Loads current rubric configuration and initializes editing mode, if applicable.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Peer Review Rubrics | Manage Rubric";
        if (props.match.params.mode === 'create') {
            setManageMode('create');
            document.title = "LibreTexts Conductor | Peer Review Rubrics | Add Rubric";
            checkOrganizationHasDefault();
            setLoadedRubric(true);
        } else if (props.match.params.mode === 'edit' && !isEmptyString(props.match.params.rubricID)) {
            setManageMode('edit');
            setRubricID(props.match.params.rubricID);
            document.title = "LibreTexts Conductor | Peer Review Rubrics | Edit Rubric";
            getReviewRubric();
        }
        // Hook to force Markdown links to open in new window
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if ('target' in node) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer')
            }
        });
        if (localStorage.getItem('conductor_show_peerreviewrubric_instructions') === 'false') {
            setShowInstructions(true);
        }
    }, [props.match, props.location, setManageMode, setRubricID,
        setLoadedRubric, setShowInstructions, checkOrganizationHasDefault, getReviewRubric]);


    /**
     * Toggles rubric editing instructions visibility and saves the choice to the browser.
     */
    const handleChangeInstructionsVis = () => {
        setShowInstructions(!showInstructions);
        localStorage.setItem('conductor_show_peerreviewrubric_instructions', !showInstructions);
    };


    /**
     * Toggles 'Organization Default Rubric' and updates the Rubric Title field according
     * to user's choice.
     */
    const handleSetDefaultRubric = () => {
        if (!rubricOrgDefault === true) {
            setRubricOrgDefault(true);
            setDisableRubricTitle(true);
            if (typeof (org.shortName) === 'string') {
                setRubricTitle(org.shortName);
            } else if (typeof (org.name) === 'string') {
                setRubricTitle(org.name);
            }
        } else {
            setRubricOrgDefault(false);
            setDisableRubricTitle(false);
            setRubricTitle('');
        }
    };


    /**
     * Validates the Rubric form.
     * @returns {Boolean} True if valid form, false otherwise.
     */
    const validateForm = () => {
        let valid = true;
        if (rubricTitle.length < 3 || rubricTitle.length > 201) {
            valid = false;
            setRubricTitleErr(true);
        }
        return valid;
    };


    /**
     * Resets the Rubric form's error states.
     */
    const resetForm = () => {
        setRubricTitleErr(false);
    };


    /**
     * Processes the Rubric configuration in state and saves it to the server, then exits editing mode.
     */
    const saveRubricChanges = () => {
        setChangesSaving(true);
        resetForm();
        if (validateForm()) {
            let rubricObj = {
                ...rubric
            };
            if (manageMode === 'create') {
                rubricObj = {
                    ...rubricObj,
                    mode: manageMode,
                    rubricTitle
                };
                if (rubricOrgDefault) rubricObj.orgDefault = true;
            } else if (manageMode === 'edit') {
                rubricObj = {
                    ...rubricObj,
                    mode: manageMode
                };
                if (rubricTitle !== rubric.rubricTitle) {
                    rubricObj.rubricTitle = rubricTitle;
                }
            }
            axios.put('/peerreview/rubric', rubricObj).then((res) => {
                if (!res.data.err) {
                    setChangesSaving(false);
                    let rubricsURL = '/controlpanel/peerreviewrubrics';
                    if (manageMode === 'create') {
                        props.history.push(`${rubricsURL}?created=true`);
                    } else {
                        props.history.push(`${rubricsURL}?saved=true`);
                    }
                } else {
                    setChangesSaving(false);
                    handleGlobalError(res.data?.errMsg);
                }
            }).catch((err) => {
                setChangesSaving(false);
                handleGlobalError(err);
            });
        } else {
            setChangesSaving(false);
        }
    };


    /**
     * Enables the 'Unsaved Changes' warning if not yet visible.
     */
    const setUnsavedChanges = () => {
        if (!showChangesWarning) setShowChangesWarning(true);
    };


    /**
     * Opens the Heading Modal and sets up its state.
     * @param {String} [mode=add] - The mode to open the Modal in, either 'add' or 'edit'.
     * @param {Number} [order] - The 'order' property of the Heading to edit if using edit mode.
     */
    const openHeadingModal = (mode = 'add', order) => {
        setHMLoading(false);
        setHMError(false);
        if (mode === 'edit' && typeof (order) === 'number' && order > 0) {
            let headings = [];
            if (Array.isArray(rubric.headings)) headings = rubric.headings;
            let editHeading = headings.find((item) => item.order === order);
            if (editHeading !== undefined && typeof (editHeading.text) === 'string') {
                setHMMode('edit');
                setHMHeading(editHeading.text);
                setHMOrder(editHeading.order);
                setShowHeadingModal(true);
            }
        } else {
            setHMHeading('');
            setShowHeadingModal(true);
        }
    };


    /**
     * Closes the Heading Modal and resets its state.
     */
    const closeHeadingModal = () => {
        setShowHeadingModal(false);
        setHMHeading('');
        setHMOrder(0);
        setHMMode('add');
        setHMLoading(false);
        setHMError(false);
    };


    /**
     * Saves a new or edited Heading to state and closes the Heading Modal.
     */
    const handleSaveHeading = () => {
        if (hmHeading.trim().length > 0 && hmHeading.trim().length < 500) {
            setHMLoading(true);
            let headings = [];
            if (Array.isArray(rubric.headings)) headings = rubric.headings;
            if (hmMode === 'edit') {
                let editHeading = headings.find((item) => item.order === hmOrder);
                let editHeadingIdx = headings.findIndex((item) => item.order === hmOrder);
                if (editHeading !== undefined && editHeadingIdx > -1) {
                    let editedHeading = {
                        ...editHeading,
                        text: hmHeading.trim()
                    }; // try to preserve other fields, such as a DB ID
                    headings[editHeadingIdx] = editedHeading;
                }
            } else {
                headings.push({
                    text: hmHeading.trim(),
                    order: getLastOrdering() + 1
                });
            }
            setRubric({
                ...rubric,
                headings: headings
            });
            setUnsavedChanges();
            closeHeadingModal();
        } else {
            setHMError(true);
        }
    };


    /**
     * Opens the Text Modal and sets up its state.
     * @param {String} [mode=add] - The mode to open the Modal in, either 'add' or 'edit'.
     * @param {Number} [order] - The 'order' property of the Text Block to edit if using edit mode.
     */
    const openTextModal = (mode = 'add', order) => {
        setTMLoading(false);
        setTMError(false);
        if (mode === 'edit' && typeof (order) === 'number' && order > 0) {
            let textBlocks = [];
            if (Array.isArray(rubric.textBlocks)) textBlocks = rubric.textBlocks;
            let editText = textBlocks.find((item) => item.order === order);
            if (editText !== undefined && typeof (editText.text) === 'string') {
                setTMMode('edit');
                setTMText(editText.text);
                setTMOrder(editText.order);
                setShowTextModal(true);
            }
        } else {
            setTMText('');
            setShowTextModal(true);
        }
    };


    /**
     * Closes the Text Modal and resets its state.
     */
    const closeTextModal = () => {
        setShowTextModal(false);
        setTMText('');
        setTMOrder(0);
        setTMMode('add');
        setTMError(false);
        setTMLoading(false);
    };


    /**
     * Saves a new or edited Text Block to state and closes the Text Modal.
     */
    const handleSaveTextBlock = () => {
        if (tmText.trim().length > 0 && tmText.trim().length < 5000) {
            setTMLoading(true);
            let textBlocks = [];
            if (Array.isArray(rubric.textBlocks)) textBlocks = rubric.textBlocks;
            if (tmMode === 'edit') {
                let editText = textBlocks.find((item) => item.order === tmOrder);
                let editTextIdx = textBlocks.findIndex((item) => item.order === tmOrder);
                if (editText !== undefined && editTextIdx > -1) {
                    let editedText = {
                        ...editText,
                        text: tmText.trim()
                    }; // try to preserve other fields, such as a DB ID
                    textBlocks[editTextIdx] = editedText;
                }
            } else {
                textBlocks.push({
                    text: tmText.trim(),
                    order: getLastOrdering() + 1
                });
            }
            setRubric({
                ...rubric,
                textBlocks: textBlocks
            });
            setUnsavedChanges();
            closeTextModal();
        } else {
            setTMError(true);
        }
    };


    /**
     * Opens the Prompt Modal and sets up its state.
     * @param {String} [mode=add] - The mode to open the Modal in, either 'add' or 'edit'.
     * @param {Number} [order] - The 'order' property of the Prompt to edit if using edit mode.
     */
    const openPromptModal = (mode = 'add', order) => {
        setPMLoading(false);
        setPMTypeError(false);
        setPMTextError(false);
        setPMDropdownError(false);
        if (mode === 'edit' && typeof (order) === 'number' && order > 0) {
            let prompts = [];
            if (Array.isArray(rubric.prompts)) prompts = rubric.prompts;
            let editPrompt = prompts.find((item) => item.order === order);
            if (editPrompt !== undefined && typeof (editPrompt.promptType) === 'string') {
                setPMMode('edit');
                setPMText(editPrompt.promptText);
                setPMType(editPrompt.promptType);
                setPMRequired(editPrompt.promptRequired);
                setPMOrder(editPrompt.order);
                if (editPrompt.promptType === 'dropdown' && Array.isArray(editPrompt.promptOptions)) {
                    setPMDropdownOpts(editPrompt.promptOptions);
                } else {
                    setPMDropdownOpts([]);
                }
                setShowPromptModal(true);
            }
        } else {
            setPMText('');
            setPMType('');
            setShowPromptModal(true);
        }
    };


    /**
     * Closes the Prompt Modal and resets its state.
     */
    const closePromptModal = () => {
        setShowPromptModal(false);
        setPMText('');
        setPMType('');
        setPMMode('add');
        setPMOrder(0);
        setPMLoading(false);
        setPMRequired(false);
        setPMDropdownOpts([]);
        setPMDropdownNew('');
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
        if (pmType === 'dropdown' && (pmDropdownOpts.length < 1 || pmDropdownOpts.length > 10)) {
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
        if (validatePromptForm()) {
            let prompts = [];
            if (Array.isArray(rubric.prompts)) prompts = rubric.prompts;
            if (pmMode === 'edit') {
                let editPrompt = prompts.find((item) => item.order === pmOrder);
                let editPromptIdx = prompts.findIndex((item) => item.order === pmOrder);
                if (editPrompt !== undefined && editPromptIdx > -1) {
                    let editedPrompt = {
                        ...editPrompt,
                        promptType: pmType,
                        promptText: pmText,
                        promptRequired: pmRequired
                    }; // try to preserve other fields, such as a DB ID.
                    if (pmType === 'dropdown') editedPrompt.promptOptions = pmDropdownOpts;
                    prompts[editPromptIdx] = editedPrompt;
                }
            } else {
                let newPrompt = {
                    promptType: pmType,
                    promptText: pmText.trim(),
                    promptRequired: pmRequired,
                    order: getLastOrdering() + 1
                };
                if (pmType === 'dropdown') newPrompt.promptOptions = pmDropdownOpts;
                prompts.push(newPrompt);
            }
            setRubric({
                ...rubric,
                prompts: prompts
            });
            setUnsavedChanges();
            closePromptModal();
        } else {
            setPMLoading(false);
        }
    };


    /**
     * Adds a new Dropdown Prompt option to state and resets the option entry input.
     */
    const handleAddDropdownPromptOption = () => {
        if (pmDropdownNew.trim().length > 0 && pmDropdownNew.length < 250) {
            let normalOption = pmDropdownNew.trim().toLowerCase().replace(/[^a-zA-Z]/gm, '');
            setPMDropdownOpts([...pmDropdownOpts, {
                key: normalOption,
                text: pmDropdownNew,
                value: normalOption
            }]);
            setPMDropdownError(false);
            setPMDropdownNew('');
        } else {
            setPMDropdownError(true);
        }
    };


    /**
     * Shifts a option in a Prompt's dropdown choices to a new position.
     * @param {Number} idx - The current index of the option to move. 
     * @param {String} [direction=up] - The direction to move the option in.
     */
    const handleMoveDropdownPromptOption = (idx, direction = 'up') => {
        if ((direction === 'up' && idx > 0) || (direction === 'down' && idx < pmDropdownOpts.length)) {
            // dont move an element up already at the top; don't move down if already at bottom
            let dropdownOptions = [...pmDropdownOpts];
            let removedItems = dropdownOptions.splice(idx, 1);
            if (direction === 'up') {
                dropdownOptions.splice(idx - 1, 0, removedItems[0]);
            } else if (direction === 'down') {
                dropdownOptions.splice(idx + 1, 0, removedItems[0]);
            }
            setPMDropdownOpts(dropdownOptions);
        }
    };


    /**
     * Removes a Dropdown Prompt option from state.
     * @param {Number} idx - The option's index in the dropdown options array. 
     */
    const handleDeleteDropdownPromptOption = (idx) => {
        let dropdownOptions = [...pmDropdownOpts];
        dropdownOptions.splice(idx, 1);
        setPMDropdownOpts(dropdownOptions);
    };


    /**
     * Changes a block's order in state and shifts nearby blocks to maintain ordering.
     * @param {Object} blockToMove - The block's current state.
     * @param {String} direction - The direction to move the block in the rubric.
     */
    const handleMoveBlock = (blockToMove, direction) => {
        if (
            typeof (blockToMove.order) === 'number'
            && ((blockToMove.order > 1 && direction === 'up') || (blockToMove.order > 0 && direction === 'down'))
        ) { // don't move a block already at the top
            const moveBlocks = (arr) => {
                return arr.map((item) => {
                    if (direction === 'up') {
                        if (item.order === blockToMove.order - 1) { // moving block up, block above needs to move down
                            return {
                                ...item,
                                order: item.order + 1
                            };
                        } else if (item.order === blockToMove.order) {
                            return {
                                ...item,
                                order: item.order - 1
                            };
                        }
                    } else if (direction === 'down') {
                        if (item.order === blockToMove.order + 1) { // moving block down, block below needs to move up
                            return {
                                ...item,
                                order: item.order - 1
                            };
                        } else if (item.order === blockToMove.order) {
                            return {
                                ...item,
                                order: item.order + 1
                            };
                        }
                    }
                    return item; // leave other blocks alone
                });
            };
            let headings = [];
            let textBlocks = [];
            let prompts = [];
            if (Array.isArray(rubric.headings)) headings = rubric.headings;
            if (Array.isArray(rubric.textBlocks)) textBlocks = rubric.textBlocks;
            if (Array.isArray(rubric.prompts)) prompts = rubric.prompts;
            /* move the blocks */
            headings = moveBlocks(headings);
            textBlocks = moveBlocks(textBlocks);
            prompts = moveBlocks(prompts);
            setRubric({
                ...rubric,
                headings: headings,
                textBlocks: textBlocks,
                prompts: prompts
            });
            setUnsavedChanges();
        }
    };


    /**
     * Removes a block from state and shifts nearby blocks to maintain ordering.
     */
    const handleDeleteBlock = () => {
        if (typeof (dbBlock.order) === 'number') {
            const deleteBlockAndReorder = (arr) => {
                return arr.map((item) => {
                    if (item.order === dbBlock.order) { // delete block by setting null
                        return null;
                    }
                    if (item.order > dbBlock.order) { // blocks below need to be moved up
                        return {
                            ...item,
                            order: item.order - 1
                        };
                    }
                    return item;
                }).filter((item) => item !== null); // delete block by removing null
            };
            setDBLoading(true);
            let headings = [];
            let textBlocks = [];
            let prompts = [];
            if (Array.isArray(rubric.headings)) headings = rubric.headings;
            if (Array.isArray(rubric.textBlocks)) textBlocks = rubric.textBlocks;
            if (Array.isArray(rubric.prompts)) prompts = rubric.prompts;
            /* delete the block and reorder other blocks */
            headings = deleteBlockAndReorder(headings);
            textBlocks = deleteBlockAndReorder(textBlocks);
            prompts = deleteBlockAndReorder(prompts);
            setRubric({
                ...rubric,
                headings: headings,
                textBlocks: textBlocks,
                prompts: prompts
            });
            setUnsavedChanges();
            closeDeleteBlockModal();
        }
    };


    /**
     * Opens the Delete Block modal and saves the block to manipulate into state for later usage.
     * @param {Object} block - The block object to manipulate.
     * @param {String} type - The block's type (UI-ready).
     */
    const openDeleteBlockModal = (block) => {
        setDBLoading(false);
        let blockType = 'Unknown';
        if (block.uiType === 'heading') {
            blockType = 'Heading';
        } else if (block.uiType === 'textBlock') {
            blockType = 'Text';
        } else if (block.uiType === 'prompt') {
            blockType = 'Prompt';
        }
        setDBType(blockType);
        setDBBlock(block);
        setShowDBModal(true);
    };


    /**
     * Closes the Delete Block Modal and resets its state.
     */
    const closeDeleteBlockModal = () => {
        setShowDBModal(false);
        setDBLoading(false);
        setDBType('');
        setDBBlock({});
    };


    /**
     * Retrieves the 'order' property of the last inserted block in the rubric.
     * @returns {Number} The last ordering index, or 0.
     */
    const getLastOrdering = () => {
        let lastOrdering = 0;
        let allBlocks = [];
        let headings = [];
        let textBlocks = [];
        let prompts = [];
        if (Array.isArray(rubric.headings)) headings = rubric.headings;
        if (Array.isArray(rubric.textBlocks)) textBlocks = rubric.textBlocks;
        if (Array.isArray(rubric.prompts)) prompts = rubric.prompts;
        allBlocks = [...headings, ...textBlocks, ...prompts];
        allBlocks.forEach((block) => {
            if (typeof (block.order) === 'number' && block.order > lastOrdering) {
                lastOrdering = block.order;
            }
        });
        return lastOrdering;
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>
                        {manageMode === 'create' ? 'Create' : 'Edit'} Peer Review Rubric
                    </Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <Breadcrumb>
                                        <Breadcrumb.Section as={Link} to='/controlpanel'>
                                            Control Panel
                                        </Breadcrumb.Section>
                                        <Breadcrumb.Divider icon='right chevron' />
                                        <Breadcrumb.Section as={Link} to='/controlpanel/peerreviewrubrics'>
                                            Peer Review Rubrics
                                        </Breadcrumb.Section>
                                        <Breadcrumb.Divider icon='right chevron' />
                                        <Breadcrumb.Section active>
                                            {manageMode === 'create' ? 'Create' : 'Edit'} Peer Review Rubric
                                        </Breadcrumb.Section>
                                    </Breadcrumb>
                                </div>
                                <div className='right-flex'>
                                    <span className='muted-text'>Last Updated: <em>{lastUpdated}</em></span>
                                </div>
                            </div>
                        </Segment>
                        <Segment loading={!loadedRubric}>
                            {showChangesWarning &&
                                <Message
                                    warning         
                                    icon='warning sign'
                                    content='You have unsaved changes!'
                                    className='mt-1p mb-2p'
                                />
                            }
                            {showInstructions &&
                                <>
                                    <Segment raised color='blue'>
                                        <div className='ui dividing header'>
                                            <div className='hideablesection'>
                                                <h3 className='header'>
                                                    Editing Instructions
                                                </h3>
                                                <div className='button-container'>
                                                    <Button
                                                        compact
                                                        floated='right'
                                                        onClick={handleChangeInstructionsVis}
                                                    >
                                                        Hide
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                        <p>All Peer Review rubrics include by default:</p>
                                        <ul>
                                            <li>A <strong>First Name</strong> field <span className='muted-text'>(collected automatically if logged into Conductor)</span></li>
                                            <li>A <strong>Last Name</strong> field <span className='muted-text'>(collected automatically if logged into Conductor)</span></li>
                                            <li>An <strong>Email</strong> field <span className='muted-text'>(collected automatically if logged into Conductor, not visible to others)</span></li>
                                            <li>A <strong>Reviewer Type</strong> field <span className='muted-text'>(Student or Instructor)</span></li>
                                            <li>An <strong>Overall Rating</strong> (up to five stars) field</li>
                                        </ul>
                                        <p>A Peer Review rubric can consist of an unlimited number of the below blocks:</p>
                                        <ul>
                                            <li><strong>Headings</strong> indicate different sections of the rubric</li>
                                            <li><strong>Text Blocks</strong> allow you to insert rubric instructions or additional information</li>
                                            <li>
                                                <span><strong>Prompts</strong> act as questions and inputs in the rubric. There are six different types of prompts:</span>
                                                <ul>
                                                    <li><strong>Three Point Likert Scale: </strong> Radio choice between <em>Disagree, Neutral, Agree</em></li>
                                                    <li><strong>Five Point Likert Scale: </strong> Radio choice between <em>Strongly Disagree, Disagree, Neutral, Agree, Strongly Agree</em></li>
                                                    <li><strong>Seven Point Likert Scale: </strong> Radio choice between <em>Strongly Disagree, Disagree, Somewhat Disagree, Neutral, Somewhat Agree, Agree, Strongly Agree</em></li>
                                                    <li><strong>Text:</strong> Free-response textual input <span className='muted-text'>(up to 10,000 characters)</span></li>
                                                    <li><strong>Dropdown:</strong> Input requiring a selection between custom dropdown options <span className='muted-text'>(up to 10 options)</span></li>
                                                    <li><strong>Checkbox:</strong> Simple on/off checkbox <span className='muted-text'>(setting 'Required' indicates the box must be checked to submit)</span></li>
                                                </ul>
                                            </li>
                                        </ul>
                                        <p>Editing a Peer Review rubric <strong>will not</strong> affect previously submitted Peer Reviews: a snapshot of the rubric configuration is taken at the time of submission.</p>
                                        <p>Peer Reviews in "public" projects can be viewed by the public. <strong>Never use a Peer Review rubric to collect sensitive personal information.</strong></p>
                                    </Segment>
                                </>
                            }
                            {!showInstructions &&
                                <Segment color='blue'>
                                    <div className='hiddensection'>
                                        <div className='header-container'>
                                            <Header as='h3'>Editing Instructions</Header>
                                        </div>
                                        <div className='button-container'>
                                            <Button
                                                floated='right'
                                                onClick={handleChangeInstructionsVis}
                                            >
                                                Show
                                            </Button>
                                        </div>
                                    </div>
                                </Segment>
                            }
                            <Segment className='mt-4p mb-3p'>
                                <Header as='p' size='medium'>General Rubric Settings</Header>
                                <Form noValidate>
                                    <Form.Input
                                        type='text'
                                        value={rubricTitle}
                                        onChange={(_e, { value }) => setRubricTitle(value)}
                                        error={rubricTitleErr}
                                        disabled={disableRubricTitle}
                                        label='Rubric Title'
                                        placeholder='Enter Rubric Title...'
                                    />
                                    <Form.Checkbox
                                        label='Use as Campus Default Rubric'
                                        checked={rubricOrgDefault === true}
                                        onChange={handleSetDefaultRubric}
                                        disabled={disableRubricOrgDefault}
                                    />
                                </Form>
                            </Segment>
                            <div className='peerreview-rubricedit-container'>
                                <Header as='p' size='large'>New Peer Review</Header>
                                {allElements.map((item) => {
                                    let itemType = 'Unknown';
                                    let responseType = 'N/A';
                                    if (item.uiType === 'heading') {
                                        itemType = 'Heading';
                                    } else if (item.uiType === 'textBlock') {
                                        itemType = 'Text Block';
                                    } else if (item.uiType === 'prompt') {
                                        itemType = 'Prompt';
                                        if (item.promptType === '3-likert') {
                                            responseType = '3-Point Likert';
                                        } else if (item.promptType === '5-likert') {
                                            responseType = '5-Point Likert';
                                        } else if (item.promptType === '7-likert') {
                                            responseType = '7-Point Likert';
                                        } else if (item.promptType === 'text') {
                                            responseType = 'Text';
                                        } else if (item.promptType === 'dropdown') {
                                            responseType = 'Dropdown';
                                        } else if (item.promptType === 'checkbox') {
                                            responseType = 'Checkbox';
                                        }
                                    }
                                    return (
                                        <Segment key={item.order}>
                                            <Label attached='top left' className='peerreview-rubricedit-label'>
                                                <Button.Group size='tiny'>
                                                    <Button
                                                        icon='arrow up'
                                                        onClick={() => handleMoveBlock(item, 'up')}
                                                    />
                                                    <Button
                                                        icon='arrow down'
                                                        onClick={() => handleMoveBlock(item, 'down')}
                                                    />
                                                </Button.Group>
                                                <span className='ml-1r'><strong>#{item.order}:</strong> {itemType}</span>
                                            </Label>
                                            <div className='flex-row-div'>
                                                <div className='left-flex'>
                                                    {(item.uiType === 'heading') && (
                                                        <div className='flex-col-div'>
                                                            <Header size='medium' as='span'>{item.text}</Header>
                                                        </div>
                                                    )}
                                                    {(item.uiType === 'textBlock') && (
                                                        <div className='flex-col-div'>
                                                            <p
                                                                dangerouslySetInnerHTML={{
                                                                    __html: DOMPurify.sanitize(marked(item.text))
                                                                }}
                                                            />
                                                        </div>
                                                    )}
                                                    {(item.uiType === 'prompt') && (
                                                        <div className='flex-col-div'>
                                                            <p><strong>Prompt: </strong> {item.promptText}</p>
                                                            <p>
                                                                <strong>Response Type{(item.promptRequired === true) && <span> (required)</span>}: </strong>
                                                                <em> {responseType}
                                                                    {item.promptType === 'text' && <span className='muted-text'> (free response, max 10,000 characters)</span>}
                                                                    {(item.promptType === 'dropdown' && Array.isArray(item.promptOptions)) && (
                                                                        <span className='muted-text'> ({item.promptOptions?.length} options)</span>
                                                                    )}
                                                                </em>
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className='right-flex'>
                                                    <Button.Group>
                                                        <Button
                                                            className='peerreview-rubricedit-editblockbtn'
                                                            color='teal'
                                                            onClick={() => {
                                                                if (item.uiType === 'heading') {
                                                                    openHeadingModal('edit', item.order);
                                                                } else if (item.uiType === 'textBlock') {
                                                                    openTextModal('edit', item.order);
                                                                } else if (item.uiType === 'prompt') {
                                                                    openPromptModal('edit', item.order);
                                                                }
                                                            }}
                                                        >
                                                            <Icon name='pencil' />
                                                            Edit {itemType}
                                                        </Button>
                                                        <Button
                                                            color='red'
                                                            onClick={() => openDeleteBlockModal(item, itemType)}
                                                        >
                                                            <Icon name='trash' />
                                                            Delete
                                                        </Button>
                                                    </Button.Group>
                                                </div>
                                            </div>
                                        </Segment>
                                    )
                                })}
                                <div className='peerreview-rubricedit-placeholder'>
                                    <Button.Group fluid color='blue'>
                                        <Button onClick={openHeadingModal}>
                                            <Icon name='heading' />
                                            Add Heading
                                        </Button>
                                        <Button onClick={openTextModal}>
                                            <Icon name='paragraph' />
                                            Add Text
                                        </Button>
                                        <Button onClick={openPromptModal}>
                                            <Icon name='question' />
                                            Add Prompt
                                        </Button>
                                    </Button.Group>
                                </div>
                            </div>
                            <Divider className='mt-2p' />
                            <Button.Group fluid>
                                <Button
                                    as={Link}
                                    to='/controlpanel/peerreviewrubrics'
                                >
                                    <Icon name='cancel' />
                                    Discard Changes
                                </Button>
                                <Button
                                    color='green'
                                    loading={changesSaving}
                                    onClick={saveRubricChanges}
                                >
                                    <Icon name='save' />
                                    <span>Save Changes</span>
                                </Button>
                            </Button.Group>
                        </Segment>
                    </Segment.Group>
                    {/* Heading Modal */}
                    <Modal
                        open={showHeadingModal}
                        onClose={closeHeadingModal}
                    >
                        <Modal.Header>{(hmMode === 'add') ? 'Add' : 'Edit'} Heading</Modal.Header>
                        <Modal.Content>
                            <Input
                                type='text'
                                value={hmHeading}
                                onChange={(_e, { value }) => setHMHeading(value)}
                                fluid
                                placeholder={`Enter ${hmMode === 'add' && 'new'} heading text...`}
                                error={hmError}
                            />
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeHeadingModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={hmLoading}
                                onClick={handleSaveHeading}
                            >
                                <Icon name={hmMode === 'add' ? 'add' : 'save'} />
                                {hmMode === 'add' ? 'Add' : 'Save'} Heading
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Text Modal */}
                    <Modal
                        open={showTextModal}
                        onClose={closeTextModal}
                    >
                        <Modal.Header>{(tmMode === 'add') ? 'Add' : 'Edit'} Text Block</Modal.Header>
                        <Modal.Content>
                            <TextArea
                                placeholder={`Enter ${tmMode === 'add' && 'new'} text...`}
                                textValue={tmText}
                                onTextChange={(value) => setTMText(value)}
                                inputType='text block'
                                showSendButton={false}
                                error={tmError}
                            />
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeTextModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={tmLoading}
                                onClick={handleSaveTextBlock}
                            >
                                <Icon name={tmMode === 'add' ? 'add' : 'save'} />
                                {(tmMode === 'add') ? 'Add' : 'Save'} Text Block
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Add Prompt Modal */}
                    <Modal
                        open={showPromptModal}
                        onClose={closePromptModal}
                    >
                        <Modal.Header>{(pmMode === 'add') ? 'Add' : 'Edit'} Prompt</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Form.Select
                                    options={peerReviewPromptTypes}
                                    value={pmType}
                                    onChange={(_e, { value }) => setPMType(value)}
                                    placeholder='Prompt Type...'
                                    label='Prompt Type'
                                    fluid
                                    selection
                                    error={pmTypeError}
                                />
                                {(pmType !== '') && (
                                    <>
                                        <Form.Input
                                            type='text'
                                            value={pmText}
                                            onChange={(_e, { value }) => setPMText(value)}
                                            fluid
                                            label='Prompt Text'
                                            placeholder='Enter prompt/instructions/question...'
                                            error={pmTextError}
                                        />
                                        <Form.Group inline>
                                            <label>Set Required?</label>
                                            <Form.Radio
                                                label='Yes'
                                                checked={pmRequired === true}
                                                onChange={(_e, _data) => setPMRequired(true)}
                                            />
                                            <Form.Radio
                                                label='No'
                                                checked={pmRequired === false}
                                                onChange={(_e, _data) => setPMRequired(false)}
                                            />
                                        </Form.Group>
                                        {(pmType === 'dropdown') && (
                                            <>
                                                <Header size='tiny' as='span'>Dropdown Options <span className='muted-text'>(up to 10)</span></Header>
                                                <List divided>
                                                    {pmDropdownOpts.map((item, idx) => {
                                                        return (
                                                            <List.Item key={idx}>
                                                                <div className='flex-row-div'>
                                                                    <div className='left-flex'>
                                                                        <span>{item.text}</span>
                                                                    </div>
                                                                    <div className='right-flex'>
                                                                        <Button.Group>
                                                                            <Popup
                                                                                trigger={(
                                                                                    <Button
                                                                                        icon
                                                                                        onClick={() => handleMoveDropdownPromptOption(idx, 'up')}
                                                                                    >
                                                                                        <Icon name='arrow up' />
                                                                                    </Button>
                                                                                )}
                                                                                position='top center'
                                                                                content='Move Up'
                                                                            />
                                                                            <Popup
                                                                                trigger={(
                                                                                    <Button
                                                                                        icon
                                                                                        onClick={() => handleMoveDropdownPromptOption(idx, 'down')}
                                                                                    >
                                                                                        <Icon name='arrow down' />
                                                                                    </Button>
                                                                                )}
                                                                                position='top center'
                                                                                content='Move Down'
                                                                            />
                                                                            <Popup
                                                                                trigger={(
                                                                                    <Button
                                                                                        icon
                                                                                        color='red'
                                                                                        onClick={() => handleDeleteDropdownPromptOption(idx)}
                                                                                    >
                                                                                        <Icon name='trash' />
                                                                                    </Button>
                                                                                )}
                                                                                position='top center'
                                                                                content='Remove'
                                                                            />
                                                                        </Button.Group>
                                                                    </div>
                                                                </div>
                                                            </List.Item>
                                                        )
                                                    })}
                                                    {(pmDropdownOpts.length < 10) && (
                                                        <List.Item key='new'>
                                                            <Input
                                                                type='text'
                                                                value={pmDropdownNew}
                                                                onChange={(_e, { value }) => setPMDropdownNew(value)}
                                                                placeholder='Enter option text...'
                                                                action={{
                                                                    color: 'green',
                                                                    labelPosition: 'right',
                                                                    icon: 'add',
                                                                    content: 'Add Option',
                                                                    onClick: handleAddDropdownPromptOption
                                                                }}
                                                                fluid
                                                                error={pmDropdownError}
                                                                className='mt-2p'
                                                            />
                                                        </List.Item>
                                                    )}
                                                </List>
                                            </>
                                        )}
                                    </>
                                )}
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closePromptModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={pmLoading}
                                onClick={handleSavePrompt}
                            >
                                <Icon name={pmMode === 'add' ? 'add' : 'save'} />
                                {pmMode === 'add' ? 'Add' : 'Save'} Prompt
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Delete Block Modal */}
                    <Modal
                        open={showDBModal}
                        onClose={closeDeleteBlockModal}
                    >
                        <Modal.Header>Delete Block</Modal.Header>
                        <Modal.Content>
                            <p>Are you sure you want to delete this <strong>{dbType}</strong> block?</p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button onClick={closeDeleteBlockModal}>Cancel</Button>
                            <Button
                                loading={dbLoading}
                                color='red'
                                onClick={handleDeleteBlock}
                            >
                                <Icon name='trash' />
                                Delete Block
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default PeerReviewRubricManage;
