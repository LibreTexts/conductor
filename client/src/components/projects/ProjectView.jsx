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
import { useEffect, useState, useCallback, lazy, Suspense, useMemo } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

import FilesManager from '../FilesManager/FilesManager';
import FileIcon from '../FileIcon';
import ProjectProgressBar from './ProjectProgressBar';
import TextArea from '../TextArea';
import Messaging from '../Messaging';
import Chat from '../Chat';
import DateInput from '../DateInput/index.tsx';
import ReaderResourcesManager from '../../components/ReaderResourcesManager/ReaderResourcesManager';
import RenderProjectModules from './RenderProjectModules';
import { MentionsInput, Mention } from 'react-mentions'
import Breakpoint from '../util/Breakpoints';

import {
  isEmptyString,
  capitalizeFirstLetter,
  normalizeURL,
  truncateString,
  sortUsersByName,
  setsEqual,
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
  getTaskStatusText,
  getClassificationText,
  getFlagGroupName,
  constructProjectTeam,
  checkCanViewProjectDetails,
  checkProjectAdminPermission,
  checkProjectMemberPermission,
  PROJECT_ROLE_SORT_ORDER
} from '../util/ProjectHelpers';
import {
  getRoadmapStepName
} from '../util/RoadmapOptions.jsx';

import useGlobalError from '../error/ErrorHooks';
import LoadingSpinner from '../LoadingSpinner';
import FlagProjectModal from './FlagProjectModal';
import BatchTaskAddModal from './TaskComponents/BatchTaskAddModal';
import DeleteTaskModal from './TaskComponents/DeleteTaskModal';
import RemoveTaskDepedencyModal from './TaskComponents/RemoveTaskDependencyModal';
import AddTaskDependencyModal from './TaskComponents/AddTaskDependencyModal';
import RemoveTaskAssigneeModal from './TaskComponents/RemoveTaskAssigneeModal';
import AddTaskAssigneeModal from './TaskComponents/AddTaskAssigneeModal';
import ViewTaskModal from './TaskComponents/ViewTaskModal';
import AssignAllModal from './TaskComponents/AssignAllModal';
import { buildLibraryPageGoURL } from '../../utils/projectHelpers';
import ProjectLinkButtons from './ProjectLinkButtons';
import { useModals } from '../../context/ModalContext';
import RequestToPublishModal from './RequestToPublishModal';
const ProjectPropertiesModal = lazy(() => import('./ProjectPropertiesModal'));
const ManageTeamModal = lazy(() => import('./ManageTeamModal'));

