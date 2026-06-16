import './Projects.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { Breadcrumb, Button, Select, Spinner } from '@libretexts/davis-react';
import { IconChevronRight, IconExternalLink } from '@tabler/icons-react';
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

import { checkCanViewProjectDetails } from '../util/ProjectHelpers';
import { roadmapSteps } from '../util/RoadmapOptions.jsx';
import useGlobalError from '../error/ErrorHooks';


const GanttView = ({ viewMode, onTaskClick, onDateChange, ganttTasks }) => {
  let ganttRef = null;
  const [ganttInst, setGanttInst] = useState(null);

  useEffect(() => {
    if (ganttRef !== null && ganttInst === null
      && Array.isArray(ganttTasks) && ganttTasks.length > 0) {
      setGanttInst(new GanttJS(ganttRef, ganttTasks, {
        header_height: 75, column_width: 30, step: 24,
        view_modes: ['Day', 'Week', 'Month'],
        bar_height: 20, bar_corner_radius: 3, arrow_curve: 5, padding: 18,
        view_mode: viewMode, date_format: 'MM-DD-YYYY',
        on_click: onTaskClick, on_date_change: onDateChange,
      }));
    }
  }, [ganttRef, ganttInst, ganttTasks, viewMode, onTaskClick, onDateChange]);

  useEffect(() => {
    if (ganttInst !== null) ganttInst.change_view_mode(viewMode);
  }, [ganttInst, viewMode]);

  return (
    <div>
      <svg ref={node => { ganttRef = node; }} />
    </div>
  );
};


const CalendarView = ({ calendarEvents }) => {
  const locales = { 'en-US': enUS };
  const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
  return (
    <div className="task-calendar-container">
      <Calendar
        localizer={localizer}
        events={calendarEvents}
        views={['month']}
        defaultDate={new Date()}
        showMultiDayTimes
        components={{
          event: ({ event }) => <span><strong>{event.title}</strong></span>,
        }}
        eventPropGetter={(event) => {
          switch (event.status) {
            case 'completed':   return { style: { backgroundColor: '#21ba45' } };
            case 'inprogress':  return { style: { backgroundColor: '#2185d0' } };
            case 'available':   return { style: { backgroundColor: '#00b5ad' } };
            default:            return {};
          }
        }}
      />
    </div>
  );
};


