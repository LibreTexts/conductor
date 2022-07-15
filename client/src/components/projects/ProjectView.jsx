import './Projects.css'
import 'react-circular-progressbar/dist/styles.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Form,
  Breadcrumb,
  Modal,
  Label,
  List,
  Image,
  Accordion,
  Input,
  Loader,
  Search,
  Popup,
  Dropdown,
  Checkbox,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import ProjectProgressBar from './ProjectProgressBar';
import ConductorTextArea from '../util/ConductorTextArea';
import ConductorMessagingUI from '../util/ConductorMessagingUI';
import ConductorChatUI from '../util/ConductorChatUI';
import ConductorDateInput from '../util/ConductorDateInput';
import { MentionsInput, Mention } from 'react-mentions'

import {
  isEmptyString,
  capitalizeFirstLetter,
  normalizeURL,
  truncateString,
  sortUsersByName
} from '../util/HelperFunctions.js';
import {
  libraryOptions,
  getLibraryName
} from '../util/LibraryOptions.js';
import {
  visibilityOptions,
  statusOptions,
  createTaskOptions,
  classificationOptions,
  projectRoleOptions,
  getTaskStatusText,
  getClassificationText,
  getFlagGroupName,
  constructProjectTeam,
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission
} from '../util/ProjectHelpers.js';
import {
  licenseOptions,
  getLicenseText
} from '../util/LicenseOptions.js';
import {
  getRoadmapStepName
} from '../util/RoadmapOptions.jsx';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectView = (props) => {

  // Global State and Eror Handling
  const { handleGlobalError } = useGlobalError();
  const user = useSelector((state) => state.user);

  // UI
  const [loadingData, setLoadingData] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showProjectCreated, setShowProjectCreated] = useState(false);
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [showReviewerCrumb, setShowReviewerCrumb] = useState(false);
  const [showJoinComingSoon, setShowJoinComingSoon] = useState(false);

  // Project Data
  const [project, setProject] = useState({});
  const [projectPinned, setProjectPinned] = useState(false);

  // Project Permissions
  const [canViewDetails, setCanViewDetails] = useState(false);
  const [userProjectAdmin, setUserProjectAdmin] = useState(false);
  const [userProjectMember, setUserProjectMember] = useState(false);

  // Edit Information Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [projTitle, setProjTitle] = useState('');
  const [projStatus, setProjStatus] = useState('open');
  const [projClassification, setProjClassification] = useState('');
  const [projVisibility, setProjVisibility] = useState('private');
  const [projProgress, setProjProgress] = useState(0);
  const [projPRProgress, setProjPRProgress] = useState(0);
  const [projA11YProgress, setProjA11YProgress] = useState(0);
  const [projURL, setProjURL] = useState('');
  const [projTags, setProjTags] = useState([]);
  const [projResAuthor, setProjResAuthor] = useState('');
  const [projResEmail, setProjResEmail] = useState('');
  const [projResLicense, setProjResLicense] = useState('');
  const [projResURL, setProjResURL] = useState('');
  const [projNotes, setProjNotes] = useState('');
  const [projTitleErr, setProjTitleErr] = useState(false);
  const [projProgressErr, setProjProgressErr] = useState(false);
  const [projPRProgressErr, setProjPRProgressErr] = useState(false);
  const [projA11YProgressErr, setProjA11YProgressErr] = useState(false);
  const [tagOptions, setTagOptions] = useState([]);
  const [loadedTags, setLoadedTags] = useState(false);

  // Project Pin Modal
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [pinnedModalDidPin, setPinnedModalDidPin] = useState(true);

  // Manage Team Modal
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamUserOptions, setTeamUserOptions] = useState([]);
  const [teamUserOptsLoading, setTeamUserOptsLoading] = useState(false);
  const [teamUserToAdd, setTeamUserToAdd] = useState('');
  const [teamModalLoading, setTeamModalLoading] = useState(false);

  // Delete Project Modal
  const [showDeleteProjModal, setShowDeleteProjModal] = useState(false);
  const [deleteProjModalLoading, setDeleteProjModalLoading] = useState(false);

  // Project Tasks
  const [allProjTasks, setAllProjTasks] = useState([]);
  const [projTasks, setProjTasks] = useState([]);


  // Task Search
  const [taskSearchLoading, setTaskSearchLoading] = useState(false);
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState([]);


  // Manage (Add/Edit) Task Modal
  const [showMngTaskModal, setShowMngTaskModal] = useState(false);
  const [mngTaskMode, setMngTaskMode] = useState('add');
  const [mngTaskLoading, setMngTaskLoading] = useState(false);
  const [mngTaskTitle, setMngTaskTitle] = useState('');
  const [mngTaskDescrip, setMngTaskDescrip] = useState('');
  const [mngTaskStartDate, setMngTaskStartDate] = useState(null);
  const [mngTaskEndDate, setMngTaskEndDate] = useState(null);
  const [mngTaskStatus, setMngTaskStatus] = useState('available');
  const [mngTaskTitleErr, setMngTaskTitleErr] = useState(false);
  const [mngTaskSubtask, setMngTaskSubtask] = useState(false);
  const [mngTaskParent, setMngTaskParent] = useState('');
  const [mngTaskData, setMngTaskData] = useState({});


  // View Task Modal
  const [showViewTaskModal, setShowViewTaskModal] = useState(false);
  const [viewTaskData, setViewTaskData] = useState({});
  const [viewTaskLoading, setViewTaskLoading] = useState(false);
  const [viewTaskMsgs, setViewTaskMsgs] = useState([]);
  const [viewTaskLoadedMsgs, setViewTaskLoadedMsgs] = useState(false);
  const [viewTaskStatusLoading, setViewTaskStatusLoading] = useState(false);
  const [viewTaskStartDateEdit, setViewTaskStartDateEdit] = useState(false);
  const [viewTaskStartDateLoading, setViewTaskStartDateLoading] = useState(false);
  const [viewTaskStartDateNew, setViewTaskStartDateNew] = useState(new Date());
  const [viewTaskEndDateEdit, setViewTaskEndDateEdit] = useState(false);
  const [viewTaskEndDateLoading, setViewTaskEndDateLoading] = useState(false);
  const [viewTaskEndDateNew, setViewTaskEndDateNew] = useState(new Date());


  // Add Task Assignee Modal
  const [showATAModal, setShowATAModal] = useState(false);
  const [ataUsers, setATAUsers] = useState([]);
  const [ataUUID, setATAUUID] = useState('');
  const [ataSubtasks, setATASubtasks] = useState(false);
  const [ataLoading, setATALoading] = useState(false);
  const [ataError, setATAError] = useState(false);


  // Remove Task Assignee Modal
  const [showRMTAModal, setShowRMTAModal] = useState(false);
  const [rmtaName, setRMTAName] = useState('');
  const [rmtaUUID, setRMTAUUID] = useState('');
  const [rmtaSubtasks, setRMTASubtasks] = useState(false);
  const [rmtaLoading, setRMTALoading] = useState(false);


  // Add Task Dependency Modal
  const [showATDModal, setShowATDModal] = useState(false);
  const [atdTaskID, setATDTaskID] = useState('');
  const [atdLoading, setATDLoading] = useState(false);
  const [atdTasks, setATDTasks] = useState([]);
  const [atdError, setATDError] = useState(false);


  // Remove Task Dependency Modal
  const [showRTDModal, setShowRTDModal] = useState(false);
  const [rtdTaskID, setRTDTaskID] = useState('');
  const [rtdTaskTitle, setRTDTaskTitle] = useState('');
  const [rtdLoading, setRTDLoading] = useState(false);


  // Delete Task Modal
  const [showDelTaskModal, setShowDelTaskModal] = useState(false);
  const [delTaskData, setDelTaskData] = useState({});
  const [delTaskLoading, setDelTaskLoading] = useState(false);
  const [delTaskSubtask, setDelTaskSubtask] = useState(false);
  const [delTaskParent, setDelTaskParent] = useState('');
  const [delTaskHasSubtasks, setDelTaskHasSubtasks] = useState(false);


  // Batch Task Add Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchAddLoading, setBatchAddLoading] = useState(false);
  const [batchTasks, setBatchTasks] = useState(1);
  const [batchTitle, setBatchTitle] = useState('');
  const [batchAddSubtasks, setBatchAddSubtasks] = useState(false);
  const [batchSubtasks, setBatchSubtasks] = useState(1);
  const [batchSubtitle, setBatchSubtitle] = useState('');
  const [batchTasksErr, setBatchTasksErr] = useState(false);
  const [batchTitleErr, setBatchTitleErr] = useState(false);
  const [batchSubtasksErr, setBatchSubtasksErr] = useState(false);
  const [batchSubtitleErr, setBatchSubtitleErr] = useState(false);


  // Flag Project Modal
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagMode, setFlagMode] = useState('set');
  const [flagLoading, setFlagLoading] = useState(false);
  const [flagOption, setFlagOption] = useState('');
  const [flagOptionErr, setFlagOptionErr] = useState(false);
  const [flagDescrip, setFlagDescrip] = useState('');
  const [flagDescripErr, setFlagDescripErr] = useState(false);

  // TODO: Finish flagDescripErr implementation


  /**
   * Set page title and load Project information on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Projects | Project View";
    date.plugin(ordinal);
    date.plugin(day_of_week);
    // Hook to force message links to open in new window
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer')
      }
    });
    getProject();
    if (localStorage.getItem('conductor_show_projectdiscussion') !== null) {
      if (localStorage.getItem('conductor_show_projectdiscussion') === 'true') {
        setShowDiscussion(true);
      }
    }
  }, []);


  /**
   * Read URL params and update UI accordingly.
   */
  useEffect(() => {
    const urlParams = new URLSearchParams(props.location.search);
    if (urlParams.get('projectCreated') === 'true') {
      setShowProjectCreated(true);
    }
    if (urlParams.get('reviewer') === 'true') {
      setShowReviewerCrumb(true);
    }
    if (urlParams.get('src') === 'underdevelopment') {
      setShowJoinComingSoon(true);
    }
  }, [props.location.search, setShowProjectCreated, setShowReviewerCrumb, setShowJoinComingSoon]);


  /**
   * Update the page title to the project title when it is available.
   */
  useEffect(() => {
    if (projTitle !== '') {
      document.title = `LibreTexts Conductor | Projects | ${projTitle}`;
    }
  }, [projTitle]);


  /*
   * Update state with user's permissions within the project when
   * their identity and the project data is available.
   */
  useEffect(() => {
    if (typeof (user.uuid) === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
      let adminPermissions = checkProjectAdminPermission(project, user);
      if (adminPermissions) {
        setUserProjectAdmin(true);
        setUserProjectMember(true);
        setCanViewDetails(true);
      } else if (checkProjectMemberPermission(project, user)) {
        setUserProjectMember(true);
        setCanViewDetails(true);
      } else {
        setCanViewDetails(checkCanViewProjectDetails(project, user));
      }
    }
  }, [project, user, setUserProjectAdmin, setUserProjectMember, setCanViewDetails]);


  /*
   * Get Project's restricted details when the permission changes.
   */
  useEffect(() => {
    if (canViewDetails) {
      getProjectTasks();
    }
  }, [canViewDetails]);

  /**
   * Asks the server whether the user has saved the project to their "pinned" list and updates
   * UI if necessary.
   */
  const getProjectPinStatus = () => {
    axios.get('/project/pin', {
      params: {
        projectID: props.match.params.id,
      }
    }).then((res) => {
      if (!res.data.err) {
        if (typeof (res.data.pinned) === 'boolean') {
          setProjectPinned(res.data.pinned);
        }
      } else {
        throw (new Error(res.data.errMsg));
      }
    }).catch((err) => {
      console.error(err); // handle silently
    });
  };

  /**
   * Retrieves the Project information via GET request
   * to the server and saves it to state.
   */
  const getProject = () => {
    setLoadingData(true);
    axios.get('/project', {
      params: {
        projectID: props.match.params.id
      }
    }).then((res) => {
      if (!res.data.err) {
        if (res.data.project) {
          setProject(res.data.project);
          getProjectPinStatus();
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setLoadingData(false);
    }).catch((err) => {
      handleGlobalError(err);
      setLoadingData(false);
    });
  };


  const parseTaskDates = (array, format = 'MMMM DDD, YYYY') => {
    return array.map((item) => {
      if (item.createdAt) {
        const parsed = date.parse(item.createdAt, 'YYYY-MM-DD HH:mm:ss.SSS ');
        if (parsed instanceof Date && !isNaN(parsed.valueOf())) {
          item.createdAtObj = parsed;
          item.createdAtString = date.format(parsed, format);
        }
      }
      if (item.startDate) {
        const parsed = date.parse(item.startDate, 'YYYY-MM-DD');
        if (parsed instanceof Date && !isNaN(parsed.valueOf())) {
          item.startDateObj = parsed;
          item.startDateString = date.format(parsed, format);
        }
      }
      if (item.endDate) {
        const parsed = date.parse(item.endDate, 'YYYY-MM-DD');
        if (parsed instanceof Date && !isNaN(parsed.valueOf())) {
          item.endDateObj = parsed;
          item.endDateString = date.format(parsed, format);
        }
      }
      return item;
    });
  };


  const getProjectTasks = () => {
    setLoadingTasks(true);
    axios.get('/project/tasks', {
      params: {
        projectID: props.match.params.id
      }
    }).then((res) => {
      if (!res.data.err) {
        if (res.data.tasks && Array.isArray(res.data.tasks)) {
          // Flatten array of tasks by extracting subtasks and sort all
          let tasks = [...res.data.tasks];
          let flattenedTasks = [];
          tasks.forEach(item => {
            if (item.subtasks && item.subtasks.length > 0) {
              item.subtasks = parseTaskDates(item.subtasks);
              item.subtasks.sort((a, b) => {
                if (a.title < b.title) return -1;
                if (a.title > b.title) return 1;
                return 0;
              });
              flattenedTasks = flattenedTasks.concat(item.subtasks);
            }
          });
          tasks = parseTaskDates(tasks);
          tasks.sort((a, b) => {
            if (a.title < b.title) return -1;
            if (a.title > b.title) return 1;
            return 0;
          });
          flattenedTasks = [...tasks, ...flattenedTasks];
          // Prep tasks for UI presentation
          let newTasks = tasks.map((item) => {
            let uiOpen = false;
            if (projTasks.length > 0) {
              // try to preserve UI state on refresh
              let foundTask = projTasks.find((existing) => {
                return existing.hasOwnProperty('taskID') && existing.taskID === item.taskID;
              });
              if (foundTask !== undefined && foundTask.hasOwnProperty('uiOpen')) {
                uiOpen = foundTask.uiOpen;
              }
            }
            return {
              ...item,
              uiOpen: uiOpen
            }
          });
          setAllProjTasks(flattenedTasks);
          setProjTasks(newTasks);
          // If there is a task currently open, update it
          if (viewTaskData.taskID && viewTaskData.taskID !== '') {
            let foundTask = flattenedTasks.find(item => item.taskID === viewTaskData.taskID);
            if (foundTask !== undefined) {
              setViewTaskData(foundTask);
            }
          }
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setLoadingTasks(false);
    }).catch((err) => {
      handleGlobalError(err);
      setLoadingTasks(false);
    });
  };


  /**
   * Opens the Edit Information Modal and retrieves existing tags,
   * then sets fields to their current respective values.
   */
  const openEditInfoModal = () => {
    setEditModalLoading(true);
    getTags();
    if (project.title) setProjTitle(project.title);
    if (project.status) setProjStatus(project.status);
    if (project.visibility) setProjVisibility(project.visibility);
    if (project.hasOwnProperty('currentProgress')) setProjProgress(project.currentProgress);
    if (project.hasOwnProperty('peerProgress')) setProjPRProgress(project.peerProgress);
    if (project.hasOwnProperty('a11yProgress')) setProjA11YProgress(project.a11yProgress);
    if (project.classification) setProjClassification(project.classification);
    if (project.projectURL) setProjURL(project.projectURL);
    if (project.tags) setProjTags(project.tags);
    if (project.author) setProjResAuthor(project.author);
    if (project.authorEmail) setProjResEmail(project.authorEmail);
    if (project.license) setProjResLicense(project.license);
    if (project.resourceURL) setProjResURL(project.resourceURL);
    if (project.notes) setProjNotes(project.notes);
    setEditModalLoading(false);
    setShowEditModal(true);
  };


  /**
   * Closes the Edit Information Modal and resets all
   * fields to their default values.
   */
  const closeEditInfoModal = () => {
    setShowEditModal(false);
    setEditModalLoading(false);
    setProjTitle('');
    setProjStatus('open');
    setProjVisibility('private');
    setProjProgress(0);
    setProjPRProgress(0);
    setProjA11YProgress(0);
    setProjClassification('');
    setProjURL('');
    setProjTags([]);
    setProjResAuthor('');
    setProjResEmail('');
    setProjResLicense('');
    setProjResURL('');
    setProjNotes('');
  };


  /**
   * Load existing Project Tags from the server
   * via GET request, then sort, format, and save
   * them to state for use in the Dropdown.
   */
  const getTags = () => {
    axios.get('/projects/tags/org').then((res) => {
      if (!res.data.err) {
        if (res.data.tags && Array.isArray(res.data.tags)) {
          res.data.tags.sort((tagA, tagB) => {
            var aNorm = String(tagA.title).toLowerCase();
            var bNorm = String(tagB.title).toLowerCase();
            if (aNorm < bNorm) return -1;
            if (aNorm > bNorm) return 1;
            return 0;
          })
          const newTagOptions = res.data.tags.map((tagItem) => {
            return { text: tagItem.title, value: tagItem.title };
          });
          setTagOptions(newTagOptions);
          setLoadedTags(true);
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
    }).catch((err) => {
      handleGlobalError(err);
    });
  };


  /**
   * Resets all Edit Information form error states.
   */
  const resetEditInfoFormErrors = () => {
    setProjTitleErr(false);
    setProjProgressErr(false);
    setProjPRProgressErr(false);
    setProjA11YProgressErr(false);
  };


  /**
   * Validates the Edit Project Information form.
   * @returns {boolean} true if all fields are valid, false otherwise
   */
  const validateEditInfoForm = () => {
    var validForm = true;
    if (isEmptyString(projTitle)) {
      validForm = false;
      setProjTitleErr(true);
    }
    if ((projProgress < 0) || (projProgress > 100)) {
      validForm = false;
      setProjProgressErr(true);
    }
    if ((projPRProgress < 0) || (projPRProgress > 100)) {
      validForm = false;
      setProjPRProgressErr(true);
    }
    if ((projA11YProgress < 0) || (projA11YProgress > 100)) {
      validForm = false;
      setProjA11YProgressErr(true);
    }
    return validForm;
  };

  /**
   * Opens the Pin/Unpin success modal by setting state accordingly.
   *
   * @param {boolean} didPin - True if project was pinned, false if unpinned.
   */
  const openPinnedModal = (didPin) => {
    setPinnedModalDidPin(didPin);
    setShowPinnedModal(true);
  };

  /**
   * Closes the Pin/Unpin success modal and resets state.
   */
  const closePinnedModal = () => {
    setShowPinnedModal(false);
    setPinnedModalDidPin(true);
  };

  /**
   * Examines the current status of the user's project "pin" and submits the corresponding
   * request to the server to toggle the pin. 
   */
  const toggleProjectPin = () => {
    axios({
      method: projectPinned ? 'DELETE' : 'PUT',
      url: '/project/pin',
      data: {
        projectID: props.match.params.id,
      },
    }).then((res) => {
      if (!res.data.err) {
        getProjectPinStatus();
        openPinnedModal(!projectPinned);
      } else {
        handleGlobalError(res.data.errMsg);
      }
    }).catch((err) => {
      handleGlobalError(err);
    });
  };

  /**
   * Ensure the form data is valid, then submit the
   * data to the server via POST request. Re-syncs
   * Project information on success.
   */
  const submitEditInfoForm = () => {
    resetEditInfoFormErrors();
    if (validateEditInfoForm()) {
      setEditModalLoading(true);
      var projData = {
        projectID: props.match.params.id
      };
      if (project.tags) {
        var newTags = false;
        var originalPlainTags = [];
        if (project.tags) originalPlainTags = project.tags;
        // check if there are any new tags
        projTags.forEach((tag) => {
          if (!originalPlainTags.includes(tag)) newTags = true;
        });
        // new tags are present or all tags were removed
        if (newTags || (originalPlainTags.length > 0 && projTags.length === 0)) projData.tags = projTags;
      } else {
        projData.tags = projTags;
      }
      if ((project.title && project.title !== projTitle) || !project.title) {
        projData.title = projTitle;
      }
      if ((project.hasOwnProperty('currentProgress') && project.currentProgress !== projProgress) || !project.hasOwnProperty('currentProgress')) {
        projData.progress = projProgress;
      }
      if ((project.hasOwnProperty('peerProgress') && project.peerProgress !== projPRProgress) || !project.hasOwnProperty('peerProgress')) {
        projData.peerProgress = projPRProgress;
      }
      if ((project.hasOwnProperty('a11yProgress') && project.a11yProgress !== projA11YProgress) || !project.hasOwnProperty('a11yProgress')) {
        projData.a11yProgress = projA11YProgress;
      }
      if ((project.classification && project.classification !== projClassification) || !project.classification) {
        projData.classification = projClassification;
      }
      if ((project.status && project.status !== projStatus) || !project.status) {
        projData.status = projStatus;
      }
      if ((project.visibility && project.visibility !== projVisibility) || !project.visibility) {
        projData.visibility = projVisibility;
      }
      if ((project.projectURL && project.projectURL !== projURL) || !project.projectURL) {
        projData.projectURL = projURL;
      }
      if ((project.author && project.author !== projResAuthor) || !project.author) {
        projData.author = projResAuthor;
      }
      if ((project.authorEmail && project.authorEmail !== projResEmail) || !project.authorEmail) {
        projData.authorEmail = projResEmail.trim();
      }
      if ((project.license && project.license !== projResLicense) || !project.license) {
        projData.license = projResLicense;
      }
      if ((project.resourceURL && project.resourceURL !== projResURL) || !project.resourceURL) {
        projData.resourceURL = projResURL;
      }
      if ((project.notes && project.notes !== projNotes) || !project.notes) {
        projData.notes = projNotes;
      }
      if (Object.keys(projData).length > 1) {
        axios.put('/project', projData).then((res) => {
          if (!res.data.err) {
            closeEditInfoModal();
            getProject();
          } else {
            handleGlobalError(res.data.errMsg);
            setEditModalLoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setEditModalLoading(false);
        });
      } else {
        // no changes to save
        closeEditInfoModal();
      }
    }
  };


  /**
   * Retrieves a list of users that can be added as team members to the
   * project, then processes and sets them in state.
   */
  const getTeamUserOptions = () => {
    setTeamUserOptsLoading(true);
    axios.get('/project/team/addable', {
      params: {
        projectID: props.match.params.id
      }
    }).then((res) => {
      if (!res.data.err) {
        if (res.data.users && Array.isArray(res.data.users)) {
          var newOptions = [];
          res.data.users.forEach((item) => {
            newOptions.push({
              key: item.uuid,
              text: `${item.firstName} ${item.lastName}`,
              value: item.uuid,
              image: {
                avatar: true,
                src: item.avatar
              }
            });
          });
          newOptions.sort((a, b) => {
            var normalizedA = String(a.text).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            var normalizedB = String(b.text).toLowerCase().replace(/[^a-zA-Z]/gm, '');
            if (normalizedA < normalizedB) {
              return -1;
            }
            if (normalizedA > normalizedB) {
              return 1;
            }
            return 0;
          });
          newOptions.unshift({ key: 'empty', text: 'Clear...', value: '' });
          setTeamUserOptions(newOptions);
        }
      } else {
        handleGlobalError(res.data.errMsg);
      }
      setTeamUserOptsLoading(false);
    }).catch((err) => {
      handleGlobalError(err);
      setTeamUserOptsLoading(false);
    });
  };


  /**
   * Submits a PUT request to the server to add the user
   * in state (teamUserToAdd) to the project's team, then
   * refreshes the project data and Addable Users options.
   */
  const submitAddTeamMember = () => {
    if (!isEmptyString(teamUserToAdd)) {
      setTeamModalLoading(true);
      axios.put('/project/team/add', {
        projectID: props.match.params.id,
        uuid: teamUserToAdd
      }).then((res) => {
        if (!res.data.err) {
          setTeamModalLoading(false);
          getTeamUserOptions();
          getProject();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setTeamModalLoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setTeamModalLoading(false);
      });
    }
  };


  /**
   * Submits a PUT request to the server to update the team member's
   * role in the project, then refreshes the project data.
   * @param {String} memberUUID - the UUID of the team member to update
   * @param {String} newRole - the new role setting
   */
  const submitChangeTeamMemberRole = (memberUUID, newRole) => {
    if (!isEmptyString(memberUUID) && !isEmptyString(newRole)) {
      setTeamModalLoading(true);
      axios.put('/project/team/role', {
        projectID: props.match.params.id,
        uuid: memberUUID,
        newRole: newRole
      }).then((res) => {
        if (!res.data.err) {
          setTeamModalLoading(false);
          getProject();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setTeamModalLoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setTeamModalLoading(false);
      });
    }
  };


  /**
   * Submits a PUT request to the server to remove the specified user
   * from the project's team, then refreshes the
   * project data and Addable Users options.
   * @param  {String} memberUUID  - the uuid of the user to remove
   */
  const submitRemoveTeamMember = (memberUUID) => {
    if (!isEmptyString(memberUUID)) {
      setTeamModalLoading(true);
      axios.put('/project/team/remove', {
        projectID: props.match.params.id,
        uuid: memberUUID
      }).then((res) => {
        if (!res.data.err) {
          setTeamModalLoading(false);
          getTeamUserOptions();
          getProject();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setTeamModalLoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setTeamModalLoading(false);
      });
    }
  };


  /**
   * Opens the Manage Team Modal and sets the fields to their
   * default values, then triggers the function to retrieve the list of
   * addable users.
   */
  const openTeamModal = () => {
    setTeamModalLoading(false);
    setTeamUserOptions([]);
    setTeamUserToAdd('');
    getTeamUserOptions();
    setShowTeamModal(true);
  };


  /**
   * Closes the Manage Team Modal and resets the fields
   * to their default values.
   */
  const closeTeamModal = () => {
    setShowTeamModal(false);
    setTeamUserOptions([]);
    setTeamUserToAdd('');
    setTeamUserOptsLoading(false);
    setTeamModalLoading(false);
  };


  /**
   * Submits a DELETE request to the server to delete the project,
   * then redirects to the Projects dashboard on success.
   */
  const submitDeleteProject = () => {
    setDeleteProjModalLoading(true);
    axios.delete('/project', {
      data: {
        projectID: props.match.params.id
      }
    }).then((res) => {
      setDeleteProjModalLoading(false);
      if (!res.data.err) {
        props.history.push('/projects?projectDeleted=true');
      } else {
        handleGlobalError(res.data.errMsg);
      }
    }).catch((err) => {
      handleGlobalError(err);
      setDeleteProjModalLoading(false);
    });
  };


  const handleTaskSearch = (_e, { value }) => {
    setTaskSearchLoading(true);
    setTaskSearchQuery(value);
    let searchRegExp = new RegExp(value, 'g');
    let results = allProjTasks.filter((task) => {
      let descripString = String(task.title).toLowerCase() + ' ' + String(task.description).toLowerCase();
      if (value !== '') {
        let match = descripString.match(searchRegExp);
        if (match !== null && match.length > 0) {
          return task;
        }
      }
      return false;
    }).map((item) => {
      return {
        id: item.taskID,
        title: item.title,
        description: item.description
      }
    });
    setTaskSearchResults(results);
    setTaskSearchLoading(false);
  };


  const toggleTaskDetail = (id) => {
    const updatedTasks = projTasks.map((item) => {
      if (id === item.taskID) {
        return {
          ...item,
          uiOpen: !item.uiOpen
        }
      } else return item;
    });
    setProjTasks(updatedTasks);
  };


  const expandCollapseAllTasks = () => {
    let updatedTasks = [];
    const foundOpen = projTasks.find((item) => {
      return (item.uiOpen === true);
    });
    if (foundOpen !== undefined) { // one is open, close them all
      updatedTasks = projTasks.map((item) => {
        return {
          ...item,
          uiOpen: false
        }
      });
    } else { // all are closed, open them all
      updatedTasks = projTasks.map((item) => {
        return {
          ...item,
          uiOpen: true
        }
      });
    }
    setProjTasks(updatedTasks);
  };


  const openManageTaskModal = (mode, taskID, parent) => {
    let canOpen = false;
    setMngTaskLoading(true);
    if (mode === 'edit' && (typeof (taskID) === 'string' && taskID !== null)) {
      setMngTaskMode('edit');
      let foundTask = allProjTasks.find(item => item.taskID === taskID);
      if (foundTask !== undefined) {
        canOpen = true;
        setMngTaskData(foundTask);
        setMngTaskTitle(foundTask.title);
        setMngTaskDescrip(foundTask.description);
        setMngTaskStatus(foundTask.status);
        if (foundTask.parent && foundTask.parent !== '') {
          setMngTaskSubtask(true);
          setMngTaskParent(foundTask.parent);
        }
      }
    } else {
      canOpen = true;
      setMngTaskMode('add');
      setMngTaskTitle('');
      setMngTaskDescrip('');
      setMngTaskStatus('available');
      if (parent !== null && typeof (parent) === 'string') {
        setMngTaskSubtask(true);
        setMngTaskParent(parent);
      }
    }
    setMngTaskTitleErr(false);
    setMngTaskLoading(false);
    setMngTaskStartDate(null);
    setMngTaskEndDate(null);
    if (canOpen) {
      setShowMngTaskModal(true);
    }
  };


  const closeManageTaskModal = () => {
    setShowMngTaskModal(false);
    setMngTaskMode('add');
    setMngTaskLoading(false);
    setMngTaskTitle('');
    setMngTaskDescrip('');
    setMngTaskStatus('available');
    setMngTaskTitleErr(false);
    setMngTaskSubtask(false);
    setMngTaskParent('');
    setMngTaskStartDate(null);
    setMngTaskEndDate(null);
  };


  const submitManageTask = () => {
    setMngTaskTitleErr(false);
    if (!isEmptyString(mngTaskTitle)) {
      setMngTaskLoading(true);
      if (mngTaskMode === 'edit') {
        let taskData = {
          projectID: props.match.params.id,
          taskID: mngTaskData.taskID
        };
        if ((mngTaskData.title && mngTaskData.title !== mngTaskTitle) || !mngTaskData.title) {
          taskData.title = mngTaskTitle;
        }
        if ((mngTaskData.description && mngTaskData.description !== mngTaskDescrip) || !mngTaskData.description) {
          taskData.description = mngTaskDescrip;
        }
        if ((mngTaskData.status && mngTaskData.status !== mngTaskStatus) || !mngTaskData.status) {
          taskData.status = mngTaskStatus;
        }
        axios.put('/project/task', taskData).then((res) => {
          if (!res.data.err) {
            getProjectTasks();
            closeManageTaskModal();
          } else {
            handleGlobalError(res.data.errMsg);
            setMngTaskLoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setMngTaskLoading(false);
        });
      } else if (mngTaskMode === 'add') {
        let taskData = {
          projectID: props.match.params.id,
          title: mngTaskTitle,
          status: mngTaskStatus
        };
        if (!isEmptyString(mngTaskDescrip)) taskData.description = mngTaskDescrip;
        if (mngTaskParent !== '') taskData.parent = mngTaskParent;
        if (mngTaskStartDate !== null) {
          taskData.startDate = date.format(mngTaskStartDate, 'YYYY-MM-DD');
        }
        if (mngTaskEndDate !== null) {
          taskData.endDate = date.format(mngTaskEndDate, 'YYYY-MM-DD');
        }
        axios.post('/project/task', taskData).then((res) => {
          if (!res.data.err) {
            getProjectTasks();
            closeManageTaskModal();
          } else {
            handleGlobalError(res.data.errMsg);
            setMngTaskLoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setMngTaskLoading(false);
        });
      }
    } else {
      setMngTaskTitleErr(true);
    }
  };

  const submitTaskStatus = (e, { value }) => {
    if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
      setViewTaskStatusLoading(true);
      axios.put('/project/task', {
        projectID: props.match.params.id,
        taskID: viewTaskData.taskID,
        status: value
      }).then((res) => {
        if (!res.data.err) {
          getProjectTasks();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setViewTaskStatusLoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setViewTaskStatusLoading(false);
      });
    }
  };

  const getTaskMessages = useCallback(() => {
    setViewTaskLoadedMsgs(false);
    if (viewTaskData.taskID !== undefined & !isEmptyString(viewTaskData.taskID)) {
      axios.get('/project/task/messages', {
        params: {
          taskID: viewTaskData.taskID
        }
      }).then((res) => {
        if (!res.data.err) {
          if (res.data.messages && Array.isArray(res.data.messages)) {
            setViewTaskMsgs(res.data.messages);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setViewTaskLoadedMsgs(true);
      }).catch((err) => {
        handleGlobalError(err);
        setViewTaskLoadedMsgs(true);
      });
    }
  }, [handleGlobalError, viewTaskData]);

  useEffect(() => {
    if (viewTaskData.taskID !== undefined && !isEmptyString(viewTaskData.taskID)) {
      getTaskMessages();
    }
  }, [viewTaskData, getTaskMessages]);

  const openViewTaskModal = (taskID) => {
    setViewTaskLoading(true);
    let foundTask = allProjTasks.find((item) => item.taskID === taskID);
    if (foundTask !== undefined) {
      setViewTaskData(foundTask);
      setShowViewTaskModal(true);
      setViewTaskLoading(false);
      setViewTaskLoadedMsgs(false);
      setViewTaskStartDateEdit(false);
      setViewTaskStartDateLoading(false);
      setViewTaskStartDateNew(new Date());
      setViewTaskEndDateNew(new Date());
      setViewTaskEndDateEdit(false);
      setViewTaskEndDateLoading(false);
    }
  };


  const closeViewTaskModal = () => {
    setShowViewTaskModal(false);
    setViewTaskLoading(false);
    setViewTaskLoadedMsgs(false);
    setViewTaskStartDateEdit(false);
    setViewTaskStartDateLoading(false);
    setViewTaskStartDateNew(new Date());
    setViewTaskEndDateNew(new Date());
    setViewTaskEndDateEdit(false);
    setViewTaskEndDateLoading(false);
    setViewTaskData({});
    setViewTaskMsgs([]);
  };

  const editTaskDate = (type) => {
    if (type === 'start') {
      if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
        if (viewTaskData.startDate) {
          const parsed = date.parse(viewTaskData.startDate, 'YYYY-MM-DD');
          if (parsed instanceof Date && !isNaN(parsed.valueOf())) {
            setViewTaskStartDateNew(parsed);
          }
        }
      }
      setViewTaskStartDateEdit(true);
    } else if (type === 'end') {
      if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
        if (viewTaskData.endDate) {
          const parsed = date.parse(viewTaskData.endDate, 'YYYY-MM-DD');
          if (parsed instanceof Date && !isNaN(parsed.valueOf())) {
            setViewTaskEndDateNew(parsed);
          }
        }
      }
      setViewTaskEndDateEdit(true);
    }
  };

  const saveTaskDate = (type) => {
    if (type === 'start') {
      if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
        setViewTaskStartDateLoading(true);
        let formattedDate = date.format(viewTaskStartDateNew, 'YYYY-MM-DD');
        axios.put('/project/task', {
          taskID: viewTaskData.taskID,
          startDate: formattedDate
        }).then((res) => {
          if (!res.data.err) {
            setViewTaskStartDateEdit(false);
            setViewTaskStartDateNew(new Date());
            getProjectTasks();
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setViewTaskStartDateLoading(false);
        }).catch((err) => {
          handleGlobalError(err);
          setViewTaskStartDateLoading(false);
        });
      }
    } else if (type === 'end') {
      if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
        setViewTaskEndDateLoading(true);
        let formattedDate = date.format(viewTaskEndDateNew, 'YYYY-MM-DD');
        axios.put('/project/task', {
          taskID: viewTaskData.taskID,
          endDate: formattedDate
        }).then((res) => {
          if (!res.data.err) {
            setViewTaskEndDateEdit(false);
            setViewTaskEndDateNew(new Date());
            getProjectTasks();
          } else {
            handleGlobalError(res.data.errMsg);
          }
          setViewTaskEndDateLoading(false);
        }).catch((err) => {
          handleGlobalError(err);
          setViewTaskEndDateLoading(false);
        });
      }
    }
  };

  const handleChangeDiscussionVis = () => {
    setShowDiscussion(!showDiscussion);
    localStorage.setItem('conductor_show_projectdiscussion', !showDiscussion);
  };

  const getParentTaskName = (taskID) => {
    let foundTask = allProjTasks.find((item) => item.taskID === taskID);
    if (foundTask !== undefined) {
      return foundTask.title;
    } else {
      return 'Unknown';
    }
  };

  const openATAModal = (task) => {
    if (task.taskID !== null && !isEmptyString(task.taskID)
      && typeof (task) === 'object') {
      setATAUsers([]);
      setATAUUID('');
      setATASubtasks(false);
      setATAError(false);
      setATALoading(true);
      setShowATAModal(true);
      let currentAssignees = null;
      if (task.assignees && Array.isArray(task.assignees)
        && task.assignees.length > 0) {
        currentAssignees = [];
        task.assignees.forEach((item) => {
          if (typeof (item) === 'string') currentAssignees.push(item);
          else if (typeof (item) === 'object' && item.uuid && !isEmptyString(item.uuid)) {
            currentAssignees.push(item.uuid);
          }
        });
      }
      let projectTeam = constructProjectTeam(project, currentAssignees);
      let usersToSet = [];
      if (Array.isArray(projectTeam) && projectTeam.length > 0) {
        projectTeam.forEach((item) => {
          if (item.uuid && item.firstName && item.lastName) {
            let newEntry = {
              key: item.uuid,
              text: `${item.firstName} ${item.lastName}`,
              value: item.uuid,
              image: {
                avatar: true
              }
            };
            if (item.avatar && !isEmptyString(item.avatar)) {
              newEntry.image.src = item.avatar;
            } else {
              newEntry.image.src = '/mini_logo.png';
            }
            usersToSet.push(newEntry);
          }
        });
      }
      setATAUsers(usersToSet);
      setATALoading(false);
    }
  };

  const closeATAModal = () => {
    setShowATAModal(false);
    setATAUsers([]);
    setATAUUID('');
    setATASubtasks(false);
    setATALoading(false);
    setATAError(false);
  };

  const submitAddTaskAssignee = () => {
    setATAError(false);
    if (!isEmptyString(ataUUID)) {
      if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
        setATALoading(true);
        axios.put('/project/task/assignees/add', {
          projectID: props.match.params.id,
          taskID: viewTaskData.taskID,
          assignee: ataUUID,
          subtasks: ataSubtasks
        }).then((res) => {
          if (!res.data.err) {
            getProjectTasks();
            closeATAModal();
          } else {
            handleGlobalError(res.data.errMsg);
            setATALoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setATALoading(false);
        });
      }
    } else setATAError(true);
  };

  const openRMTAModal = (name, uuid) => {
    if (viewTaskData.taskID !== null
      && !isEmptyString(viewTaskData.taskID)
      && typeof (name) === 'string'
      && typeof (uuid) === 'string'
      && !isEmptyString(uuid)) {
      setRMTAName(name);
      setRMTAUUID(uuid);
      setRMTASubtasks(false);
      setRMTALoading(false);
      setShowRMTAModal(true);
    }
  };

  const submitRemoveTaskAssignee = () => {
    if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
      setRMTALoading(true);
      axios.put('/project/task/assignees/remove', {
        projectID: props.match.params.id,
        taskID: viewTaskData.taskID,
        assignee: rmtaUUID,
        subtasks: rmtaSubtasks
      }).then((res) => {
        if (!res.data.err) {
          getProjectTasks();
          closeRMTAModal();
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setRMTALoading(false);
      }).catch((err) => {
        handleGlobalError(err);
        setRMTALoading(false);
      });
    }
  };

  const closeRMTAModal = () => {
    setShowRMTAModal(false);
    setRMTAName('');
    setRMTAUUID('');
    setRMTASubtasks(false);
    setRMTALoading(false);
  };

  const openATDModal = () => {
    if (viewTaskData.taskID !== null && !isEmptyString(viewTaskData.taskID)) {
      setATDLoading(true);
      setATDTaskID('');
      setATDError(false);
      setShowATDModal(true);
      let taskOptions = [];
      if (Array.isArray(allProjTasks) && allProjTasks.length > 0) {
        taskOptions = allProjTasks.filter((item) => {
          if (!item.hasOwnProperty('taskID')) return false;
          if (item.taskID && item.taskID === viewTaskData.taskID) {
            // don't include the task itself
            return false;
          }
          // don't include existing dependencies
          if (viewTaskData.hasOwnProperty('dependencies') && Array.isArray(viewTaskData.dependencies)) {
            let foundTask = viewTaskData.dependencies.find((existingDep) => {
              if (typeof (existingDep) === 'string') {
                return existingDep === item.taskID;
              } else if (typeof (existingDep) === 'object') {
                return existingDep.taskID === item.taskID;
              }
              return false;
            });
            if (foundTask !== undefined) return false;
          }
          // don't include the parent task
          if (viewTaskData.hasOwnProperty('parent') && typeof (viewTaskData.parent) === 'string') {
            if (viewTaskData.parent === item.taskID) return false;
          } else if (viewTaskData.hasOwnProperty('parent') && typeof (viewTaskData.parent) === 'object' && viewTaskData.parent !== null) {
            if (viewTaskData.parent?.taskID === item.taskID) return false;
          }
          return true;
        }).map((item) => {
          return {
            key: item.taskID,
            text: item.title,
            value: item.taskID
          }
        });
      }
      setATDTasks(taskOptions);
      setATDLoading(false);
    }
  };

  const submitAddTaskDependency = () => {
    setATDError(false);
    if (viewTaskData.taskID && !isEmptyString(viewTaskData.taskID)) {
      if (!isEmptyString(atdTaskID)) {
        setATDLoading(true);
        let depsToSend = [];
        if (viewTaskData.dependencies && Array.isArray(viewTaskData.dependencies)) {
          depsToSend = viewTaskData.dependencies.map((item) => {
            if (typeof (item) === 'string') return item;
            else if (typeof (item) === 'object') {
              if (item.hasOwnProperty('taskID')) return item.taskID;
            }
            return null;
          }).filter(item => item !== null);
        }
        depsToSend.push(atdTaskID);
        axios.put('/project/task', {
          taskID: viewTaskData.taskID,
          dependencies: depsToSend
        }).then((res) => {
          if (!res.data.err) {
            getProjectTasks();
            closeATDModal();
          } else {
            handleGlobalError(res.data.errMsg);
            setATDLoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setATDLoading(false);
        });
      } else {
        setATDError(true);
      }
    }
  };

  const closeATDModal = () => {
    setShowATDModal(false);
    setATDLoading(false);
    setATDTaskID('');
    setATDTasks([]);
    setATDError(false);
  };

  const openRTDModal = (depend) => {
    if (viewTaskData.taskID && !isEmptyString(viewTaskData.taskID) && depend !== undefined
      && depend !== null && depend.hasOwnProperty('taskID') && !isEmptyString(depend.taskID)) {
      setShowRTDModal(true);
      setRTDLoading(true);
      setRTDTaskID(depend.taskID);
      if (depend.hasOwnProperty('title') && !isEmptyString(depend.title)) {
        setRTDTaskTitle(depend.title);
      } else setRTDTaskTitle('Unknown Task');
      setRTDLoading(false);
    }
  };

  const submitRemoveTaskDependency = () => {
    if (viewTaskData.taskID && !isEmptyString(viewTaskData.taskID) && !isEmptyString(rtdTaskID)) {
      setRTDLoading(true);
      let depsToSend = [];
      if (viewTaskData.dependencies && Array.isArray(viewTaskData.dependencies)) {
        depsToSend = viewTaskData.dependencies.map((item) => {
          if (typeof (item) === 'string') return item;
          else if (typeof (item) === 'object') {
            if (item.hasOwnProperty('taskID')) return item.taskID;
          }
          return null;
        }).filter(item => item !== null && item !== rtdTaskID);
      }
      axios.put('/project/task', {
        taskID: viewTaskData.taskID,
        dependencies: depsToSend
      }).then((res) => {
        if (!res.data.err) {
          getProjectTasks();
          closeRTDModal();
        } else {
          handleGlobalError(res.data.errMsg);
          setRTDLoading(false);
        }
      }).catch((err) => {
        handleGlobalError(err);
        setRTDLoading(false);
      });
    }
  };

  const closeRTDModal = () => {
    setShowRTDModal(false);
    setRTDTaskID('');
    setRTDTaskTitle('');
    setRTDLoading(false);
  };

  const openDeleteTaskModal = (taskID) => {
    let foundTask = allProjTasks.find((item) => item.taskID === taskID);
    if (foundTask !== undefined) {
      setDelTaskData(foundTask);
      if (foundTask.parent && foundTask.parent !== '') {
        setDelTaskParent(foundTask.parent);
        setDelTaskSubtask(true);
      }
      if (foundTask.subtasks && Array.isArray(foundTask.subtasks) && foundTask.subtasks.length > 0) {
        setDelTaskHasSubtasks(true);
      }
      setDelTaskLoading(false);
      setShowDelTaskModal(true);
    }
  };

  const closeDeleteTaskModal = () => {
    setShowDelTaskModal(false);
    setDelTaskData({});
    setDelTaskLoading(false);
    setDelTaskSubtask(false);
    setDelTaskParent('');
    setDelTaskHasSubtasks(false);
  };

  const submitDeleteTask = () => {
    if (delTaskData.taskID && delTaskData.taskID !== '') {
      setDelTaskLoading(true);
      axios.delete('/project/task', {
        data: {
          taskID: delTaskData.taskID
        }
      }).then((res) => {
        if (!res.data.err) {
          getProjectTasks();
          closeDeleteTaskModal();
          closeViewTaskModal();
        } else {
          handleGlobalError(res.data.errMsg);
          setDelTaskLoading(false);
        }
      }).catch((err) => {
        handleGlobalError(err);
        setDelTaskLoading(false);
      });
    }
  };

  const openBatchModal = () => {
    resetBatchAddForm();
    setBatchTasks(1);
    setBatchTitle('');
    setBatchAddSubtasks(false);
    setBatchSubtasks(1);
    setBatchSubtitle('');
    setBatchAddLoading(false);
    setShowBatchModal(true);
  };

  const closeBatchModal = () => {
    setShowBatchModal(false);
    resetBatchAddForm();
    setBatchTasks(1);
    setBatchTitle('');
    setBatchAddSubtasks(false);
    setBatchSubtasks(1);
    setBatchSubtitle('');
    setBatchAddLoading(false);
  };

  const validateBatchAdd = () => {
    let validForm = true;
    if ((batchTasks < 1) || (batchTasks > 100)) {
      validForm = false;
      setBatchTasksErr(true);
    }
    if (isEmptyString(batchTitle)) {
      validForm = false;
      setBatchTitleErr(true);
    }
    if (batchAddSubtasks) {
      if ((batchSubtasks < 1) || (batchSubtasks > 100)) {
        validForm = false;
        setBatchSubtasksErr(true);
      }
      if (isEmptyString(batchSubtitle)) {
        validForm = false;
        setBatchSubtitleErr(true);
      }
    }
    return validForm;
  };

  const resetBatchAddForm = () => {
    setBatchTasksErr(false);
    setBatchTitleErr(false);
    setBatchSubtasksErr(false);
    setBatchSubtitleErr(false);
  };

  const submitBatchAdd = () => {
    resetBatchAddForm();
    if (validateBatchAdd()) {
      setBatchAddLoading(true);
      let taskData = {
        projectID: props.match.params.id,
        tasks: batchTasks,
        titlePrefix: batchTitle
      };
      if (batchAddSubtasks) {
        taskData = {
          ...taskData,
          addSubtasks: true,
          subtasks: batchSubtasks,
          subtitlePrefix: batchSubtitle
        };
      }
      axios.post('/project/task/batchadd', taskData).then((res) => {
        if (!res.data.err) {
          getProjectTasks();
          closeBatchModal();
        } else {
          handleGlobalError(res.data.errMsg);
          setBatchAddLoading(false);
        }
      }).catch((err) => {
        handleGlobalError(err);
        setBatchAddLoading(false);
      });
    }
  };

  const openFlagModal = (mode = 'set') => {
    setFlagLoading(false);
    setFlagOption('');
    setFlagDescrip('');
    setShowFlagModal(true);
    setFlagMode(mode);
    setFlagOptionErr(false);
    setFlagDescripErr(false);
  };

  const closeFlagModal = () => {
    setShowFlagModal(false);
    setFlagMode('set');
    setFlagLoading(false);
    setFlagOption('');
    setFlagDescrip('');
    setFlagOptionErr(false);
    setFlagDescripErr(false);
  };

  const submitFlagProject = () => {
    if (flagMode === 'set') {
      setFlagOptionErr(false);
      setFlagDescripErr(false);
      let validForm = true;
      if (isEmptyString(flagOption)) {
        validForm = false;
        setFlagOptionErr(true);
      }
      if (flagDescrip.length > 2000) {
        validForm = false;
        setFlagDescripErr(true);
      }
      if (validForm) {
        setFlagLoading(true);
        let flagData = {
          projectID: props.match.params.id,
          flagOption: flagOption
        };
        if (!isEmptyString(flagDescrip)) {
          flagData.flagDescrip = flagDescrip;
        }
        axios.put('/project/flag', flagData).then((res) => {
          if (!res.data.err) {
            getProject();
            closeFlagModal();
          } else {
            handleGlobalError(res.data.errMsg);
            setFlagLoading(false);
          }
        }).catch((err) => {
          handleGlobalError(err);
          setFlagLoading(false);
        });
      }
    } else if (flagMode === 'clear') {
      setFlagLoading(true);
      axios.put('/project/flag/clear', {
        projectID: props.match.params.id
      }).then((res) => {
        if (!res.data.err) {
          getProject();
          closeFlagModal();
        } else {
          handleGlobalError(res.data.errMsg);
          setFlagLoading(false);
        }
      }).catch((err) => {
        handleGlobalError(err);
        setFlagLoading(false);
      });
    }
  };


  // Rendering Helper Booleans
  let hasResourceInfo = project.author || project.license || project.resourceURL;
  let hasNotes = project.notes && !isEmptyString(project.notes);
  let hasFlag = project.flag && !isEmptyString(project.flag);
  let flagCrumbEnabled = hasFlag && showReviewerCrumb;
  let libreAlertEnabled = project.libreAlerts && Array.isArray(project.libreAlerts) && user.uuid && project.libreAlerts.includes(user.uuid);


  const AvailableIndicator = () => {
    return (
      <Popup
        content='Available'
        trigger={
          <Icon name='bullseye' color='teal' />
        }
        position='top center'
      />
    )
  };

  const InProgressIndicator = () => {
    return (
      <Popup
        content='In progress'
        trigger={
          <Icon name='spinner' color='blue' />
        }
        position='top center'
      />
    )
  };

  const CompletedIndicator = () => {
    return (
      <Popup
        content='Completed'
        trigger={
          <Icon name='check' color='green' />
        }
        position='top center'
      />
    )
  };

  const renderStatusIndicator = (status, addLeftMargin) => {
    switch (status) {
      case 'completed':
        return <CompletedIndicator />;
      case 'inprogress':
        return <InProgressIndicator />;
      default:
        return <AvailableIndicator />;
    }
  };

  const renderTeamList = (projData) => {
    const renderListItem = (item, role, idx) => {
      return (
        <List.Item key={`${role}-${idx}`}>
          <Image avatar src={item.avatar} />
          <List.Content>{item.firstName} {item.lastName} <span className='muted-text'>({role})</span></List.Content>
        </List.Item>
      );
    };
    return (
      <List divided verticalAlign='middle'>
        {(projData.hasOwnProperty('leads') && Array.isArray(projData.leads)) &&
          sortUsersByName(project.leads).map((item, idx) => renderListItem(item, 'Lead', idx))
        }
        {(projData.hasOwnProperty('liaisons') && Array.isArray(projData.liaisons)) &&
          sortUsersByName(project.liaisons).map((item, idx) => renderListItem(item, 'Liaison', idx))
        }
        {(projData.hasOwnProperty('members') && Array.isArray(projData.members)) &&
          sortUsersByName(project.members).map((item, idx) => renderListItem(item, 'Member', idx))
        }
        {(projData.hasOwnProperty('auditors') && Array.isArray(projData.auditors)) &&
          sortUsersByName(project.auditors).map((item, idx) => renderListItem(item, 'Auditor', idx))
        }
      </List>
    )
  };


  const renderTeamModalList = (projData) => {
    let projTeam = [];
    if (projData.leads && Array.isArray(projData.leads)) {
      projData.leads.forEach((item) => {
        projTeam.push({ ...item, role: 'lead', roleDisplay: 'Lead' });
      });
    }
    if (projData.liaisons && Array.isArray(projData.liaisons)) {
      projData.liaisons.forEach((item) => {
        projTeam.push({ ...item, role: 'liaison', roleDisplay: 'Liaison' });
      });
    }
    if (projData.members && Array.isArray(projData.members)) {
      projData.members.forEach((item) => {
        projTeam.push({ ...item, role: 'member', roleDisplay: 'Member' });
      });
    }
    if (projData.auditors && Array.isArray(projData.auditors)) {
      projData.auditors.forEach((item) => {
        projTeam.push({ ...item, role: 'auditor', roleDisplay: 'Auditor' });
      });
    }
    projTeam = sortUsersByName(projTeam);
    return (
      <List divided verticalAlign='middle' className='mb-4p'>
        {projTeam.map((item, idx) => {
          return (
            <List.Item key={`team-${idx}`}>
              <div className='flex-row-div'>
                <div className='left-flex'>
                  <Image avatar src={item.avatar} />
                  <List.Content className='ml-1p'>{item.firstName} {item.lastName}</List.Content>
                </div>
                <div className='right-flex'>
                  <Dropdown
                    placeholder='Change role...'
                    selection
                    options={projectRoleOptions}
                    value={item.role}
                    loading={teamModalLoading}
                    onChange={(_e, { value }) => submitChangeTeamMemberRole(item.uuid, value)}
                  />
                  <Popup
                    position='top center'
                    trigger={
                      <Button
                        color='red'
                        className='ml-1p'
                        onClick={() => { submitRemoveTeamMember(item.uuid) }}
                        icon
                      >
                        <Icon name='remove circle' />
                      </Button>
                    }
                    content='Remove from project'
                  />
                </div>
              </div>
            </List.Item>
          )
        })}
      </List>
    )
  };


  return (
    <Grid className='component-container'>
      <Grid.Row>
        <Grid.Column width={16}>
          <Header className='component-header'>Project: <em>{project.title || 'Loading...'}</em></Header>
        </Grid.Column>
      </Grid.Row>
      <Grid.Row>
        <Grid.Column width={16}>
          <Segment.Group>
            <Segment className='flex-row-div flex-row-verticalcenter'>
              <Breadcrumb className='project-meta-breadcrumb'>
                <Breadcrumb.Section as={Link} to='/projects'>
                  Projects
                </Breadcrumb.Section>
                <Breadcrumb.Divider icon='right chevron' />
                {(flagCrumbEnabled) &&
                  <Breadcrumb.Section as={Link} to='/projects/flagged'>
                    Flagged Projects
                  </Breadcrumb.Section>
                }
                {(!flagCrumbEnabled && project.status === 'available') &&
                  <Breadcrumb.Section as={Link} to='/projects/available'>
                    Available Projects
                  </Breadcrumb.Section>
                }
                {(!flagCrumbEnabled && project.status === 'completed') &&
                  <Breadcrumb.Section as={Link} to='/projects/completed'>
                    Completed Projects
                  </Breadcrumb.Section>
                }
                {(flagCrumbEnabled || project.status === 'available' || project.status === 'completed') &&
                  <Breadcrumb.Divider icon='right chevron' />
                }
                <Breadcrumb.Section active>
                  {project.title || 'Loading...'}
                </Breadcrumb.Section>
              </Breadcrumb>
              <div className='flex-row-div flex-row-verticalcenter'>
                <span className='muted-text mr-2r'>ID: {project.projectID || 'Loading...'}</span>
                <Button
                  content={`${projectPinned ? 'Unpin' : 'Pin'} Project`}
                  icon='pin'
                  labelPosition='left'
                  color={projectPinned ? undefined : 'blue'}
                  size='small'
                  onClick={toggleProjectPin}
                />
              </div>
            </Segment>
            <Segment loading={loadingData}>
              <Grid padded='horizontally' relaxed>
                {showProjectCreated &&
                  <Grid.Row>
                    <Grid.Column width={16}>
                      <Message floating icon success>
                        <Icon name='check' />
                        <Message.Content>
                          <Message.Header>Project successfully created!</Message.Header>
                        </Message.Content>
                      </Message>
                    </Grid.Column>
                  </Grid.Row>
                }
                {showJoinComingSoon &&
                  <Grid.Row>
                    <Grid.Column width={16}>
                      <Message floating color='blue'>
                        <span><Icon name='users' /> <strong>Coming Soon: </strong> Request to join an existing project and get involved!</span>
                      </Message>
                    </Grid.Column>
                  </Grid.Row>
                }
                <Grid.Row>
                  <Grid.Column>
                    <Button.Group fluid>
                      {userProjectMember &&
                        <Button
                          color='blue'
                          loading={editModalLoading}
                          onClick={openEditInfoModal}
                        >
                          <Icon name='edit' />
                          Edit Properties
                        </Button>
                      }
                      {userProjectAdmin &&
                        <Button
                          color='violet'
                          onClick={openTeamModal}
                        >
                          <Icon name='users' />
                          Manage Team
                        </Button>
                      }
                      <Button
                        color='olive'
                        as={Link}
                        to={`${props.match.url}/timeline`}
                      >
                        <Icon name='clock outline' />
                        Timeline
                      </Button>
                      <Button
                        color='orange'
                        as={Link}
                        to={`${props.match.url}/peerreview`}
                      >
                        <Icon name='clipboard list' />
                        Peer Review
                      </Button>
                      <Button
                        color='teal'
                        as={Link}
                        to={`${props.match.url}/accessibility`}
                      >
                        <Icon name='universal access' />
                        Accessibility
                      </Button>
                      <Dropdown text='More Tools' color='purple' as={Button} className='text-center-force'>
                        <Dropdown.Menu>
                          {userProjectMember && (
                            <Dropdown.Item
                              icon={hasFlag ? (
                                <Icon.Group className='icon'>
                                  <Icon name='attention' />
                                  <Icon corner name='x' />
                                </Icon.Group>
                              ) : (
                                <Icon name='attention' />
                              )}
                              text={hasFlag ? 'Clear flag' : 'Flag Project'}
                              onClick={() => {
                                if (hasFlag) openFlagModal('clear')
                                else openFlagModal('set')
                              }}
                            />
                          )}
                          {!userProjectMember && (
                            <Dropdown.Item text={<span><em>No actions available.</em></span>} />
                          )}
                        </Dropdown.Menu>
                      </Dropdown>
                    </Button.Group>
                  </Grid.Column>
                </Grid.Row>
                {hasFlag &&
                  <Grid.Row>
                    <Grid.Column>
                      <Message color='orange' className='project-flag-message'>
                        <Message.Content>
                          <p className='project-flag-message-text'><Icon name='attention' /> This project has an active flag for <em>{getFlagGroupName(project.flag)}</em>. It can be cleared under <strong>More Tools</strong>.</p>
                          {(project.flagDescrip && !isEmptyString(project.flagDescrip)) &&
                            <div>
                              <p className='project-flag-message-text'><strong>Reason for flagging:</strong></p>
                              <div className='ui message' dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(marked(project.flagDescrip))
                              }} />
                            </div>
                          }
                        </Message.Content>
                      </Message>
                    </Grid.Column>
                  </Grid.Row>
                }
                <Grid.Row className='mb-2p'>
                  <Grid.Column>
                    <Header as='h2' dividing>Project Information</Header>
                    <Grid>
                      <Grid.Row centered>
                        <Grid.Column width={4} className='project-progress-column'>
                          <p className='text-center'><strong>Project</strong></p>
                          <ProjectProgressBar
                            progress={project.currentProgress || 0}
                            type="progress"
                            showPercent={true}
                          />
                        </Grid.Column>
                        <Grid.Column width={4} className='project-progress-column'>
                          <p className='text-center'><strong>Peer Review</strong></p>
                          <ProjectProgressBar
                            progress={project.peerProgress || 0}
                            type="peer"
                            showPercent={true}
                          />
                        </Grid.Column>
                        <Grid.Column width={4} className='project-progress-column'>
                          <p className='text-center'><strong>Accessibility</strong></p>
                          <ProjectProgressBar
                            progress={project.a11yProgress || 0}
                            type="a11y"
                            showPercent={true}
                          />
                        </Grid.Column>
                      </Grid.Row>
                      <Grid.Row columns='equal'>
                        <Grid.Column>
                          <Header as='h3' dividing>Project Properties</Header>
                          <div className='mb-1p'>
                            <Header as='span' sub>Status: </Header>
                            <span>{project.status ? capitalizeFirstLetter(project.status) : 'Loading...'}</span>
                          </div>
                          <div className='mb-1p'>
                            <Header as='span' sub>Visibility: </Header>
                            <span>{project.visibility ? capitalizeFirstLetter(project.visibility) : 'Loading...'}</span>
                          </div>
                          {(project.classification && !isEmptyString(project.classification)) &&
                            <div className='mb-1p'>
                              <Header as='span' sub>Classification: </Header>
                              <span>{getClassificationText(project.classification)}</span>
                            </div>
                          }
                          {(project.rdmpCurrentStep && !isEmptyString(project.rdmpCurrentStep)) &&
                            <div className='mb-1p'>
                              <Header as='span' sub>Construction Step: </Header>
                              <span><em>{getRoadmapStepName(project.rdmpCurrentStep)}</em></span>
                            </div>
                          }
                          {(project.libreLibrary && !isEmptyString(project.libreLibrary)) &&
                            <div className='mb-1p'>
                              <Header as='span' sub>Library: </Header>
                              <span>{getLibraryName(project.libreLibrary)}</span>
                            </div>
                          }
                          {(project.libreShelf && !isEmptyString(project.libreShelf)) &&
                            <div className='mb-1p'>
                              <Header as='span' sub>Bookshelf: </Header>
                              <span>{project.libreShelf}</span>
                            </div>
                          }
                          {(project.libreCampus && !isEmptyString(project.libreCampus)) &&
                            <div className='mb-1p'>
                              <Header as='span' sub>Campus: </Header>
                              <span>{project.libreCampus}</span>
                            </div>
                          }
                          <div className='mb-1p'>
                            <Header as='span' sub>Project Link: </Header>
                            {(project.projectURL && !isEmptyString(project.projectURL))
                              ? <a href={normalizeURL(project.projectURL)} target='_blank' rel='noopener noreferrer'>Open <Icon name='external' /></a>
                              : <span><em>Unlinked</em></span>
                            }
                          </div>
                          {(project.tags && Array.isArray(project.tags) && project.tags.length > 0) &&
                            <div>
                              <Header as='span' sub>Tags: </Header>
                              <Label.Group color='blue' className='inlineblock-display ml-1p'>
                                {project.tags.map((tag, idx) => {
                                  return (
                                    <Label key={idx}>{tag}</Label>
                                  )
                                })}
                              </Label.Group>
                            </div>
                          }
                        </Grid.Column>
                        {hasResourceInfo &&
                          <Grid.Column>
                            <Header as='h3' dividing>Source Properties</Header>
                            {(project.author && !isEmptyString(project.author)) &&
                              <div className='mb-1p'>
                                <Header as='span' sub>Author: </Header>
                                <span>{project.author}</span>
                              </div>
                            }
                            {(project.authorEmail && !isEmptyString(project.authorEmail)) &&
                              <div className='mt-1p mb-1p'>
                                <Header as='span' sub>Author Email: </Header>
                                <a href={`mailto:${project.authorEmail}`} target='_blank' rel='noopener noreferrer'>{project.authorEmail}</a>
                              </div>
                            }
                            {(project.license && !isEmptyString(project.license)) &&
                              <div className='mt-1p mb-1p'>
                                <Header as='span' sub>License: </Header>
                                <span>{getLicenseText(project.license)}</span>
                              </div>
                            }
                            {(project.resourceURL && !isEmptyString(project.resourceURL)) &&
                              <div className='mt-1p'>
                                <a href={normalizeURL(project.resourceURL)} target='_blank' rel='noopener noreferrer'>Resource Link<Icon name='external' className='ml-1p' /></a>
                              </div>
                            }
                          </Grid.Column>
                        }
                      </Grid.Row>
                      <Grid.Row columns='equal'>
                        {hasNotes &&
                          <Grid.Column>
                            <Header as='h3' dividing>Notes</Header>
                            <p
                              className='project-notes-body'
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(marked(project.notes, { breaks: true }))
                              }}
                            />
                          </Grid.Column>
                        }
                        <Grid.Column>
                          <Header as='h3' dividing>Team</Header>
                          {(Object.keys(project).length > 0) &&
                            renderTeamList(project)
                          }
                        </Grid.Column>
                      </Grid.Row>
                    </Grid>
                  </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                  {(canViewDetails && showDiscussion) &&
                    <Grid.Column>
                      <Header as='h2' dividing>
                        Discussion
                        <Button
                          compact
                          floated='right'
                          onClick={handleChangeDiscussionVis}
                        >
                          Hide
                        </Button>
                      </Header>
                      <Segment
                        size='large'
                        raised
                        className='project-discussion-segment mb-2p'
                      >
                        <ConductorMessagingUI
                          projectID={props.match.params.id}
                          user={user}
                          kind='project'
                          isProjectAdmin={userProjectAdmin}
                        />
                      </Segment>
                    </Grid.Column>
                  }
                  {(canViewDetails && !showDiscussion) &&
                    <Grid.Column>
                      <Segment
                        raised
                        clearing
                      >
                        <Header as='h2' className='project-hiddensection-heading'>Discussion</Header>
                        <Button
                          floated='right'
                          onClick={handleChangeDiscussionVis}
                        >
                          Show
                        </Button>
                      </Segment>
                    </Grid.Column>
                  }
                  {!canViewDetails &&
                    <Grid.Column>
                      <Header as='h2' dividing>Discussion</Header>
                      <Segment
                        size='large'
                        raised
                        className='mb-2p'
                      >
                        <p><em>You don't have permission to view this project's Discussion yet.</em></p>
                      </Segment>
                    </Grid.Column>
                  }
                </Grid.Row>
                <Grid.Row>
                  {canViewDetails &&
                    <Grid.Column>
                      <Header as='h2' dividing>Tasks</Header>
                      <Segment.Group size='large' raised className='mb-4p'>
                        <Segment>
                          <div className='flex-row-div'>
                            <div className='left-flex'>
                              <Search
                                input={{
                                  icon: 'search',
                                  iconPosition: 'left',
                                  placeholder: 'Search tasks...'
                                }}
                                loading={taskSearchLoading}
                                onResultSelect={(_e, { result }) => openViewTaskModal(result.id)}
                                onSearchChange={handleTaskSearch}
                                results={taskSearchResults}
                                value={taskSearchQuery}
                              />
                            </div>
                            <div className='right-flex'>
                              <Button.Group>
                                <Button
                                  color='olive'
                                  as={Link}
                                  to={`${props.match.url}/timeline`}
                                >
                                  <Icon name='clock outline' />
                                  Timeline
                                </Button>
                                <Button
                                  color='orange'
                                  onClick={expandCollapseAllTasks}
                                >
                                  <Icon name='arrows alternate vertical' />
                                  Expand/Collapse All
                                </Button>
                                <Button
                                  color='purple'
                                  disabled={!userProjectMember}
                                  onClick={openBatchModal}
                                >
                                  <Icon name='add circle' />
                                  Batch Add
                                </Button>
                                <Button
                                  color='green'
                                  loading={mngTaskLoading}
                                  onClick={() => openManageTaskModal('add')}
                                  disabled={!userProjectMember}
                                >
                                  <Icon name='add' />
                                  Add Task
                                </Button>
                              </Button.Group>

                            </div>
                          </div>
                        </Segment>
                        <Segment loading={loadingTasks} className={(projTasks.length === 0) ? 'muted-segment' : ''}>
                          {(projTasks.length > 0)
                            ? (
                              <List divided verticalAlign='middle'>
                                {projTasks.map((item, idx) => {
                                  let today = new Date();
                                  let overdueTasks = false;
                                  if (item.endDateObj && item.endDateObj instanceof Date && item.endDateObj <= today && item.status !== 'completed') {
                                    overdueTasks = true;
                                  }
                                  if (item.subtasks && Array.isArray(item.subtasks)) {
                                    item.subtasks.forEach((subtask, idx) => {
                                      if (subtask.endDateObj && subtask.endDateObj instanceof Date
                                        && subtask.endDateObj <= today && subtask.status !== 'completed') {
                                        overdueTasks = true;
                                        item.subtasks[idx].overdue = true;
                                      }
                                    });
                                  }
                                  if (overdueTasks) item.overdue = true;
                                  return (
                                    <List.Item key={item.taskID}>
                                      <div className='flex-col-div'>
                                        <div className='flex-row-div'>
                                          <div className='left-flex'>
                                            <Icon
                                              name={item.uiOpen ? 'chevron down' : 'chevron right'}
                                              className='pointer-hover'
                                              onClick={() => toggleTaskDetail(item.taskID)}
                                            />
                                            <span className='project-task-title'>
                                              {item.title}
                                            </span>
                                            {renderStatusIndicator(item.status)}
                                            {(item.hasOwnProperty('overdue') && item.overdue === true) &&
                                              <Label color='red' className='ml-2p'>OVERDUE</Label>
                                            }
                                          </div>
                                          <div className='right-flex'>
                                            <div className='task-assignees-row'>
                                              {(item.hasOwnProperty('assignees') && item.assignees.length > 0) &&
                                                (item.assignees.map((assignee, assignIdx) => {
                                                  if (assignee.uuid && assignee.firstName && assignee.lastName) {
                                                    return (
                                                      <Popup
                                                        key={assignIdx}
                                                        trigger={
                                                          <Image
                                                            className='cursor-pointer'
                                                            src={assignee.avatar || '/mini_logo.png'}
                                                            avatar
                                                            key={assignee.uuid}
                                                          />
                                                        }
                                                        header={<span><strong>{`${assignee.firstName} ${assignee.lastName}`}</strong></span>}
                                                        position='top center'
                                                      />
                                                    )
                                                  } else return null;
                                                }))
                                              }
                                            </div>
                                            <Popup
                                              content='Add Subtask'
                                              trigger={
                                                <Button
                                                  onClick={() => openManageTaskModal('add', null, item.taskID)}
                                                  icon='add'
                                                  color='green'
                                                  disabled={!userProjectMember}
                                                />
                                              }
                                              position='top center'
                                            />
                                            <Popup
                                              content='View Task'
                                              trigger={
                                                <Button
                                                  onClick={() => openViewTaskModal(item.taskID)}
                                                  icon='eye'
                                                  color='blue'
                                                />
                                              }
                                              position='top center'
                                            />
                                          </div>
                                        </div>
                                        <div className={item.uiOpen ? 'project-task-detail' : 'project-task-detail hidden'}>
                                          <List divided verticalAlign='middle'>
                                            {(item.hasOwnProperty('subtasks') && item.subtasks.length > 0)
                                              ? item.subtasks.map((subtask) => {
                                                return (
                                                  <List.Item className='project-task-subtask' key={subtask.taskID}>
                                                    <div className='flex-row-div'>
                                                      <div className='left-flex'>
                                                        <span className='project-task-title'>{subtask.title}</span>
                                                        {renderStatusIndicator(subtask.status)}
                                                        {(subtask.hasOwnProperty('overdue') && subtask.overdue === true) &&
                                                          <Label color='red' className='ml-2p'>OVERDUE</Label>
                                                        }
                                                      </div>
                                                      <div className='right-flex'>
                                                        <div className='task-assignees-row'>
                                                          {(subtask.hasOwnProperty('assignees') && subtask.assignees.length > 0) &&
                                                            (subtask.assignees.map((assignee, assignIdx) => {
                                                              if (assignee.uuid && assignee.firstName && assignee.lastName) {
                                                                return (
                                                                  <Popup
                                                                    key={assignIdx}
                                                                    trigger={
                                                                      <Image
                                                                        className='cursor-pointer'
                                                                        src={assignee.avatar || '/mini_logo.png'}
                                                                        avatar
                                                                        key={assignee.uuid}
                                                                      />
                                                                    }
                                                                    header={<span><strong>{`${assignee.firstName} ${assignee.lastName}`}</strong></span>}
                                                                    position='top center'
                                                                  />
                                                                )
                                                              } else return null;
                                                            }))
                                                          }
                                                        </div>
                                                        <Popup
                                                          content='View Subtask'
                                                          trigger={
                                                            <Button
                                                              onClick={() => openViewTaskModal(subtask.taskID)}
                                                              icon='eye'
                                                              color='blue'
                                                            />
                                                          }
                                                          position='top center'
                                                        />
                                                      </div>
                                                    </div>
                                                  </List.Item>
                                                )
                                              })
                                              : (
                                                <List.Item className='project-task-subtask'>
                                                  <p><em>No subtasks yet.</em></p>
                                                </List.Item>
                                              )
                                            }
                                          </List>
                                        </div>
                                      </div>
                                    </List.Item>
                                  )
                                })}
                              </List>
                            )
                            : (
                              <div>
                                <p className='text-center muted-text'><em>No tasks yet. Add one above!</em></p>
                              </div>
                            )
                          }
                        </Segment>
                      </Segment.Group>
                    </Grid.Column>
                  }
                  {!canViewDetails &&
                    <Grid.Column>
                      <Header as='h2' dividing>Tasks</Header>
                      <Segment
                        size='large'
                        raised
                        className='mb-2p'
                      >
                        <p><em>You don't have permission to view this project's Tasks yet.</em></p>
                      </Segment>
                    </Grid.Column>
                  }
                </Grid.Row>
              </Grid>
            </Segment>
          </Segment.Group>
          {/* Edit Project Information Modal */}
          <Modal
            open={showEditModal}
            closeOnDimmerClick={false}
            size='fullscreen'
          >
            <Modal.Header>Edit Project Properties</Modal.Header>
            <Modal.Content scrolling>
              <Form noValidate>
                <Header as='h3'>Project Properties</Header>
                <Form.Field
                  required
                  error={projTitleErr}
                >
                  <label>Project Title</label>
                  <Form.Input
                    type='text'
                    placeholder='Enter the project title...'
                    onChange={(e) => setProjTitle(e.target.value)}
                    value={projTitle}
                  />
                </Form.Field>
                <Form.Group widths='equal'>
                  <Form.Field
                    error={projProgressErr}
                  >
                    <label>Current Progress</label>
                    <Form.Input
                      name='currentProgress'
                      type='number'
                      placeholder='Enter current estimated progress...'
                      min='0'
                      max='100'
                      onChange={(e) => setProjProgress(e.target.value)}
                      value={projProgress}
                    />
                  </Form.Field>
                  <Form.Field
                    error={projPRProgressErr}
                  >
                    <label>Peer Review Progress</label>
                    <Form.Input
                      name='peerreviewprogress'
                      type='number'
                      placeholder='Enter current estimated progress...'
                      min='0'
                      max='100'
                      onChange={(e) => setProjPRProgress(e.target.value)}
                      value={projPRProgress}
                    />
                  </Form.Field>
                  <Form.Field
                    error={projA11YProgressErr}
                  >
                    <label>Accessibility Progress</label>
                    <Form.Input
                      name='a11yprogress'
                      type='number'
                      placeholder='Enter current estimated progress...'
                      min='0'
                      max='100'
                      onChange={(e) => setProjA11YProgress(e.target.value)}
                      value={projA11YProgress}
                    />
                  </Form.Field>
                </Form.Group>
                <Form.Group widths='equal'>
                  <Form.Select
                    fluid
                    label={<label>Status</label>}
                    placeholder='Status...'
                    options={statusOptions}
                    onChange={(_e, { value }) => setProjStatus(value)}
                    value={projStatus}
                  />
                  <Form.Select
                    fluid
                    label={<label>Classification</label>}
                    placeholder='Classification...'
                    options={classificationOptions}
                    onChange={(_e, { value }) => setProjClassification(value)}
                    value={projClassification}
                  />
                  <Form.Select
                    fluid
                    label={<label>Visibility</label>}
                    selection
                    options={visibilityOptions}
                    value={projVisibility}
                    onChange={(_e, { value }) => setProjVisibility(value)}
                  />
                </Form.Group>
                <Form.Field>
                  <label htmlFor='projectURL'>
                    <span className='mr-05p'>Project URL <span className='muted-text'>(if applicable)</span></span>
                    <Popup
                      trigger={<Icon name='info circle' />}
                      position='top center'
                      content={(
                        <span className='text-center'>
                          If a LibreText URL is entered, the Library, ID, and Bookshelf or Campus will be automatically retrieved.
                        </span>
                      )}
                    />
                  </label>
                  <Form.Input
                    name='projectURL'
                    type='url'
                    placeholder='Enter project URL...'
                    onChange={(e) => setProjURL(e.target.value)}
                    value={projURL}
                    id='projectURL'
                  />
                </Form.Field>
                <Form.Dropdown
                  label='Project Tags'
                  placeholder='Search tags...'
                  multiple
                  search
                  selection
                  allowAdditions
                  options={tagOptions}
                  loading={!loadedTags}
                  disabled={!loadedTags}
                  onChange={(_e, { value }) => setProjTags(value)}
                  onAddItem={(_e, { value }) => setTagOptions([{ text: value, value }, ...tagOptions])}
                  renderLabel={(tag) => ({
                    color: 'blue',
                    content: tag.text
                  })}
                  value={projTags}
                />
                <p className='mt-2p mb-2p'><em>For settings and properties related to Peer Reviews, please use the Settings tool on this project's Peer Review page.</em></p>
                <Divider />
                <Header as='h3'>Source Properties</Header>
                <p><em>Use this section if your project pertains to a particular resource or tool.</em></p>
                <Form.Group widths='equal'>
                  <Form.Field>
                    <label>Author</label>
                    <Form.Input
                      name='resourceAuthor'
                      type='text'
                      placeholder='Enter resource author name...'
                      onChange={(e) => setProjResAuthor(e.target.value)}
                      value={projResAuthor}
                    />
                  </Form.Field>
                  <Form.Field>
                    <label>Author's Email</label>
                    <Form.Input
                      name='resourceEmail'
                      type='email'
                      placeholder="Enter resource author's email..."
                      onChange={(e) => setProjResEmail(e.target.value)}
                      value={projResEmail}
                    />
                  </Form.Field>
                </Form.Group>
                <Form.Group widths='equal'>
                  <Form.Select
                    fluid
                    label='License'
                    placeholder='License...'
                    options={licenseOptions}
                    onChange={(_e, { value }) => setProjResLicense(value)}
                    value={projResLicense}
                  />
                  <Form.Field>
                    <label>Original URL</label>
                    <Form.Input
                      name='resourceURL'
                      type='url'
                      placeholder='Enter resource URL...'
                      onChange={(e) => setProjResURL(e.target.value)}
                      value={projResURL}
                    />
                  </Form.Field>
                </Form.Group>
                <Divider />
                <Header as='h3'>Additional Information</Header>
                <Form.Field>
                  <label>Notes</label>
                  <ConductorTextArea
                    placeholder='Enter additional notes here...'
                    textValue={projNotes}
                    onTextChange={(value) => setProjNotes(value)}
                    inputType='notes'
                    showSendButton={false}
                  />
                </Form.Field>
              </Form>
              <Accordion className='mt-2p' panels={[{
                key: 'danger',
                title: {
                  content: <span className='color-semanticred'><strong>Danger Zone</strong></span>
                },
                content: {
                  content: (
                    <div>
                      <p className='color-semanticred'>Use caution with the options in this area!</p>
                      <Button
                        color='red'
                        fluid
                        onClick={() => setShowDeleteProjModal(true)}
                      >
                        <Icon name='trash alternate' />
                        Delete Project
                      </Button>
                    </div>
                  )
                }
              }]} />
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeEditInfoModal}
              >
                Cancel
              </Button>
              <Button
                icon
                labelPosition='left'
                color='green'
                loading={editModalLoading}
                onClick={submitEditInfoForm}
              >
                <Icon name='save' />
                Save Changes
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Manage Team Modal */}
          <Modal
            open={showTeamModal}
            onClose={closeTeamModal}
            size='large'
            closeIcon
          >
            <Modal.Header>Manage Project Team</Modal.Header>
            <Modal.Content scrolling id='project-manage-team-content'>
              <Form noValidate>
                <Form.Select
                  search
                  label='Add Team Member'
                  placeholder='Choose or start typing to search...'
                  options={teamUserOptions}
                  onChange={(_e, { value }) => {
                    setTeamUserToAdd(value);
                  }}
                  value={teamUserToAdd}
                  loading={teamUserOptsLoading}
                  disabled={teamUserOptsLoading}
                />
                <Button
                  fluid
                  disabled={isEmptyString(teamUserToAdd)}
                  color='green'
                  loading={teamModalLoading}
                  onClick={submitAddTeamMember}
                >
                  <Icon name='add user' />
                  Add Team Member
                </Button>
              </Form>
              <Divider />
              {!teamModalLoading
                ? (Object.keys(project).length > 0 && renderTeamModalList(project))
                : <Loader active inline='centered' />
              }
            </Modal.Content>
          </Modal>
          {/* Confirm Delete Modal */}
          <Modal
            open={showDeleteProjModal}
            closeOnDimmerClick={false}
          >
            <Modal.Header>Confirm Project Deletion</Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to delete this project? <strong>This cannot be undone.</strong></p>
              <Button
                color='red'
                fluid
                loading={deleteProjModalLoading}
                onClick={submitDeleteProject}
              >
                <Icon name='trash alternate' />
                Delete Project
              </Button>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={() => setShowDeleteProjModal(false)}
              >
                Cancel
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Manage (Add/Edit) Task Modal */}
          <Modal
            open={showMngTaskModal}
            closeOnDimmerClick={false}
          >
            <Modal.Header>
              {(mngTaskSubtask && mngTaskParent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section>
                      <em>{getParentTaskName(mngTaskParent)}</em>
                    </Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    {(mngTaskMode === 'add')
                      ? (<Breadcrumb.Section active>New Subtask</Breadcrumb.Section>)
                      : (<Breadcrumb.Section active>Edit <em>{mngTaskData.title || 'Loading...'}</em></Breadcrumb.Section>)
                    }
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    {(mngTaskMode === 'add')
                      ? (<Breadcrumb.Section active>New Task</Breadcrumb.Section>)
                      : (<Breadcrumb.Section active>Edit <em>{mngTaskData.title || 'Loading...'}</em></Breadcrumb.Section>)
                    }
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content>
              {(mngTaskMode === 'add' && !mngTaskSubtask) &&
                <p><em>To add a subtask, use the add button on a task listing.</em></p>
              }
              <Form noValidate>
                <Form.Field
                  required={true}
                  error={mngTaskTitleErr}
                >
                  <label>Title</label>
                  <Input
                    type='text'
                    placeholder='Title...'
                    icon='file'
                    iconPosition='left'
                    onChange={(e) => setMngTaskTitle(e.target.value)}
                    value={mngTaskTitle}
                  />
                </Form.Field>
                <Form.Field>
                  <label>Description</label>
                  <ConductorTextArea
                    placeholder='Description...'
                    textValue={mngTaskDescrip}
                    onTextChange={(value) => setMngTaskDescrip(value)}
                    inputType='description'
                    showSendButton={false}
                  />
                </Form.Field>
                {(mngTaskMode === 'add') &&
                  <ConductorDateInput
                    value={mngTaskStartDate}
                    onChange={(value) => setMngTaskStartDate(value)}
                    label='Start Date'
                  />
                }
                {(mngTaskMode === 'add') &&
                  <ConductorDateInput
                    value={mngTaskEndDate}
                    className='mt-2p'
                    onChange={(value) => setMngTaskEndDate(value)}
                    label='End Date'
                  />
                }
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeManageTaskModal}
              >
                Cancel
              </Button>
              <Button
                color='green'
                loading={mngTaskLoading}
                onClick={submitManageTask}
              >
                <Icon name={(mngTaskMode === 'add') ? 'add' : 'save'} />
                {(mngTaskMode === 'add')
                  ? (mngTaskSubtask ? 'Add Subtask' : 'Add Task')
                  : 'Save Changes'
                }
              </Button>
            </Modal.Actions>
          </Modal>
          {/* View Task Modal */}
          <Modal
            open={showViewTaskModal}
            onClose={closeViewTaskModal}
            size='fullscreen'
            closeIcon
          >
            <Modal.Header>
              {(viewTaskData.parent && viewTaskData.parent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section
                      onClick={() => openViewTaskModal(viewTaskData.parent)}
                    >{getParentTaskName(viewTaskData.parent)}</Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active><em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em></Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>
                      <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>
                    </Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content scrolling id='task-view-content'>
              <div className='flex-col-div'>
                <div className='flex-row-div' id='project-task-header'>
                  <div className='task-detail-div'>
                    <Header sub>Status</Header>
                    <Dropdown
                      className={`compact button ${(viewTaskData.status === 'completed') ? 'green' : (viewTaskData.status === 'inprogress' ? 'blue' : 'teal')}`}
                      placeholder='Status..'
                      options={createTaskOptions}
                      value={viewTaskData.status}
                      loading={viewTaskStatusLoading}
                      onChange={submitTaskStatus}
                      disabled={!userProjectMember}
                    />
                  </div>
                  <div className='task-detail-div'>
                    <Header sub>Created</Header>
                    <div className='task-detail-textdiv'>
                      {viewTaskData.createdAtString
                        ? <p>{viewTaskData.createdAtString}</p>
                        : <p><em>Unknown</em></p>
                      }
                    </div>
                  </div>
                  <div className='task-detail-div'>
                    <Header sub>Start Date</Header>
                    {!viewTaskStartDateEdit &&
                      <div className='task-detail-textdiv'>
                        <p>
                          {viewTaskData.startDateString
                            ? viewTaskData.startDateString
                            : <em>Not set</em>
                          }
                          <Icon
                            name='pencil'
                            className={`pl-4p ${userProjectMember && 'cursor-pointer'}`}
                            onClick={() => editTaskDate('start')}
                            color='grey'
                            disabled={!userProjectMember}
                          />
                        </p>
                      </div>
                    }
                    {viewTaskStartDateEdit &&
                      <div className='task-detail-textdiv'>
                        <ConductorDateInput
                          value={viewTaskStartDateNew}
                          className='mt-2p'
                          onChange={(value) => setViewTaskStartDateNew(value)}
                        />
                        <Button
                          icon
                          className='mt-2p ml-1p'
                          onClick={() => saveTaskDate('start')}
                          color='green'
                          loading={viewTaskStartDateLoading}
                        >
                          <Icon name='save outline' />
                        </Button>
                      </div>
                    }
                  </div>
                  <div className='task-detail-div'>
                    <Header sub>End/Due Date</Header>
                    {!viewTaskEndDateEdit &&
                      <div className='task-detail-textdiv'>
                        <p>
                          {viewTaskData.endDateString
                            ? (viewTaskData.endDateObj && viewTaskData.endDateObj instanceof Date
                              && viewTaskData.endDateObj <= new Date() && viewTaskData.status !== 'completed')
                              ? <span className='color-semanticred'>{viewTaskData.endDateString}</span>
                              : viewTaskData.endDateString
                            : <em>Not set</em>
                          }
                          <Icon
                            name='pencil'
                            className={`pl-4p ${userProjectMember && 'cursor-pointer'}`}
                            onClick={() => editTaskDate('end')}
                            color='grey'
                            disabled={!userProjectMember}
                          />
                        </p>
                      </div>
                    }
                    {viewTaskEndDateEdit &&
                      <div className='task-detail-textdiv'>
                        <ConductorDateInput
                          value={viewTaskEndDateNew}
                          className='mt-2p'
                          onChange={(value) => setViewTaskEndDateNew(value)}
                        />
                        <Button
                          icon
                          className='mt-2p ml-1p'
                          onClick={() => saveTaskDate('end')}
                          color='green'
                          loading={viewTaskEndDateLoading}
                        >
                          <Icon name='save outline' />
                        </Button>
                      </div>
                    }
                  </div>
                  <div className='task-detail-div'>
                    <Header sub>Assignees</Header>
                    <div className='flex-row-div left-flex'>
                      {(viewTaskData.hasOwnProperty('assignees') && viewTaskData.assignees.length > 0) &&
                        (viewTaskData.assignees.map((item, idx) => {
                          return (
                            <Popup
                              key={idx}
                              trigger={
                                <Image
                                  className='cursor-pointer'
                                  src={item.avatar}
                                  avatar
                                  key={item.uuid}
                                  onClick={() => { openRMTAModal(`${item.firstName} ${item.lastName}`, item.uuid) }}
                                />
                              }
                              header={<span><strong>{`${item.firstName} ${item.lastName}`}</strong> <span className='color-semanticred'>(click to remove)</span></span>}
                              position='top center'
                            />
                          )
                        }))
                      }
                      <Popup
                        key='add-assignee'
                        trigger={
                          <Button
                            size='tiny'
                            circular
                            icon='add'
                            color='green'
                            onClick={() => openATAModal(viewTaskData)}
                            disabled={!userProjectMember}
                          />
                        }
                        header={<span><em>Add Assignee</em></span>}
                        position='top center'
                      />
                    </div>
                  </div>
                  <div className='task-more-div'>
                    <Dropdown
                      className='button blue'
                      floating
                      text='More'
                      direction='left'
                    >
                      <Dropdown.Menu>
                        <Dropdown.Item
                          onClick={() => openManageTaskModal('edit', viewTaskData.taskID)}
                          disabled={!userProjectMember}
                        >
                          <Icon name='edit' />
                          Edit Task
                        </Dropdown.Item>
                        <Dropdown.Item
                          onClick={() => openDeleteTaskModal(viewTaskData.taskID)}
                          disabled={!userProjectMember}
                        >
                          <Icon name='trash' />
                          Delete Task
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </div>
                </div>
                <div className='flex-row-div' id='project-task-page'>
                  <div id='task-view-left'>
                    {(viewTaskData.description && viewTaskData.description !== '') &&
                      <div className='mt-1p mb-4p'>
                        <Header as='h3' dividing>Description</Header>
                        <p dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(marked(viewTaskData.description))
                        }}></p>
                      </div>
                    }
                    <div className='mt-2p mb-4p'>
                      <div className='dividing-header-custom'>
                        <h3>Dependencies</h3>
                        <Popup
                          trigger={<Icon className='ml-05p' name='info circle' />}
                          position='top center'
                          content={<span className='text-center'>Tasks that must be completed before <em>{(viewTaskData.parent && viewTaskData.parent !== '')
                            ? `${getParentTaskName(viewTaskData.parent)} > ${viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}`
                            : `${viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}`}</em>.</span>}
                        />
                        <div className='right-flex'>
                          <Popup
                            position='top center'
                            trigger={
                              <Button
                                color='green'
                                icon
                                onClick={openATDModal}
                                loading={atdLoading}
                                disabled={!userProjectMember}
                              >
                                <Icon name='add' />
                              </Button>
                            }
                            content='Add dependencies'
                          />
                        </div>
                      </div>
                      {(viewTaskData.dependencies && Array.isArray(viewTaskData.dependencies) && viewTaskData.dependencies.length > 0)
                        ? (
                          <List divided verticalAlign='middle' className='project-task-list'>
                            {viewTaskData.dependencies.map((depend) => {
                              return (
                                <List.Item className='project-task-subtask' key={depend.taskID}>
                                  <div className='flex-row-div'>
                                    <div className='left-flex'>
                                      <span className='project-task-title'>{depend.title}</span>
                                      {renderStatusIndicator(depend.status)}
                                    </div>
                                    <div className='right-flex'>
                                      <Popup
                                        content='Remove as dependency'
                                        trigger={
                                          <Button
                                            onClick={() => openRTDModal(depend)}
                                            icon='remove circle'
                                            color='red'
                                            disabled={!userProjectMember}
                                          />
                                        }
                                        position='top center'
                                      />
                                      <Popup
                                        content='View dependency'
                                        trigger={
                                          <Button
                                            onClick={() => openViewTaskModal(depend.taskID)}
                                            icon='eye'
                                            color='blue'
                                          />
                                        }
                                        position='top center'
                                      />
                                    </div>
                                  </div>
                                </List.Item>
                              )
                            })}
                          </List>
                        )
                        : <p className='text-center muted-text mt-2p'><em>No dependencies yet. Add one above!</em></p>
                      }

                    </div>
                    {(viewTaskData.blocking && Array.isArray(viewTaskData.blocking) && viewTaskData.blocking.length > 0) &&
                      <div className='mt-4p mb-4p'>
                        <div className='dividing-header-custom'>
                          <h3>Blocking</h3>
                          <Popup
                            trigger={<Icon className='ml-05p' name='info circle' />}
                            position='top center'
                            content={<span className='text-center'><em>{(viewTaskData.parent && viewTaskData.parent !== '')
                              ? `${getParentTaskName(viewTaskData.parent)} > ${viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}`
                              : `${viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}`}</em> must be completed before these tasks.</span>}
                          />
                        </div>
                        <List divided verticalAlign='middle' className='project-task-list'>
                          {viewTaskData.blocking.map((block) => {
                            return (
                              <List.Item className='project-task-subtask' key={block.taskID}>
                                <div className='flex-row-div'>
                                  <div className='left-flex'>
                                    <span className='project-task-title'>{block.title}</span>
                                    {renderStatusIndicator(block.status)}
                                  </div>
                                  <div className='right-flex'>
                                    <Popup
                                      content='View blocked task'
                                      trigger={
                                        <Button
                                          onClick={() => openViewTaskModal(block.taskID)}
                                          icon='eye'
                                          color='blue'
                                        />
                                      }
                                      position='top center'
                                    />
                                  </div>
                                </div>
                              </List.Item>
                            )
                          })}
                        </List>
                      </div>
                    }
                    {(viewTaskData.parent === undefined || viewTaskData.parent === '' || viewTaskData.parent === null) &&
                      <div className='mt-4p mb-4p'>
                        <div className='dividing-header-custom'>
                          <h3>Subtasks</h3>
                          <div className='right-flex'>
                            <Popup
                              position='top center'
                              trigger={
                                <Button
                                  color='green'
                                  icon
                                  onClick={() => openManageTaskModal('add', null, viewTaskData.taskID)}
                                  disabled={!userProjectMember}
                                >
                                  <Icon name='add' />
                                </Button>
                              }
                              content='Add subtask'
                            />
                          </div>
                        </div>
                        {(viewTaskData.hasOwnProperty('subtasks') && viewTaskData.subtasks.length > 0)
                          ? (
                            <List divided verticalAlign='middle' className='project-task-list'>
                              {viewTaskData.subtasks.map((subtask) => {
                                return (
                                  <List.Item className='project-task-subtask' key={subtask.taskID}>
                                    <div className='flex-row-div'>
                                      <div className='left-flex'>
                                        <span className='project-task-title'>{subtask.title}</span>
                                        {renderStatusIndicator(subtask.status)}
                                      </div>
                                      <div className='right-flex'>
                                        <Popup
                                          content='View subtask'
                                          trigger={
                                            <Button
                                              onClick={() => openViewTaskModal(subtask.taskID)}
                                              icon='eye'
                                              color='blue'
                                            />
                                          }
                                          position='top center'
                                        />
                                      </div>
                                    </div>
                                  </List.Item>
                                )
                              })}
                            </List>
                          )
                          : (<p className='text-center muted-text mt-2p'><em>No subtasks yet. Add one above!</em></p>)
                        }
                      </div>
                    }
                  </div>
                  <div id='task-view-right'>
                    <div id='task-view-chat'>
                      <ConductorChatUI
                        projectID={props.match.params.id}
                        user={user}
                        mode='standalone'
                        kind='task'
                        activeThread={viewTaskData.taskID}
                        activeThreadTitle={viewTaskData.title}
                        activeThreadMsgs={viewTaskMsgs}
                        loadedThreadMsgs={viewTaskLoadedMsgs}
                        getMessages={getTaskMessages}
                        isProjectAdmin={userProjectAdmin}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Modal.Content>
          </Modal>
          {/* Add Task Assignee Modal */}
          <Modal
            open={showATAModal}
            onClose={closeATAModal}
          >
            <Modal.Header>
              {(viewTaskData.parent && viewTaskData.parent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section
                      onClick={() => openViewTaskModal(viewTaskData.parent)}
                    >{getParentTaskName(viewTaskData.parent)}</Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active><em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Add Assignee</Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>
                      <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Add Assignee
                    </Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content scrolling className='modal-tall-content'>
              <p>Select a user to assign to <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>.</p>
              <Dropdown
                placeholder='Select assignee or start typing to search......'
                search
                fluid
                selection
                loading={ataLoading}
                options={ataUsers}
                error={ataError}
                value={ataUUID}
                onChange={(_e, { value }) => setATAUUID(value)}
                className={(!viewTaskData.parent || viewTaskData.parent === '') ? 'mb-2p' : 'mb-4p'}
              />
              {(!viewTaskData.parent || viewTaskData.parent === '') &&
                <Checkbox
                  toggle
                  checked={ataSubtasks}
                  onChange={(_e, data) => setATASubtasks(data.checked)}
                  label='Assign to all subtasks'
                  className='mb-2p'
                />
              }
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeATAModal}
              >
                Cancel
              </Button>
              <Button
                color='green'
                loading={ataLoading}
                onClick={submitAddTaskAssignee}
              >
                <Icon name='add' />
                Add Assignee
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Remove Task Assignee Modal */}
          <Modal
            open={showRMTAModal}
            onClose={closeRMTAModal}
          >
            <Modal.Header>
              {(viewTaskData.parent && viewTaskData.parent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section
                      onClick={() => openViewTaskModal(viewTaskData.parent)}
                    >{getParentTaskName(viewTaskData.parent)}</Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active><em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Remove Assignee</Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>
                      <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Remove Assignee
                    </Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to remove <strong>{rmtaName}</strong> as an assignee for <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>?</p>
              {(!viewTaskData.parent || viewTaskData.parent === '') &&
                <Checkbox
                  toggle
                  checked={rmtaSubtasks}
                  onChange={(_e, data) => setRMTASubtasks(data.checked)}
                  label='Remove from all subtasks'
                />
              }
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeRMTAModal}
              >
                Cancel
              </Button>
              <Button
                loading={rmtaLoading}
                color='red'
                onClick={submitRemoveTaskAssignee}
              >
                <Icon name='remove circle' />
                Remove Assignee
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Add Task Dependency Modal */}
          <Modal
            open={showATDModal}
            onClose={closeATDModal}
          >
            <Modal.Header>
              {(viewTaskData.parent && viewTaskData.parent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section
                      onClick={() => openViewTaskModal(viewTaskData.parent)}
                    >{getParentTaskName(viewTaskData.parent)}</Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active><em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Add Dependency</Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>
                      <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Add Dependency
                    </Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content scrolling className='modal-tall-content'>
              <p>Select a task to add as a dependency for <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>.</p>
              <Dropdown
                placeholder='Select task or start typing to search...'
                search
                fluid
                selection
                loading={atdLoading}
                options={atdTasks}
                error={atdError}
                value={atdTaskID}
                onChange={(_e, { value }) => setATDTaskID(value)}
                className='mb-4p'
              />
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={closeATDModal}>Cancel</Button>
              <Button
                color='green'
                loading={atdLoading}
                onClick={submitAddTaskDependency}
              >
                <Icon name='add' /> Add Dependency
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Remove Task Dependency Modal */}
          <Modal
            open={showRTDModal}
            onClose={closeRTDModal}
          >
            <Modal.Header>
              {(viewTaskData.parent && viewTaskData.parent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section
                      onClick={() => openViewTaskModal(viewTaskData.parent)}
                    >{getParentTaskName(viewTaskData.parent)}</Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active><em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Remove Dependency</Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>
                      <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>: Remove Dependency
                    </Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to remove <em>{rtdTaskTitle}</em> as a dependency of <em>{viewTaskData.hasOwnProperty('title') ? viewTaskData.title : 'Loading...'}</em>?</p>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeRTDModal}
              >
                Cancel
              </Button>
              <Button
                loading={rtdLoading}
                color='red'
                onClick={submitRemoveTaskDependency}
              >
                <Icon name='remove circle' />
                Remove Dependency
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Delete Task Modal */}
          <Modal
            open={showDelTaskModal}
            onClose={closeDeleteTaskModal}
          >
            <Modal.Header>
              {(delTaskSubtask && delTaskParent !== '')
                ? (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section>
                      <em>{getParentTaskName(delTaskParent)}</em>
                    </Breadcrumb.Section>
                    <Breadcrumb.Divider icon='right chevron' />
                    <Breadcrumb.Section active>Delete <em>{delTaskData.title || 'Loading...'}</em></Breadcrumb.Section>
                  </Breadcrumb>
                )
                : (
                  <Breadcrumb className='task-view-header-crumbs'>
                    <Breadcrumb.Section active>Delete <em>{delTaskData.title || 'Loading...'}</em></Breadcrumb.Section>
                  </Breadcrumb>
                )
              }
            </Modal.Header>
            <Modal.Content>
              <p>Are you sure you want to delete the <strong>{delTaskData.title}</strong> <span className='muted-text'>(ID: {delTaskData.taskID})</span> task?</p>
              {delTaskHasSubtasks &&
                <p className='text-center'><strong>All subtasks will also be deleted!</strong></p>
              }
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeDeleteTaskModal}
              >
                Cancel
              </Button>
              <Button
                color='red'
                loading={delTaskLoading}
                onClick={submitDeleteTask}
              >
                <Icon name='trash' />
                Delete
                {(delTaskSubtask ? ' Subtask' : ' Task')}
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Batch Task Add Modal */}
          <Modal
            open={showBatchModal}
            onClose={closeBatchModal}
          >
            <Modal.Header>Batch Add Tasks</Modal.Header>
            <Modal.Content>
              <Form noValidate>
                <Form.Field error={batchTasksErr}>
                  <label>Number of Tasks to Add</label>
                  <Input
                    type='number'
                    placeholder='Number...'
                    min={1}
                    max={100}
                    onChange={(_e, { value }) => setBatchTasks(value)}
                    value={batchTasks}
                  />
                </Form.Field>
                <Form.Field error={batchTitleErr}>
                  <label>Task Title Prefix</label>
                  <Input
                    type='text'
                    placeholder='Title prefix...'
                    onChange={(_e, { value }) => setBatchTitle(value)}
                    value={batchTitle}
                  />
                </Form.Field>
                <p><strong>Example: </strong><em>{(batchTitle !== '') ? batchTitle : '<Title prefix>'} 1</em></p>
                <Form.Field>
                  <Checkbox
                    toggle
                    label='Add Subtasks to Each'
                    onChange={(_e, data) => setBatchAddSubtasks(data.checked)}
                    checked={batchAddSubtasks}
                  />
                </Form.Field>
                {batchAddSubtasks &&
                  <div>
                    <Form.Field error={batchSubtasksErr}>
                      <label>Number of Subtasks to Add to Each</label>
                      <Input
                        type='number'
                        placeholder='Number...'
                        min={1}
                        max={100}
                        onChange={(_e, { value }) => setBatchSubtasks(value)}
                        value={batchSubtasks}
                      />
                    </Form.Field>
                    <Form.Field error={batchSubtitleErr}>
                      <label>Subtask Title Prefix</label>
                      <Input
                        type='text'
                        placeholder='Title prefix...'
                        onChange={(_e, { value }) => setBatchSubtitle(value)}
                        value={batchSubtitle}
                      />
                    </Form.Field>
                    <p><strong>Example: </strong><em>{(batchSubtitle !== '') ? batchSubtitle : '<Subtitle prefix>'} 1.1</em></p>
                  </div>
                }
              </Form>
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeBatchModal}
              >
                Cancel
              </Button>
              <Button
                color='green'
                loading={batchAddLoading}
                onClick={submitBatchAdd}
              >
                <Icon name='add' />
                Add Tasks
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Flag/Clear Flag Project Modal */}
          <Modal
            open={showFlagModal}
            onClose={closeFlagModal}
          >
            <Modal.Header>{flagMode === 'set' ? 'Flag Project' : 'Clear Project Flag'}</Modal.Header>
            <Modal.Content scrolling>
              {flagMode === 'set'
                ? (
                  <div>
                    <p>Flagging a project sends an email notification to the selected user and places it in their Flagged Projects list for review. Please place a description of the reason for flagging in the text box below.</p>
                    <Dropdown
                      placeholder='Flag Option...'
                      fluid
                      selection
                      options={[{
                        key: 'libretexts',
                        text: 'LibreTexts Administrators',
                        value: 'libretexts'
                      }, {
                        key: 'campusadmin',
                        text: 'Campus Administrator',
                        value: 'campusadmin'
                      }, {
                        key: 'liaison',
                        text: 'Project Liaison(s)',
                        value: 'liaison',
                        disabled: (!project.liaisons || (Array.isArray(project.liaisons) && project.liaisons.length === 0))
                      }, {
                        key: 'lead',
                        text: 'Project Lead(s)',
                        value: 'lead'
                      }]}
                      value={flagOption}
                      onChange={(e, { value }) => setFlagOption(value)}
                      error={flagOptionErr}
                      className='mb-2p'
                    />
                    <ConductorTextArea
                      placeholder='Describe the reason for flagging...'
                      textValue={flagDescrip}
                      onTextChange={(value) => setFlagDescrip(value)}
                      inputType='description'
                      showSendButton={false}
                    />
                  </div>
                )
                : (<p>Are you sure you want to clear this project's flag?</p>)
              }
            </Modal.Content>
            <Modal.Actions>
              <Button
                onClick={closeFlagModal}
              >
                Cancel
              </Button>
              <Button
                color='orange'
                loading={flagLoading}
                onClick={submitFlagProject}
              >
                {flagMode === 'set'
                  ? <Icon name='attention' />
                  : <Icon name='x' />
                }
                {flagMode === 'set'
                  ? 'Flag Project'
                  : 'Clear Flag'
                }
              </Button>
            </Modal.Actions>
          </Modal>
          {/* Project Pinned Modal */}
          <Modal open={showPinnedModal} onClose={closePinnedModal}>
            <Modal.Header>{pinnedModalDidPin ? 'Pinned Project' : 'Unpinned Project'}</Modal.Header>
            <Modal.Content>
              {pinnedModalDidPin ? (
                <p>Successfully added <em>{project.title}</em> to your Pinned Projects! Access it in one click from Home.</p>
              ) : (
                <p>Successfully removed <em>{project.title}</em> from your Pinned Projects.</p>
              )}
            </Modal.Content>
            <Modal.Actions>
              <Button onClick={closePinnedModal} color='blue'>Done</Button>
            </Modal.Actions>
          </Modal>
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );

};

export default ProjectView;