const ProjectView = (props) => {

  // Global State and Eror Handling
  const { handleGlobalError } = useGlobalError();
  const { openModal, closeAllModals } = useModals();
  const user = useSelector((state) => state.user);

  // UI
  const [loadingData, setLoadingData] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showProjectCreated, setShowProjectCreated] = useState(false);
  const [showReviewerCrumb, setShowReviewerCrumb] = useState(false);
  const [showJoinComingSoon, setShowJoinComingSoon] = useState(false);
  const [showAllTeamMembers, setShowAllTeamMembers] = useState(false);

  // Project Data
  const [projectID, setProjectID] = useState('');
  const [project, setProject] = useState({});
  const [projectPinned, setProjectPinned] = useState(false);

  // Project Permissions
  const [canViewDetails, setCanViewDetails] = useState(false);
  const [userProjectAdmin, setUserProjectAdmin] = useState(false);
  const [userProjectMember, setUserProjectMember] = useState(false);

  // Edit Information Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [projTitle, setProjTitle] = useState('');

  // Project Pin Modal
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [pinnedModalDidPin, setPinnedModalDidPin] = useState(true);

  // Manage Team Modal
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);

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

  // Assign All to Task Modal
  const [showAssignAllModal, setShowAssignAllModal] = useState(false);
  const [assignAllLoading, setAssignAllLoading] = useState(false);
  const [assignAllError, setAssignAllError] = useState(false);
  const [assignAllSubtasks, setAssignAllSubtasks] = useState(false);

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

  // Manage Reader Resources Modal
  const [showReaderResourcesModal, setShowReaderResourcesModal] = useState(false);


  /**
   * Set page title and load Project information on initial load.
   */
  useEffect(() => {
    setProjectID(props.match.params.id);
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
  }, [props.location.search, setShowProjectCreated, setShowReviewerCrumb]);


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
      const adminPermissions = checkProjectAdminPermission(project, user);
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
    setShowEditModal(true);
  };


  /**
   * Closes the Edit Information Modal and resets all
   * fields to their default values.
   */
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    getProject();
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
   * Opens the Manage Team Modal and sets the fields to their
   * default values, then triggers the function to retrieve the list of
   * addable users.
   */
  const openTeamModal = () => {
    setShowManageTeamModal(true);
  };


  /**
   * Closes the Manage Team Modal and resets the fields
   * to their default values.
   */
  const closeTeamModal = () => {
    setShowManageTeamModal(false);
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

  const submitAssignAllMembersToTask = async () => {
    try {
      setAssignAllError(false);
      if (!viewTaskData || !viewTaskData.taskID || isEmptyString(viewTaskData.taskID)) {
        setAssignAllError(false);
        return;
      }

      setAssignAllLoading(true);
      const assignAllRes = await axios.put("/project/task/assignees/add-all", {
        projectID: props.match.params.id,
        taskID: viewTaskData.taskID,
        subtasks: assignAllSubtasks,
      });

      if (!assignAllRes.data.err) {
        getProjectTasks();
        setShowAssignAllModal(false);
        setAssignAllSubtasks(false);
        setAssignAllError(false);
        closeViewTaskModal();
      } else {
        handleGlobalError(assignAllRes.data.errMsg);
      }
    } catch (err) {
      handleGlobalError(err);
    } finally {
      setAssignAllLoading(false);
    }
  };

  const handleCloseAssignAllModal = () => {
    setShowAssignAllModal(false);
    setAssignAllSubtasks(false);
    setAssignAllError(false);
  }

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

  /**
   * Sets the Manage Reader Resources modal to open in state.
   */
  function handleOpenReaderResourcesModal() {
    setShowReaderResourcesModal(true);
  }

  /**
   * Sets the Manage Reader Resources modal to closed in state.
   */
  function handleCloseReaderResourcesModal() {
    setShowReaderResourcesModal(false);
  }

  function handleOpenRequestToPublishModal() {
    if(!project.projectID) return;
    openModal(
      <RequestToPublishModal
        projectID={project.projectID}
        onClose={() => {
          closeAllModals();
          getProject();
        }}
      />
    );
  }

  // Rendering Helper Booleans
  const hasResourceInfo = project.author || project.license?.sourceURL || project.license?.licenseName;
  const hasNotes = project.notes && !isEmptyString(project.notes);
  const hasFlag = project.flag && !isEmptyString(project.flag);
  const flagCrumbEnabled = hasFlag && showReviewerCrumb;
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

  const BookCreatedLabel = () => {
    return (
      <Label basic color='green' className='!mb-4 cursor-pointer' onClick={() => window.open(buildLibraryPageGoURL(project.libreLibrary, project.libreCoverID))}>Book created <Icon name='external' className='!ml-1'/></Label>
    )
  }

  const renderTeamList = (projData, showAll) => {
    const transformMembers = (role, roleDisplay) => (item) => ({
      ...item,
      name: `${item.firstName} ${item.lastName}`,
      role,
      roleDisplay,
    });

    const allTeamMembers = [
      ...projData.leads.map(transformMembers('lead', 'Lead')),
      ...projData.liaisons.map(transformMembers('liaison', 'Liaison')),
      ...projData.members.map(transformMembers('member', 'Member')),
      ...projData.auditors.map(transformMembers('auditor', 'Auditor')),
    ];
    allTeamMembers.sort((a, b) => {
      if (PROJECT_ROLE_SORT_ORDER[a.role] < PROJECT_ROLE_SORT_ORDER[b.role]) {
        return -1;
      }
      if (PROJECT_ROLE_SORT_ORDER[a.role] > PROJECT_ROLE_SORT_ORDER[b.role]) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });

    const moreThanFive = allTeamMembers.length > 5;
    const teamToDisplay = (!showAll && moreThanFive) ? allTeamMembers.slice(0, 5): allTeamMembers;

    const renderListItem = (item, idx) => {
      return (
        <List.Item key={`${item.role}-${idx}`}>
          <Image avatar src={item.avatar} />
          <List.Content>
            {item.firstName} {item.lastName}{" "}
            <span className="muted-text">({item.roleDisplay})</span>
          </List.Content>
        </List.Item>
      );
    };

    return (
      <List divided verticalAlign="middle">
        {teamToDisplay.map((item, idx) => renderListItem(item, idx))}
        {!showAll && moreThanFive && (
          <List.Item key="collapsed-msg">
            <List.Content className="text-center">
              <p className="muted-text mt-1p">
                Team list collapsed for brevity.{" "}
                <a onClick={() => setShowAllTeamMembers(!showAllTeamMembers)}>
                  Click to show all...
                </a>
              </p>
            </List.Content>
          </List.Item>
        )}
        {showAll && moreThanFive && (
          <List.Item key="showing-all-msg">
            <List.Content className="text-center">
              <p className="muted-text mt-1p">
                Showing all team members.{" "}
                <a onClick={() => setShowAllTeamMembers(!showAllTeamMembers)}>
                  Click to collapse...
                </a>
              </p>
            </List.Content>
          </List.Item>
        )}
      </List>
    );
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
                          onClick={openEditInfoModal}
                          aria-label='Edit Properties'
                        >
                          <Icon name='edit' />
                          <Breakpoint name='desktop'>
                          Edit Properties
                          </Breakpoint>
                        </Button>
                      }
                      {userProjectAdmin &&
                        <Button
                          color='violet'
                          onClick={openTeamModal}
                          aria-label='Manage Team'
                        >
                          <Icon name='users' />
                          <Breakpoint name='desktop'>
                          Manage Team
                          </Breakpoint>
                        </Button>
                      }
                      {
                        project.libreLibrary && project.libreCoverID && (
                          <Button
                          as={Link}
                          color='pink'
                          to={`/projects/${project.projectID}/ai-co-author`}
                          aria-label='Textbook Curation'
                        >
                          <Icon name='magic' />
                          <Breakpoint name='desktop'>
                          AI Co-Author
                          </Breakpoint>
                        </Button>
                        )
                      }
                      <Button
                        color='olive'
                        as={Link}
                        to={`${props.match.url}/timeline`}
                        aria-label='Timeline'
                      >
                        <Icon name='clock outline' />
                        <Breakpoint name='desktop'>
                        Timeline
                        </Breakpoint>
                      </Button>
                      <Button
                        color='orange'
                        as={Link}
                        to={`${props.match.url}/peerreview`}
                        aria-label='Peer Review'
                      >
                        <Icon name='clipboard list' />
                        <Breakpoint name='desktop'>
                          Peer Review
                        </Breakpoint>
                      </Button>
                      <Button
                        color='teal'
                        as={Link}
                        to={`${props.match.url}/accessibility`}
                        aria-label='Accessibility'
                      >
                        <Icon name='universal access' />
                        <Breakpoint name='desktop'>
                        Accessibility
                        </Breakpoint>
                      </Button>
                      <Dropdown text='More Tools' color='purple' as={Button} className='text-center-force'>
                        <Dropdown.Menu>
                          {userProjectMember && (
                            <>
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
                            </>
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
                              <div className='ui message prose prose-code:before:hidden prose-code:after:hidden' dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(marked(project.flagDescrip))
                              }} />
                            </div>
                          }
                        </Message.Content>
                      </Message>
                    </Grid.Column>
                  </Grid.Row>
                }
                <Grid.Row className='mb-2p mt-2'>
                  <Grid.Column>
                    <Grid>
                      <Grid.Row columns='equal'>
                        <Grid.Column>
                          <Header as='h2' dividing>Project Properties</Header>
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
                          {(Array.isArray(project.cidDescriptors) && project.cidDescriptors.length > 0) && (
                            <div className="mb-1p">
                              <Header as="span" sub>C-ID(s): </Header>
                              <Label.Group className="inlineblock-display ml-1p">
                                {project.cidDescriptors.map((cid) => (
                                  <Label key={cid}>{cid}</Label>
                                ))}
                              </Label.Group>
                            </div>
                          )}
                          {(project.tags && Array.isArray(project.tags) && project.tags.length > 0) &&
                            <div>
                              <Header as='span' sub>Tags: </Header>
                              <Label.Group className='inlineblock-display ml-1p'>
                                {project.tags.map((tag, idx) => {
                                  return (
                                    <Label key={idx}>{tag}</Label>
                                  )
                                })}
                              </Label.Group>
                            </div>
                          }
                          <ProjectLinkButtons projectID={project.projectID} libreCoverID={project.libreCoverID} libreLibrary={project.libreLibrary} projectLink={project.projectURL} projectTitle={project.title} didCreateWorkbench={project.didCreateWorkbench} hasCommonsBook={project.hasCommonsBook} projectVisibility={project.visibility} project={project}/>
                          {(project.adaptCourseID && project.adaptCourseID !== '') && (
                            <div className="mt-1e">
                              <a
                                href={`https://adapt.libretexts.org/instructors/courses/${project.adaptCourseID}/assignments`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View Course on ADAPT <Icon name="external" />
                              </a>
                            </div>
                          )}
                          {canViewDetails&& (
                            <div className="mt-8 flex flex-col">
                              <Header as='span' sub>Important Tools: </Header>
                              {
                                project.hasCommonsBook && (
                                  <Button
                                    color="blue"
                                    compact
                                    onClick={handleOpenReaderResourcesModal}
                                    className='!w-64'
                                  >
                                    Manage Reader Resources
                                  </Button>
                              )}
                              {
                                !project.hasCommonsBook && project.didCreateWorkbench && (
                                  <Button
                                    color='blue'
                                    compact
                                    onClick={handleOpenRequestToPublishModal}
                                    className='!w-64'
                                    disabled={project.didRequestPublish}
                                  >
                                    {project.didRequestPublish ? 'Publishing Requested' : 'Request to Publish'}
                                  </Button>
                                )
                              }
                            </div>
                          )}
                        </Grid.Column>
                        {hasResourceInfo &&
                          <Grid.Column>
                            <Header as='h2' dividing>Source Properties</Header>
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
                            {project.license && project.license.name &&
                              <div className='mt-1p mb-1p'>
                                <Header as='span' sub>License: </Header>
                                <span>{project.license.name ?? 'Unknown License'} {project.license.version ?? ""}</span>
                              </div>
                            }
                            {project.license && project.license.sourceURL &&
                              <div className='mt-1p'>
                                <a href={normalizeURL(project.license.sourceURL)} target='_blank' rel='noopener noreferrer'>Resource Link<Icon name='external' className='ml-1p' /></a>
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
                              className='project-notes-body prose prose-code:before:hidden prose-code:after:hidden max-w-full'
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(marked(project.notes, { breaks: true }))
                              }}
                            />
                          </Grid.Column>
                        }
                        <Grid.Column>
                          <Header as='h3' dividing>Team</Header>
                          {(Object.keys(project).length > 0) &&
                            renderTeamList(project, showAllTeamMembers)
                          }
                        </Grid.Column>
                      </Grid.Row>
                    </Grid>
                  </Grid.Column>
                </Grid.Row>
                <RenderProjectModules
                  projectID={projectID}
                  project={project}
                  url={props.match.url}
                  canViewDetails={canViewDetails}
                  userProjectAdmin={userProjectAdmin}
                  userProjectMember={userProjectMember}
                  user={user}
                  projTasks={projTasks}
                  taskSearchLoading={taskSearchLoading}
                  taskSearchResults={taskSearchResults}
                  taskSearchQuery={taskSearchQuery}
                  handleTaskSearch={handleTaskSearch}
                  openViewTaskModal={openViewTaskModal}
                  expandCollapseAllTasks={expandCollapseAllTasks}
                  openBatchModal={openBatchModal}
                  openManageTaskModal={openManageTaskModal}
                  openDeleteTaskModal={openDeleteTaskModal}
                  renderStatusIndicator={renderStatusIndicator}
                  toggleTaskDetail={toggleTaskDetail}
                  loadingTasks={loadingTasks}
                  defaultNotificationSetting={project.defaultChatNotification}
                  mngTaskLoading={mngTaskLoading}
                  libreLibrary={project.libreLibrary}
                  libreCoverID={project.libreCoverID}
                />                
              </Grid>
            </Segment>
          </Segment.Group>
          {/* Edit Project Modal */}
          <ProjectPropertiesModal show={showEditModal} projectID={projectID} onClose={() => handleCloseEditModal()}/>
          {/* Manage Team Modal */}
          <Suspense fallback={<LoadingSpinner/>}>
            <ManageTeamModal show={showManageTeamModal} project={project} onDataChanged={getProject} onClose={closeTeamModal} />
          </Suspense>
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
                  <TextArea
                    placeholder='Description...'
                    textValue={mngTaskDescrip}
                    onTextChange={(value) => setMngTaskDescrip(value)}
                    contentType='description'
                  />
                </Form.Field>
                {(mngTaskMode === 'add') &&
                <Form.Field inline>
                  <DateInput
                    value={mngTaskStartDate}
                    onChange={(value) => setMngTaskStartDate(value)}
                    label='Start Date'
                    inlineLabel={false}
                  />
                  </Form.Field>
                }
                {(mngTaskMode === 'add') &&
                <Form.Field inline>
                  <DateInput
                    value={mngTaskEndDate}
                    className='mt-2p'
                    onChange={(value) => setMngTaskEndDate(value)}
                    label='End Date'
                  />
                  </Form.Field>
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
          <ViewTaskModal
          show={showViewTaskModal}
          user={user}
          projectID={props.match.params.id}
          viewTaskData={viewTaskData}
          viewTaskStatusLoading={viewTaskStatusLoading}
          viewTaskMsgs={viewTaskMsgs}
          viewTaskLoadedMsgs={viewTaskLoadedMsgs}
          viewTaskStartDateEdit={viewTaskStartDateEdit}
          viewTaskEndDateEdit={viewTaskEndDateEdit}
          viewTaskStartDateLoading={viewTaskStartDateLoading}
          viewTaskEndDateLoading={viewTaskEndDateLoading}
          viewTaskStartDateNew={viewTaskStartDateNew}
          viewTaskEndDateNew={viewTaskEndDateNew}
          createTaskOptions={createTaskOptions}
          userProjectAdmin={userProjectAdmin}
          userProjectMember={userProjectMember}
          setViewTaskStartDateNew={(newVal) =>setViewTaskStartDateNew(newVal)}
          setViewTaskEndDateNew={(newVal) => setViewTaskEndDateNew(newVal)}
          editTaskDate={editTaskDate}
          openViewTaskModal={(id) => openViewTaskModal(id)}
          openDeleteTaskModal={(id) => openDeleteTaskModal(id)}
          openATAModal={(task) => openATAModal(task)}
          openATDModal={() => openATDModal()}
          openRTDModal={(depend) => openRTDModal(depend)}
          openRMTAModal={(name, uuid) => openRMTAModal(name, uuid)}
          openManageTaskModal={(mode, taskID, parent) => openManageTaskModal(mode, taskID, parent)}
          openAssignAllModal={() => setShowAssignAllModal(true)}
          atdLoading={atdLoading}
          getTaskMessages={getTaskMessages}
          getParentTaskName={(id) => getParentTaskName(id)}
          submitTaskStatus={(e, data) => submitTaskStatus(e, data)}
          saveTaskDate={(type) => saveTaskDate(type)}
          renderStatusIndicator={renderStatusIndicator}
          onClose={closeViewTaskModal}
          />
          {/* Add Task Assignee Modal */}
          <AddTaskAssigneeModal
          show={showATAModal}
          viewTaskData={viewTaskData}
          ataUsers={ataUsers}
          ataLoading={ataLoading}
          ataError={ataError}
          ataUUID={ataUUID}
          ataSubtasks={ataSubtasks}
          setATASubtasks={(newVal) => setATASubtasks(newVal)}
          setATAUUID={(newVal) => setATAUUID(newVal)}
          openViewTaskModal={(id) => openViewTaskModal(id)}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestAdd={submitAddTaskAssignee}
          onClose={closeATAModal}
          />
          <AssignAllModal 
          show={showAssignAllModal}
          viewTaskData={viewTaskData}
          assignAllError={assignAllError}
          assignAllLoading={assignAllLoading}
          assignAllSubtasks={assignAllSubtasks}
          setAssignAllSubtasks={(newVal) => setAssignAllSubtasks(newVal)}
          openViewTaskModal={(id) => openViewTaskModal(id)}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestAssignAll={submitAssignAllMembersToTask}
          onClose={handleCloseAssignAllModal}
          />
          {/* Remove Task Assignee Modal */}
          <RemoveTaskAssigneeModal 
          show={showRMTAModal}
          viewTaskData={viewTaskData}
          rmtaName={rmtaName}
          rmtaLoading={rmtaLoading}
          rmtaSubtasks={rmtaSubtasks}
          setRMTASubtasks={(newVal) => setRMTASubtasks(newVal)}
          openViewTaskModal={(id) => openViewTaskModal(id)}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestRemove={submitRemoveTaskAssignee}
          onClose={closeRMTAModal}
          />
          {/* Add Task Dependency Modal */}
          <AddTaskDependencyModal 
          show={showATDModal}
          viewTaskData={viewTaskData}
          atdTasks={atdTasks}
          atdLoading={atdLoading}
          atdError={atdError}
          atdTaskID={atdTaskID}
          setATDTaskID={(newVal) => setATDTaskID(newVal)}
          openViewTaskModal={(id) => openViewTaskModal}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestAdd={submitAddTaskDependency}
          onClose={closeATDModal}
          />
          {/* Remove Task Dependency Modal */}
          <RemoveTaskDepedencyModal 
          show={showRTDModal}
          viewTaskData={viewTaskData}
          rtdLoading={rtdLoading}
          rtdTaskTitle={rtdTaskTitle}
          openViewTaskModal={(id) => openViewTaskModal(id)}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestRemove={submitRemoveTaskDependency}
          onClose={closeRTDModal}
          />
          {/* Delete Task Modal */}
          <DeleteTaskModal 
          show={showDelTaskModal}
          delTaskSubtask={delTaskSubtask}
          delTaskParent={delTaskParent}
          delTaskData={delTaskData}
          delTaskHasSubtasks={delTaskHasSubtasks}
          delTaskLoading={delTaskLoading}
          getParentTaskName={(id) => getParentTaskName(id)}
          onRequestDelete={submitDeleteTask}
          onClose={closeDeleteTaskModal}
          />
          {/* Batch Task Add Modal */}
          <BatchTaskAddModal
           show={showBatchModal}
           onClose={closeBatchModal}
           batchTasks={batchTasks}
           batchTitle={batchTitle}
           batchAddSubtasks={batchAddSubtasks}
           batchSubtasks={batchSubtasks}
           batchSubtitle={batchSubtitle}
           batchAddLoading={batchAddLoading}
           batchTitleErr={batchTitleErr}
           batchTasksErr={batchTasksErr}
           batchSubtasksErr={batchSubtasksErr}
           batchSubtitleErr={batchSubtitleErr}
           setBatchTasks={(newVal) => setBatchTasks(newVal)}
           setBatchTitle={(newVal) => setBatchTitle(newVal)}
           setBatchAddSubtasks={(newVal) => setBatchAddSubtasks(newVal)}
           setBatchSubtasks={(newVal) => setBatchSubtasks(newVal)}
           setBatchSubtitle={(newVal) => setBatchSubtitle(newVal)}
           onRequestSave={submitBatchAdd}
           />
          {/* Flag/Unflag Project Modal */}
          <FlagProjectModal 
            show={showFlagModal}
            project={project}
            flagMode={flagMode}
            flagOption={flagOption}
            flagDescrip={flagDescrip}
            flagLoading={flagLoading}
            flagOptionErr={flagOptionErr}
            setFlagOption={(newVal) => setFlagOption(newVal)}
            setFlagDescrip={(newVal) => setFlagDescrip(newVal)}
            onRequestSave={submitFlagProject}
            onClose={closeFlagModal}
          />
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
          {/* Manage Reader Resources */}
          {
            project.projectID  && (
                <ReaderResourcesManager
                  projectID={project.projectID}
                  show={showReaderResourcesModal}
                  onClose={handleCloseReaderResourcesModal}
                />
            )
          }
        </Grid.Column>
      </Grid.Row>
    </Grid>
  );

};

export default ProjectView;