const ProjectTimeline = (props) => {
  const { handleGlobalError } = useGlobalError();
  const user = useSelector((state) => state.user);

  const [loadingData, setLoadingData] = useState(false);
  const [viewMode, setViewMode] = useState('gantt');
  const [ganttViewMode, setGanttViewMode] = useState('Day');
  const [project, setProject] = useState({});
  const [canViewDetails, setCanViewDetails] = useState(false);

  const [showRoadmap, setShowRoadmap] = useState(false);
  const [roadmapRequiresRemix, setRoadmapRequiresRemix] = useState(null);
  const [currentRoadmapStep, setCurrentRoadmapStep] = useState('');
  const [openRoadmapStep, setOpenRoadmapStep] = useState('');
  const [openRoadmapStepInfo, setOpenRoadmapStepInfo] = useState({});

  const [projTasks, setProjTasks] = useState([]);
  const [ganttTasks, setGanttTasks] = useState([]);
  const [calendarTasks, setCalendarTasks] = useState([]);

  useEffect(() => {
    document.title = 'LibreTexts Conductor | Projects | Project View | Timeline';
    date.plugin(ordinal);
    date.plugin(day_of_week);
    if (localStorage.getItem('conductor_show_roadmap') === 'true') setShowRoadmap(true);
    getProject();
    getProjectTasks();
  }, []);

  useEffect(() => {
    if (project.title) {
      document.title = `LibreTexts Conductor | Projects | ${project.title} | Timeline`;
    }
  }, [project]);

  useEffect(() => {
    if (typeof user.uuid === 'string' && user.uuid !== '' && Object.keys(project).length > 0) {
      setCanViewDetails(checkCanViewProjectDetails(project, user));
    }
  }, [project, user]);

  const getProject = () => {
    setLoadingData(true);
    axios.get('/project', { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.project) {
            setProject(res.data.project);
            if (typeof res.data.project.rdmpReqRemix === 'boolean') setRoadmapRequiresRemix(res.data.project.rdmpReqRemix);
            if (typeof res.data.project.rdmpCurrentStep === 'string') setCurrentRoadmapStep(res.data.project.rdmpCurrentStep);
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      }).catch((err) => { handleGlobalError(err); setLoadingData(false); });
  };

  const getProjectTasks = () => {
    setLoadingData(true);
    axios.get('/project/tasks', { params: { projectID: props.match.params.id } })
      .then((res) => {
        if (!res.data.err) {
          if (res.data.tasks && Array.isArray(res.data.tasks)) {
            let flattenedTasks = [];
            res.data.tasks.forEach(item => {
              if (item.subtasks && item.subtasks.length > 0) {
                item.subtasks.sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
                flattenedTasks = flattenedTasks.concat(item.subtasks);
              }
            });
            res.data.tasks.sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
            flattenedTasks = [...res.data.tasks, ...flattenedTasks];
            setProjTasks(res.data.tasks);
            setGanttTasks(flattenedTasks.map((item) => ({
              id: item.taskID,
              name: item.title,
              progress: 100,
              start: item.startDate,
              end: item.endDate,
              dependencies: (item.dependencies || []).map(d => d.taskID),
              custom_class: `task-${item.status}`,
            })));
            setCalendarTasks(flattenedTasks.map((item) => ({
              id: item.taskID,
              title: item.title,
              allDay: true,
              start: item.startDate ? date.parse(item.startDate, 'YYYY-MM-DD') : new Date(),
              end: item.endDate ? date.parse(item.endDate, 'YYYY-MM-DD') : new Date(),
              status: item.status,
            })));
          }
        } else {
          handleGlobalError(res.data.errMsg);
        }
        setLoadingData(false);
      }).catch((err) => { handleGlobalError(err); setLoadingData(false); });
  };

  const updateRoadmapRequiresRemix = (newValue) => {
    if (typeof newValue !== 'boolean') return;
    setRoadmapRequiresRemix(newValue);
    const projData = { projectID: props.match.params.id };
    if ((project.rdmpReqRemix !== newValue) || !project.hasOwnProperty('rdmpReqRemix')) {
      projData.rdmpReqRemix = newValue;
    }
    if (Object.keys(projData).length > 1) {
      axios.put('/project', projData).then((res) => {
        if (!res.data.err) getProject();
        else handleGlobalError(res.data.errMsg);
      }).catch((err) => handleGlobalError(err));
    }
  };

  const updateRoadmapStep = (newValue) => {
    if (typeof newValue !== 'string') return;
    setCurrentRoadmapStep(newValue);
    const projData = { projectID: props.match.params.id };
    if ((project.rdmpCurrentStep !== newValue) || !project.hasOwnProperty('rdmpCurrentStep')) {
      projData.rdmpCurrentStep = newValue;
    }
    if (Object.keys(projData).length > 1) {
      axios.put('/project', projData).then((res) => {
        if (!res.data.err) getProject();
        else handleGlobalError(res.data.errMsg);
      }).catch((err) => handleGlobalError(err));
    }
  };

  const handleGanttTaskClick = (_task) => {};

  const handleGanttTaskDateChange = (task, start, end) => {
    axios.put('/project/task', {
      taskID: task.id,
      startDate: date.format(start, 'YYYY-MM-DD'),
      endDate: date.format(end, 'YYYY-MM-DD'),
    }).then((res) => {
      if (res.data.err) handleGlobalError(res.data.errMsg);
    }).catch((err) => handleGlobalError(err));
  };

  const handleChangeRoadmapVis = () => {
    setShowRoadmap(!showRoadmap);
    localStorage.setItem('conductor_show_roadmap', !showRoadmap);
  };

  const activateRoadmapStep = (key) => {
    const foundStep = roadmapSteps.find(item => item.key === key);
    if (foundStep) { setOpenRoadmapStep(foundStep.key); setOpenRoadmapStepInfo(foundStep); }
  };

  const renderRoadmapStep = (item, idx) => {
    const disabled = ['5a', '5b', '5c', '6'].includes(item.key) && roadmapRequiresRemix === null;
    const isOpen = openRoadmapStep === item.key;
    return (
      <div
        key={idx}
        className={[
          'project-roadmap-steps-list-item flex-row-div',
          disabled ? 'project-roadmap-step-disabled' : '',
          isOpen ? 'active' : '',
        ].join(' ').trim()}
        onClick={() => activateRoadmapStep(item.key)}
      >
        <div className="project-roadmap-step-list-info flex items-center gap-2">
          <input
            type="radio"
            className="project-roadmap-step-radio"
            checked={currentRoadmapStep === item.key}
            onChange={() => updateRoadmapStep(item.key)}
            onClick={(e) => e.stopPropagation()}
          />
          <p className={isOpen ? 'project-roadmap-steps-list-title active' : 'project-roadmap-steps-list-title'}>
            {item.title}
            {item.name && <span>: <em>{item.name}</em></span>}
            {item.optional && <span className="muted-text small-text"> (optional)</span>}
          </p>
        </div>
        <div className="right-flex project-roadmap-step-list-icon">
          <IconChevronRight size={16} />
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-bold">
        Timeline: <em>{project.title || 'Loading...'}</em>
      </h1>

      <div>
        <Breadcrumb>
          <Breadcrumb.Item><Link to="/projects">Projects</Link></Breadcrumb.Item>
          <Breadcrumb.Item>
            <Link to={`/projects/${project.projectID}`}>{project.title || 'Loading...'}</Link>
          </Breadcrumb.Item>
          <Breadcrumb.Item isCurrent>Timeline</Breadcrumb.Item>
        </Breadcrumb>
      </div>

      <div className="flex flex-col gap-6">
        {/* Construction Roadmap */}
        {canViewDetails && showRoadmap && (
          <div>
            <div className="flex items-center justify-between border-b pb-1 mb-3">
              <h2 className="text-xl font-semibold">Construction Roadmap</h2>
              <Button size="sm" variant="outline" onClick={handleChangeRoadmapVis}>Hide</Button>
            </div>
            <div className="border rounded-lg p-4 relative" id="project-roadmap-segment">
              {loadingData ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : (
                <div id="project-roadmap-container">
                  <div id="project-roadmap-steps">
                    <div className="flex-col-div" id="project-roadmap-steps-container">
                      <div className="flex-row-div" id="project-roadmap-steps-header-container">
                        <div className="left-flex">
                          <h3 className="text-base font-semibold">Steps</h3>
                        </div>
                      </div>
                      <div className="flex-col-div" id="project-roadmap-steps-list-container">
                        {roadmapRequiresRemix === true && roadmapSteps.filter(i => i.key !== '6').map(renderRoadmapStep)}
                        {roadmapRequiresRemix === false && roadmapSteps.filter(i => i.key !== '5a' && i.key !== '5b' && i.key !== '5c').map(renderRoadmapStep)}
                        {roadmapRequiresRemix === null && roadmapSteps.map(renderRoadmapStep)}
                      </div>
                    </div>
                  </div>
                  <div id="project-roadmap-stepdetail">
                    <div className="flex-col-div" id="project-roadmap-stepdetail-container">
                      <div className="flex-row-div" id="project-roadmap-stepdetail-header-container">
                        <h3 className="text-base font-semibold">
                          {openRoadmapStepInfo.key
                            ? (openRoadmapStepInfo.name
                              ? <span>Step {openRoadmapStepInfo.key}: <em>{openRoadmapStepInfo.name}</em></span>
                              : <span>Step {openRoadmapStepInfo.key}</span>)
                            : <em>Step Detail</em>
                          }
                        </h3>
                      </div>
                      <div id="project-roadmap-stepdetail-info-container">
                        {openRoadmapStepInfo.key && openRoadmapStepInfo.description}
                        {openRoadmapStepInfo.hasExtra && (
                          <a
                            className="project-roadmap-steps-link"
                            href={openRoadmapStepInfo.linkHref}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconExternalLink size={14} className="inline-block mr-1" />
                            {openRoadmapStepInfo.linkTitle}
                          </a>
                        )}
                        {openRoadmapStepInfo.key === '4' && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              variant={roadmapRequiresRemix === true ? 'primary' : 'outline'}
                              onClick={() => updateRoadmapRequiresRemix(true)}
                              className="flex-1"
                            >
                              Yes
                            </Button>
                            <Button
                              variant={roadmapRequiresRemix === false ? 'primary' : 'outline'}
                              onClick={() => updateRoadmapRequiresRemix(false)}
                              className="flex-1"
                            >
                              No
                            </Button>
                          </div>
                        )}
                        {!openRoadmapStepInfo.key && (
                          <p className="text-center muted-text mt-4r"><em>Select a step from the list on the left.</em></p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {canViewDetails && !showRoadmap && (
          <div className="border rounded-lg p-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold" id="project-roadmap-heading">Construction Roadmap</h2>
            <Button size="sm" variant="outline" onClick={handleChangeRoadmapVis}>Show</Button>
          </div>
        )}
        {!canViewDetails && (
          <div>
            <h2 className="text-xl font-semibold border-b pb-1 mb-3">Construction Roadmap</h2>
            <div className="border rounded-lg p-4 text-gray-500">
              <em>You don't have permission to view this project's Construction Roadmap yet.</em>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div>
          <h2 className="text-xl font-semibold border-b pb-1 mb-3">Timeline</h2>
          <div className="border rounded-lg" id="project-timeline-segment">
            {/* Tab bar */}
            <div className="flex items-center border-b">
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewMode === 'gantt' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                onClick={() => setViewMode('gantt')}
              >
                Gantt View
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewMode === 'calendar' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
                onClick={() => setViewMode('calendar')}
              >
                Calendar View
              </button>
              {viewMode === 'gantt' && (
                <div className="ml-auto px-2">
                  <Select
                    name="ganttViewMode"
                    label=""
                    options={[
                      { value: 'Day', label: 'Day' },
                      { value: 'Week', label: 'Week' },
                      { value: 'Month', label: 'Month' },
                    ]}
                    value={ganttViewMode}
                    onChange={(e) => setGanttViewMode(e.target.value)}
                    placeholder="Gantt View Options"
                    disabled={!ganttTasks.length}
                    className="w-48"
                  />
                </div>
              )}
            </div>
            <div className="p-4">
              {loadingData ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : projTasks.length > 0 ? (
                viewMode === 'gantt'
                  ? <GanttView viewMode={ganttViewMode} onTaskClick={handleGanttTaskClick} onDateChange={handleGanttTaskDateChange} ganttTasks={ganttTasks} />
                  : viewMode === 'calendar' && <CalendarView calendarEvents={calendarTasks} />
              ) : (
                <p className="text-center text-gray-400 py-8">No tasks yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTimeline;
