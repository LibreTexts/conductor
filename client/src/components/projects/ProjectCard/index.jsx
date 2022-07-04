import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Card, Popup, Icon, Button } from 'semantic-ui-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import { truncateString } from '../../util/HelperFunctions';
import './ProjectCard.css';

/**
 * A UI component representing a Project and displaying its basic information and status.
 */
const ProjectCard = ({ project, showPinButton, onPin, ...props }) => {
  const progressStyles = buildStyles({
    rotation: 1 / 2 + 1 / 8,
    pathColor: '#127BC4',
    textColor: '#127BC4',
    strokeLinecap: 'butt'
  });
  const peerStyles = buildStyles({
    rotation: 1 / 2 + 1 / 8,
    pathColor: '#CD4D12',
    textColor: '#CD4D12',
    strokeLinecap: 'butt'
  });
  const a11yStyles = buildStyles({
    rotation: 1 / 2 + 1 / 8,
    pathColor: '#00b5ad',
    textColor: '#00b5ad',
    strokeLinecap: 'butt'
  });
  const strokeWidth = 5;
  const circleRatio = 0.75;

  useEffect(() => {
    date.plugin(ordinal);
  }, []);

  const projectUpdated = new Date(project.updatedAt);
  const updateDate = date.format(projectUpdated, 'MM/DD/YY');
  const updateTime = date.format(projectUpdated, 'h:mm A');

  /**
   * Activates the provided callback (if valid) when the user clicks the "Pin" button.
   */
  const handlePinClick = () => {
    if (typeof (onPin) === 'function') {
      onPin(project.projectID);
    }
  };

  return (
    <Card raised {...props}>
      <div className='flex-col-div project-card-content'>
        <div className='flex-row-div'>
          <div className='flex-col-div project-card-title-column'>
              <Link
                as='h4'
                className='project-card-title'
                to={`/projects/${project.projectID}`}
              >
                {truncateString(project.title, 100)}
              </Link>
              <span className='muted-text project-card-lastupdate'>
                Last updated {updateDate} at {updateTime}
              </span>
          </div>
          <div className='flex-col-div'>
            {showPinButton && (
              <Popup
                content={<span>Add to your Pinned Projects</span>}
                trigger={
                  <Button
                    color='blue'
                    onClick={handlePinClick}
                    icon
                    circular
                    size='small'
                  >
                    <Icon name='pin' />
                  </Button>
                }
                position='top center'
              />
            )}
          </div>
        </div>
        <div className='flex-row-div'>
          <div className='project-card-progress-container'>
            <CircularProgressbar
              value={project.currentProgress || 0}
              strokeWidth={strokeWidth}
              circleRatio={circleRatio}
              styles={progressStyles}
            />
          </div>
          <div className='project-card-progress-container'>
            <CircularProgressbar
              value={project.peerProgress || 0}
              strokeWidth={strokeWidth}
              circleRatio={circleRatio}
              styles={peerStyles}
            />
          </div>
          <div className='project-card-progress-container'>
            <CircularProgressbar
              value={project.a11yProgress || 0}
              strokeWidth={strokeWidth}
              circleRatio={circleRatio}
              styles={a11yStyles}
            />
          </div>
        </div>
      </div>
    </Card>
  )
};

ProjectCard.propTypes = {
  project: PropTypes.shape({
    projectID: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    updatedAt: PropTypes.string.isRequired,
    currentProgress: PropTypes.number,
    peerProgress: PropTypes.number,
    a11yProgress: PropTypes.number,
    showPinButton: PropTypes.bool,
    onPin: PropTypes.func,
  }).isRequired,
};

ProjectCard.defaultProps = {
  showPinButton: false,
};

export default ProjectCard;
