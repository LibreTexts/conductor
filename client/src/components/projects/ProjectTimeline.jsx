import './Projects.css'
import 'react-big-calendar/lib/css/react-big-calendar.css';

import {
  Grid,
  Header,
  Segment,
  Icon,
  Button,
  Breadcrumb,
  Modal,
  Radio,
  Menu,
  Dropdown
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import axios from 'axios';

import GanttJS from 'frappe-gantt';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';

import { checkCanViewProjectDetails } from '../util/ProjectHelpers.js';
import { roadmapSteps } from '../util/RoadmapOptions.jsx';

import useGlobalError from '../error/ErrorHooks.js';


const GanttView = ({
    viewMode,
    onTaskClick,
    onDateChange,
    ganttTasks
}) => {
    let ganttRef = null;
    const [ganttInst, setGanttInst] = useState(null);

    useEffect(() => {
        if (ganttRef !== null && ganttInst === null
            && Array.isArray(ganttTasks) && ganttTasks.length > 0) {
            setGanttInst(new GanttJS(ganttRef, ganttTasks, {
                header_height: 75,
                column_width: 30,
                step: 24,
                view_modes: ['Day', 'Week', 'Month'],
                bar_height: 20,
                bar_corner_radius: 3,
                arrow_curve: 5,
                padding: 18,
                view_mode: viewMode,
                date_format: 'MM-DD-YYYY',
                on_click: onTaskClick,
                on_date_change: onDateChange
            }));
        }
    }, [ganttRef, ganttInst, ganttTasks, viewMode, onTaskClick, onDateChange]);

    useEffect(() => {
        if (ganttInst !== null) {
            ganttInst.change_view_mode(viewMode);
        }
    }, [ganttInst, viewMode]);

    return (
        <div>
            <svg ref={ node => { ganttRef = node; }} />
        </div>
    )
};


const CalendarView = ({ calendarEvents }) => {
    const locales = { 'en-US': enUS };

    const localizer = dateFnsLocalizer({
        format,
        parse,
        startOfWeek,
        getDay,
        locales
    });

    return (
        <div className='task-calendar-container'>
            <Calendar
                localizer={localizer}
                events={calendarEvents}
                views={['month']}
                defaultDate={new Date()}
                showMultiDayTimes
                components={{
                    event: ({ event }) => {
                        return (
                            <span>
                                <strong>{event.title}</strong>
                            </span>
                        )
                    }
                }}
                eventPropGetter={(event) => {
                    switch(event.status) {
                        case 'completed':
                            return { style: { backgroundColor: '#21ba45' }};
                        case 'inprogress':
                            return { style: { backgroundColor: '#2185d0' }};
                        case 'available':
                            return { style: { backgroundColor: '#00b5ad' }};
                        default:
                            return {}
                    }
                }}
            />
        </div>
    )
};


const ProjectTimeline = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [loadingData, setLoadingData] = useState(false);
    const [viewMode, setViewMode] = useState('gantt');
    const [ganttViewMode, setGanttViewMode] = useState('Day');

    // Project Data
    const [project, setProject] = useState({});

    // Project Permissions
    const [canViewDetails, setCanViewDetails] = useState(false);

    // Roadmap
    const [showRoadmap, setShowRoadmap] = useState(false);
    const [roadmapRequiresRemix, setRoadmapRequiresRemix] = useState(null);
    const [currentRoadmapStep, setCurrentRoadmapStep] = useState('');
    const [showConfirmPublish, setShowConfirmPublish] = useState(false);
    const [openRoadmapStep, setOpenRoadmapStep] = useState('');
    const [openRoadmapStepInfo, setOpenRoadmapStepInfo] = useState({});

    // Tasks
    const [projTasks, setProjTasks] = useState([]);
    const [ganttTasks, setGanttTasks] = useState([]);
    const [calendarTasks, setCalendarTasks] = useState([]);


    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View | Timeline";
        date.plugin(ordinal);
        date.plugin(day_of_week);
        if (localStorage.getItem('conductor_show_roadmap') !== null) {
            if (localStorage.getItem('conductor_show_roadmap') === 'true') {
                setShowRoadmap(true);
            }
        }
        getProject();
        getProjectTasks();
    }, []);


    /**
     * Update the page title to the project title when it is available.
     */
    useEffect(() => {
        if (project.title && project.title !== '') {
            document.title = `LibreTexts Conductor | Projects | ${project.title} | Timeline`;
        }
    }, [project]);


    /*
     * Update the user's permission to view Project restricted details when
     * their identity and the project data is available.
     */
    useEffect(() => {
        if (typeof(user.uuid) === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
            setCanViewDetails(checkCanViewProjectDetails(project, user));
        }
    }, [project, user, setCanViewDetails]);


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
                    if (res.data.project.hasOwnProperty('rdmpReqRemix') && typeof(res.data.project.rdmpReqRemix) === 'boolean') {
                        setRoadmapRequiresRemix(res.data.project.rdmpReqRemix);
                    }
                    if (res.data.project.hasOwnProperty('rdmpCurrentStep') && typeof(res.data.project.rdmpCurrentStep) === 'string') {
                        setCurrentRoadmapStep(res.data.project.rdmpCurrentStep);
                    }
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


    /**
     * Retrieves project tasks via GET request to the server
     * and prepares them for UI inclusion.
     */
    const getProjectTasks = () => {
        setLoadingData(true);
        axios.get('/project/tasks', {
            params: {
                projectID: props.match.params.id
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.tasks && Array.isArray(res.data.tasks)) {
                    // Flatten array of tasks by extracting subtasks and sort all
                    let flattenedTasks = [];
                    res.data.tasks.forEach(item => {
                        if (item.subtasks && item.subtasks.length > 0) {
                            item.subtasks.sort((a,b) => {
                                if (a.title < b.title) return -1;
                                if (a.title > b.title) return 1;
                                return 0;
                            });
                            flattenedTasks = flattenedTasks.concat(item.subtasks);
                        }
                    });
                    res.data.tasks.sort((a, b) => {
                        if (a.title < b.title) return -1;
                        if (a.title > b.title) return 1;
                        return 0;
                    });
                    flattenedTasks = [...res.data.tasks, ...flattenedTasks];
                    // Prep tasks for UI presentation
                    setProjTasks(res.data.tasks);
                    let newGanttTasks = flattenedTasks.map((item) => {
                        let dependencies = [];
                        if (item.dependencies && Array.isArray(item.dependencies)) {
                            item.dependencies.forEach(item => {
                                dependencies.push(item.taskID);
                            });
                        }
                        return {
                            id: item.taskID,
                            name: item.title,
                            progress: 100,
                            start: item.startDate,
                            end: item.endDate,
                            dependencies: dependencies,
                            custom_class: `task-${item.status}`
                        }
                    });
                    let newCalendarTasks = flattenedTasks.map((item, idx) => {
                        let parsedStart, parsedEnd;
                        if (item.startDate) parsedStart = date.parse(item.startDate, 'YYYY-MM-DD');
                        else parsedStart = new Date();
                        if (item.endDate) parsedEnd = date.parse(item.endDate, 'YYYY-MM-DD');
                        else parsedEnd = new Date();
                        return {
                            id: item.taskID,
                            title: item.title,
                            allDay: true,
                            start: parsedStart,
                            end: parsedEnd,
                            status: item.status
                        }
                    });
                    setGanttTasks(newGanttTasks);
                    setCalendarTasks(newCalendarTasks);
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


    /**
     * Update state and send update to the server when the Roadmap's
     * 'Requires Remixing' question answer changes.
     * @param {Boolean} newValue  - the new question response
     */
    const updateRoadmapRequiresRemix = (newValue) => {
        if (typeof(newValue) === 'boolean') {
            setRoadmapRequiresRemix(newValue);
            let projData = {
                projectID: props.match.params.id
            };
            if ((project.hasOwnProperty('rdmpReqRemix') && project.rdmpReqRemix !== newValue) || !project.hasOwnProperty('rdmpReqRemix')) {
                projData.rdmpReqRemix = newValue;
            }
            if (Object.keys(projData).length > 1) {
                // changes to save
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        getProject();
                    } else {
                        handleGlobalError(res.data.errMsg);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                });
            }
        }
    };


    /**
     * Update state and send update to the server when the Roadmap's
     * current step changes.
     * @param {String} newValue  - the new roadmap step name
     */
    const updateRoadmapStep = (newValue) => {
        if (typeof(newValue) === 'string') {
            setCurrentRoadmapStep(newValue);
            let projData = {
                projectID: props.match.params.id
            };
            if ((project.hasOwnProperty('rdmpCurrentStep') && project.rdmpCurrentStep !== newValue) || !project.hasOwnProperty('rdmpCurrentStep')) {
                projData.rdmpCurrentStep = newValue;
            }
            if (Object.keys(projData).length > 1) {
                // changes to save
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        getProject();
                    } else {
                        handleGlobalError(res.data.errMsg);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                });
            }
        }
    };


    /**
     * No-op function to handle clicking on a Gantt task.
     */
    const handleGanttTaskClick = (task) => {};


    /**
     * Sends a PUT request to the server to update task's start and end dates
     * when they are changed in the Gantt plot.
     */
    const handleGanttTaskDateChange = (task, start, end) => {
        const startParsed = date.format(start, 'YYYY-MM-DD');
        const endParsed = date.format(end, 'YYYY-MM-DD');
        axios.put('/project/task', {
            taskID: task.id,
            startDate: startParsed,
            endDate: endParsed
        }).then((res) => {
            if (res.data.err) {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    };


    /**
     * Updates state and local storage with the choice of Roadmap section
     * visibility.
     */
    const handleChangeRoadmapVis = () => {
        setShowRoadmap(!showRoadmap);
        localStorage.setItem('conductor_show_roadmap', !showRoadmap);
    };


    /**
     * Submits a Publishing Request for the current project to the server
     * via POST and closes the Confirm Publish Request modal.
     */
    const submitPublishRequest = () => {
        axios.post('/project/publishing', {
            projectID: props.match.params.id
        }).then((res) => {
            if (!res.data.err) {
                setShowConfirmPublish(false);
            } else {
                handleGlobalError(res.data.errMsg);
            }
        }).catch((err) => {
            handleGlobalError(err);
        });
    };


    /**
     * Open ths selected step in the Roadmap UI.
     */
    const activateRoadmapStep = (key) => {
        let foundStep = roadmapSteps.find(item => item.key === key);
        if (foundStep !== undefined) {
            setOpenRoadmapStep(foundStep.key);
            setOpenRoadmapStepInfo(foundStep);
        }
    };


    /**
     * Renders a Roadmap step in the list.
     * @param {Object} item - the Roadmap step information object
     * @param {Number} idx - the step's index
     */
    const renderRoadmapStep = (item, idx) => {
        let listClassName = 'project-roadmap-steps-list-item flex-row-div';
        if (['5a', '5b', '5c', '6'].includes(item.key) && roadmapRequiresRemix === null) {
            listClassName = 'project-roadmap-steps-list-item flex-row-div project-roadmap-step-disabled';
        } else {
            if (openRoadmapStep === item.key) {
                listClassName = 'project-roadmap-steps-list-item flex-row-div active';
            }
        }
        return (
            <div
                className={listClassName}
                key={idx}
                onClick={() => activateRoadmapStep(item.key)}
            >
                <div className='project-roadmap-step-list-info'>
                    <Radio
                        checked={currentRoadmapStep === item.key}
                        onChange={() => updateRoadmapStep(item.key)}
                        className='project-roadmap-step-radio'
                    />
                    <p
                        className={(openRoadmapStep === item.key)
                            ? 'project-roadmap-steps-list-title active'
                            : 'project-roadmap-steps-list-title'
                        }
                    >
                        {item.title}
                        {item.name &&
                            <span>: <em>{item.name}</em></span>
                        }
                        {item.optional &&
                            <span className='muted-text small-text'> (optional)</span>
                        }
                    </p>
                </div>
                <div className='right-flex project-roadmap-step-list-icon'>
                    <Icon
                        name='chevron right'
                    />
                </div>
            </div>
        )
    };


    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Timeline: <em>{project.title || 'Loading...'}</em></Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/projects'>
                                    Projects
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section as={Link} to={`/projects/${project.projectID}`}>
                                    {project.title || 'Loading...'}
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Timeline
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    {(canViewDetails && showRoadmap) &&
                                        <Grid.Column>
                                            <Header as='h2' dividing className='mt-1p'>
                                                Construction Roadmap
                                                <Button
                                                    compact
                                                    floated='right'
                                                    onClick={handleChangeRoadmapVis}
                                                >
                                                    Hide
                                                </Button>
                                            </Header>
                                            <Segment
                                                id='project-roadmap-segment'
                                                size='large'
                                                raised
                                                className='mb-2p'
                                                loading={loadingData}
                                            >
                                                <div id='project-roadmap-container'>
                                                    <div id='project-roadmap-steps'>
                                                        <div className='flex-col-div' id='project-roadmap-steps-container'>
                                                            <div className='flex-row-div' id='project-roadmap-steps-header-container'>
                                                                <div className='left-flex'>
                                                                    <Header as='h3'>Steps</Header>
                                                                </div>
                                                            </div>
                                                            <div className='flex-col-div' id='project-roadmap-steps-list-container'>
                                                                {(roadmapRequiresRemix === true) &&
                                                                    roadmapSteps.filter(item => item.key !== '6').map(renderRoadmapStep)
                                                                }
                                                                {(roadmapRequiresRemix === false) &&
                                                                    roadmapSteps.filter(item => item.key !== '5a' && item.key !== '5b' && item.key !== '5c').map(renderRoadmapStep)
                                                                }
                                                                {(roadmapRequiresRemix === null) &&
                                                                    roadmapSteps.map(renderRoadmapStep)
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div id='project-roadmap-stepdetail'>
                                                        <div className='flex-col-div' id='project-roadmap-stepdetail-container'>
                                                            <div className='flex-row-div' id='project-roadmap-stepdetail-header-container'>
                                                                <Header as='h3'>
                                                                    {openRoadmapStepInfo.key
                                                                        ? ((openRoadmapStepInfo.name)
                                                                            ? <span>Step {openRoadmapStepInfo.key}: <em>{openRoadmapStepInfo.name}</em></span>
                                                                            : <span>Step {openRoadmapStepInfo.key}</span>
                                                                        )
                                                                        : <em>Step Detail</em>
                                                                    }
                                                                </Header>
                                                            </div>
                                                            <div id='project-roadmap-stepdetail-info-container'>
                                                                {openRoadmapStepInfo.key &&
                                                                    openRoadmapStepInfo.description
                                                                }
                                                                {openRoadmapStepInfo.hasExtra &&
                                                                    <a
                                                                        className='project-roadmap-steps-link'
                                                                        href={openRoadmapStepInfo.linkHref}
                                                                        target='_blank'
                                                                        rel='noopener noreferrer'
                                                                    >
                                                                        <Icon name='external' />
                                                                        {openRoadmapStepInfo.linkTitle}
                                                                    </a>
                                                                }
                                                                {(openRoadmapStepInfo.key === '4') &&
                                                                    <Button.Group widths={2}>
                                                                        <Button
                                                                            basic={(roadmapRequiresRemix === null) || (roadmapRequiresRemix === false)}
                                                                            color='blue'
                                                                            onClick={() => updateRoadmapRequiresRemix(true)}
                                                                        >
                                                                            Yes
                                                                        </Button>
                                                                        <Button
                                                                            basic={(roadmapRequiresRemix === null) || (roadmapRequiresRemix === true)}
                                                                            color='green'
                                                                            onClick={() => updateRoadmapRequiresRemix(false)}
                                                                        >
                                                                            No
                                                                        </Button>
                                                                    </Button.Group>
                                                                }
                                                                {openRoadmapStepInfo.key === '11' &&
                                                                    <Button
                                                                        color='blue'
                                                                        onClick={() => setShowConfirmPublish(true)}
                                                                        fluid
                                                                        className='mt-2p'
                                                                    >
                                                                        Publish Text
                                                                    </Button>
                                                                }
                                                                {!openRoadmapStepInfo.key &&
                                                                    <p className='text-center muted-text mt-4r'><em>Select a step from the list on the left.</em></p>
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {(canViewDetails && !showRoadmap) &&
                                        <Grid.Column>
                                            <Segment
                                                raised
                                                clearing
                                            >
                                                <Header as='h2' id='project-roadmap-heading'>Construction Roadmap</Header>
                                                <Button
                                                    floated='right'
                                                    onClick={handleChangeRoadmapVis}
                                                >
                                                    Show
                                                </Button>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                    {!canViewDetails &&
                                        <Grid.Column>
                                            <Header as='h2' dividing>Construction Roadmap</Header>
                                            <Segment
                                                size='large'
                                                raised
                                                className='mb-2p'
                                            >
                                                <p><em>You don't have permission to view this project's Construction Roadmap yet.</em></p>
                                            </Segment>
                                        </Grid.Column>
                                    }
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing className='mt-1p'>Timeline</Header>
                                        <Segment
                                            id='project-timeline-segment'
                                            size='large'
                                            raised
                                            className='mb-2p'
                                            loading={loadingData}
                                        >
                                            <Menu>
                                                <Menu.Item
                                                    name='gantt'

                                                    content={<p>Gantt View</p>}
                                                    active={viewMode === 'gantt'}
                                                    onClick={() => setViewMode('gantt')}
                                                    color='blue'
                                                />
                                                <Menu.Item
                                                    name='calendar'
                                                    content={<p>Calendar View</p>}
                                                    active={viewMode === 'calendar'}
                                                    onClick={() => setViewMode('calendar')}
                                                    color='teal'
                                                />
                                                {(viewMode === 'gantt') &&
                                                    <Menu.Menu position='right'>
                                                        <Dropdown item text='Gantt View Options'
                                                            value={ganttViewMode}
                                                            onChange={(_e, { value }) => setGanttViewMode(value)}
                                                            options={[
                                                                { key: 'day',   text: 'Day',    value: 'Day' },
                                                                { key: 'week',  text: 'Week',   value: 'Week' },
                                                                { key: 'month', text: 'Month',  value: 'Month'}
                                                            ]}
                                                            disabled={(Array.isArray(ganttTasks) && ganttTasks.length === 0)}
                                                        />
                                                    </Menu.Menu>
                                                }
                                            </Menu>
                                            {(Array.isArray(projTasks) && projTasks.length > 0)
                                                ? ((viewMode === 'gantt')
                                                    ? <GanttView
                                                        viewMode={ganttViewMode}
                                                        onTaskClick={handleGanttTaskClick}
                                                        onDateChange={handleGanttTaskDateChange}
                                                        ganttTasks={ganttTasks}
                                                      />
                                                     : ((viewMode === 'calendar') &&
                                                        <CalendarView calendarEvents={calendarTasks} />
                                                     )
                                                )
                                                :(<p className='mt-2p mb-2p text-center muted-text'>No tasks yet.</p>)
                                            }
                                        </Segment>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    {/* Confirm Publish Request Modal */}
                    <Modal
                        open={showConfirmPublish}
                        onClose={() => setShowConfirmPublish(false) }
                    >
                        <Modal.Header>Confirm Publish Request</Modal.Header>
                        <Modal.Content>
                            Are you sure you want to request publishing? This will send a request to the LibreTexts team.
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={() => setShowConfirmPublish(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='blue'
                                onClick={submitPublishRequest}
                            >
                                Confirm
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectTimeline;
