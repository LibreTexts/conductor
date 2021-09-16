import './ProjectsPortal.css';
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
  Dropdown,
  Label,
  List
} from 'semantic-ui-react';
import {
    CircularProgressbar,
    buildStyles
} from 'react-circular-progressbar';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import {
    isEmptyString,
    capitalizeFirstLetter,
    normalizeURL
} from '../util/HelperFunctions.js';

import {
    visibilityOptions
} from '../util/ProjectOptions.js';
import {
    licenseOptions,
    getLicenseText
} from '../util/LicenseOptions.js';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectView = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadingData, setLoadingData] = useState(false);

    // Project Data
    const [project, setProject] = useState({});

    // Change Visibility Modal
    const [showVisModal, setShowVisModal] = useState(false);
    const [projVisibility, setProjVisibility] = useState('');
    const [visModalLoading, setVisModalLoading] = useState(false);

    // Edit Information Modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editModalLoading, setEditModalLoading] = useState(false);
    const [projTitle, setProjTitle] = useState('');
    //const [projStatus, setProjStatus] = useState('');
    const [projProgress, setProjProgress] = useState(0);
    const [projURL, setProjURL] = useState('');
    const [projTags, setProjTags] = useState([]);
    const [projResAuthor, setProjResAuthor] = useState('');
    const [projResLicense, setProjResLicense] = useState('');
    const [projResURL, setProjResURL] = useState('');
    const [projNotes, setProjNotes] = useState('');
    const [projTitleErr, setProjTitleErr] = useState(false);
    const [projProgressErr, setProjProgressErr] = useState(false);
    const [tagOptions, setTagOptions] = useState([]);
    const [loadedTags, setLoadedTags] = useState(false);

    // Manage Collaborators Modal
    const [showCollabsModal, setShowCollabsModal] = useState(false);


    /**
     * Set page title and load Project information on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Project View";
        getProject();
    }, []);


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
     * Opens the Change Visibility Modal and sets fields
     * to their current respective values.
     */
    const openVisModal = () => {
        if (project.visibility) {
            setProjVisibility(project.visibility);
        }
        setVisModalLoading(false);
        setShowVisModal(true);
    };


    /**
     * Closes the Change Visibility Modal and resets
     * fields to their default values.
     */
    const closeVisModal = () => {
        setShowVisModal(false);
        setProjVisibility('private');
        setVisModalLoading(false);
    };


    /**
     * Submits the project visibility change (if any) to
     * the server via PUT request, then closes the Change
     * Visibility Modal and re-syncs Project information.
     */
    const submitVisChange = () => {
        var visChange = true;
        if ((project.visibility) && (project.visibility === projVisibility)) visChange = false;
        if (visChange) {
            setVisModalLoading(true);
            axios.put('/project/visibility', {
                projectID: props.match.params.id,
                visibility: projVisibility
            }).then((res) => {
                if (!res.data.err) {
                    closeVisModal();
                    getProject();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setVisModalLoading(false);
            });
        } else {
            closeVisModal();
        }
    };


    /**
     * Opens the Edit Information Modal and retrieves existing tags,
     * then sets fields to their current respective values.
     */
    const openEditInfoModal = () => {
        setEditModalLoading(true);
        getTags();
        if (project.title) setProjTitle(project.title);
        if (project.hasOwnProperty('currentProgress')) setProjProgress(project.currentProgress);
        if (project.projectURL) setProjURL(project.projectURL);
        if (project.tags) setProjTags(project.tags);
        if (project.author) setProjResAuthor(project.author);
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
        setProjProgress(0);
        setProjURL('');
        setProjTags([]);
        setProjResAuthor('');
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
        return validForm;
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
            if ((project.projectURL && project.projectURL !== projURL) || !project.projectURL) {
                projData.projectURL = projURL;
            }
            if ((project.author && project.author !== projResAuthor) || !project.author) {
                projData.author = projResAuthor;
            }
            if ((project.license && project.license !== projResLicense) || !project.license) {
                projData.license = projResLicense;
            }
            if ((project.resourceURL && project.resourceURL !== projResURL) || !project.resourceURL) {
                projData.resourceURL = projResURL;
            }
            if ((project.notes && project.notes !== projProgress) || !project.notes) {
                projData.notes = projNotes;
            }
            if (Object.keys(projData).length > 1) {
                axios.put('/project', projData).then((res) => {
                    if (!res.data.err) {
                        closeEditInfoModal();
                        if (res.data.project) {
                            setProject(res.data.project);
                        } else {
                            getProject();
                        }
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


    const openCollabsModal = () => {
        setShowCollabsModal(true);
    };

    const closeCollabsModal = () => {
        setShowCollabsModal(false);
    };


    // Rendering Helper Booleans
    let hasResourceInfo = project.author || project.license || project.resourceURL;
    let hasNotes = project.notes && !isEmptyString(project.notes);


    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Project: <em>{project.title || 'Loading...'}</em></Header>
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
                                <Breadcrumb.Section active>
                                    {project.title || 'Loading...'}
                                </Breadcrumb.Section>
                            </Breadcrumb>
                            <div className='float-right'>
                                <p className='muted-text'>ID: {project.projectID || 'Loading...'}</p>
                            </div>
                        </Segment>
                        <Segment loading={loadingData}>
                            <Grid padded='horizontally' relaxed>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Button.Group fluid widths={4}>
                                            <Button
                                                color='blue'
                                                loading={editModalLoading}
                                                onClick={openEditInfoModal}
                                            >
                                                <Icon name='edit' />
                                                Edit Information
                                            </Button>
                                            <Button
                                                color='violet'
                                                onClick={openCollabsModal}
                                            >
                                                <Icon name='users' />
                                                Manage Collaborators
                                            </Button>
                                            <Button
                                                color='teal'
                                                onClick={openVisModal}
                                            >
                                                <Icon name='eye' />
                                                Change Visibility
                                            </Button>
                                            <Button
                                                color='green'
                                            >
                                                <Icon name='check' />
                                                Complete Project
                                            </Button>
                                        </Button.Group>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Project Information</Header>
                                        <Grid>
                                            <Grid.Row>
                                                <Grid.Column width={3}>
                                                    <CircularProgressbar
                                                        value={project.currentProgress || 0}
                                                        text={`${project.currentProgress || 0}%`}
                                                        strokeWidth={5}
                                                        styles={buildStyles({
                                                            pathColor: '#127BC4',
                                                            textColor: '#127BC4'
                                                        })}
                                                    />
                                                </Grid.Column>
                                                <Grid.Column width={13}>
                                                    <Grid>
                                                        <Grid.Row>
                                                            <Grid.Column width={4}>
                                                                <Header as='span' sub>Status: </Header>
                                                                <span>{project.status ? capitalizeFirstLetter(project.status) : 'Loading...'}</span>
                                                            </Grid.Column>
                                                            <Grid.Column width={4}>
                                                                <Header as='span' sub>Visibility: </Header>
                                                                <span>{project.visibility ? capitalizeFirstLetter(project.visibility) : 'Loading...'}</span>
                                                            </Grid.Column>
                                                            {(project.projectURL && !isEmptyString(project.projectURL)) &&
                                                                <Grid.Column width={8}>
                                                                    <Header as='span' sub>URL: </Header>
                                                                    <a href={normalizeURL(project.projectURL)} target='_blank' rel='noopener noreferrer'>{project.projectURL}</a>
                                                                </Grid.Column>
                                                            }
                                                        </Grid.Row>
                                                        {(project.tags && Array.isArray(project.tags) && project.tags.length > 0) &&
                                                            <Grid.Row>
                                                                <Grid.Column>
                                                                    <Header as='span' sub>Tags: </Header>
                                                                    <Label.Group color='blue' className='inlineblock-display ml-1p'>
                                                                        {project.tags.map((tag, idx) => {
                                                                            return (
                                                                                <Label key={idx}>{tag}</Label>
                                                                            )
                                                                        })}
                                                                    </Label.Group>
                                                                </Grid.Column>
                                                            </Grid.Row>
                                                        }
                                                    </Grid>
                                                    {hasResourceInfo &&
                                                        <Header as='h3' dividing>Resource</Header>
                                                    }
                                                    {hasResourceInfo &&
                                                        <div>
                                                            {(project.author && !isEmptyString(project.author)) &&
                                                                <div className='mb-1p'>
                                                                    <Header as='span' sub>Author: </Header>
                                                                    <span>{project.author}</span>
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
                                                                    <Header as='span' sub>URL: </Header>
                                                                    <a href={normalizeURL(project.resourceURL)} target='_blank' rel='noopener noreferrer'>{project.resourceURL}</a>
                                                                </div>
                                                            }
                                                        </div>
                                                    }
                                                    {hasNotes &&
                                                        <Header as='h3' dividing>Notes</Header>
                                                    }
                                                    {hasNotes &&
                                                        <p>{project.notes}</p>
                                                    }
                                                </Grid.Column>
                                            </Grid.Row>
                                        </Grid>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Discussion</Header>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column>
                                        <Header as='h2' dividing>Tasks</Header>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Segment.Group>
                    {/* Edit Project Information Modal */}
                    <Modal
                        open={showEditModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Edit Project Information</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Header as='h3'>Project Overview</Header>
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
                                <Form.Field>
                                    <label>Project URL <span className='muted-text'>(if applicable)</span></label>
                                    <Form.Input
                                        name='projectURL'
                                        type='url'
                                        placeholder='Enter project URL...'
                                        onChange={(e) => setProjURL(e.target.value)}
                                        value={projURL}
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
                                <Divider />
                                <Header as='h3'>Resource Information</Header>
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
                                    <Form.Select
                                        fluid
                                        label='License'
                                        placeholder='License...'
                                        options={licenseOptions}
                                        onChange={(_e, { value }) => setProjResLicense(value)}
                                        value={projResLicense}
                                    />
                                </Form.Group>
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
                                <Divider />
                                <Header as='h3'>Additional Information</Header>
                                <Form.Field>
                                    <label>Notes</label>
                                    <Form.TextArea
                                        name='notes'
                                        onChange={(e) => setProjNotes(e.target.value)}
                                        value={projNotes}
                                        placeholder='Enter additional notes here...'
                                    />
                                </Form.Field>
                            </Form>
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
                    {/* Manage Collaborators Modal */}
                    <Modal
                        open={showCollabsModal}
                        onClose={closeCollabsModal}
                    >
                        <Modal.Header>Manage Project Collaborators</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Form.Select
                                    label='Add Collaborator'
                                    options={[]}
                                />
                            </Form>
                            <Divider />
                            <List>
                            </List>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                onClick={closeCollabsModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Change Visibility Modal */}
                    <Modal
                        open={showVisModal}
                        onClose={closeVisModal}
                    >
                        <Modal.Header>Change Project Visibility</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <Form.Select
                                    fluid
                                    label={<label>Visibility <span className='muted-text'>(defaults to Private)</span></label>}
                                    selection
                                    options={visibilityOptions}
                                    value={projVisibility}
                                    onChange={(_e, { value }) => setProjVisibility(value)}
                                />
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeVisModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                icon
                                labelPosition='left'
                                color='green'
                                loading={visModalLoading}
                                onClick={submitVisChange}
                            >
                                <Icon name='save' />
                                Save
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectView;
