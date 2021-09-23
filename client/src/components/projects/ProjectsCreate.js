import './Projects.css';

import {
  Grid,
  Header,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Form,
  Breadcrumb
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';

import { isEmptyString } from '../util/HelperFunctions.js';

import {
    visibilityOptions,
    statusOptions
} from '../util/ProjectOptions.js';
import { licenseOptions } from '../util/LicenseOptions.js';

import useGlobalError from '../error/ErrorHooks.js';

const ProjectsCreate = (props) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    // UI
    const [tagOptions, setTagOptions] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [loadedTags, setLoadedTags] = useState(false);

    // Project Data
    const [projTitle, setProjTitle] = useState('');
    const [projVisibility, setProjVisibility] = useState('private');
    const [projStatus, setProjStatus] = useState('');
    const [projProgress, setProjProgress] = useState(0);
    const [projURL, setProjURL] = useState('');
    const [projTags, setProjTags] = useState([]);
    const [projResAuthor, setProjResAuthor] = useState('');
    const [projResEmail, setProjResEmail] = useState('');
    const [projResLicense, setProjResLicense] = useState('');
    const [projResURL, setProjResURL] = useState('');
    const [projNotes, setProjNotes] = useState('');

    // Form Errors
    const [projTitleErr, setProjTitleErr] = useState(false);
    const [projProgressErr, setProjProgressErr] = useState(false);


    /**
     * Set page title and load existing Project Tags
     * on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Create Project";
        getTags();
    }, []);


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
     * Reset all form error states
     */
    const resetFormErrors = () => {
        setProjTitleErr(false);
        setProjProgressErr(false);
    };


    /**
     * Validate the form data.
     * @return {Boolean} true if all fields valid, false otherwise.
     */
    const validateForm = () => {
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
     * data to the server via POST request. Redirects
     * page to Projects page or Project View page on
     * success.
     */
    const submitForm = () => {
        resetFormErrors();
        if (validateForm()) {
            setLoadingData(true);
            var projData = {
                title: projTitle
            };
            if (!isEmptyString(projVisibility)) projData.visibility = projVisibility;
            if (!isEmptyString(projStatus)) projData.status = projStatus;
            if (projProgress > 0) projData.progress = projProgress;
            if (!isEmptyString(projURL)) projData.projectURL = projURL;
            if (projTags.length > 0) projData.tags = projTags;
            if (!isEmptyString(projResAuthor)) projData.author = projResAuthor;
            if (!isEmptyString(projResEmail)) projData.authorEmail = projResEmail;
            if (!isEmptyString(projResLicense)) projData.license = projResLicense;
            if (!isEmptyString(projResURL)) projData.resourceURL = projResURL;
            if (!isEmptyString(projNotes)) projData.notes = projNotes;
            axios.post('/project', projData).then((res) => {
                if (!res.data.err) {
                    setLoadingData(false);
                    if (res.data.projectID) {
                        props.history.push(`/projects/${res.data.projectID}?projectCreated=true`);
                    } else {
                        props.history.push('/projects?projectCreated=true');
                    }
                } else {
                    handleGlobalError(res.data.errMsg);
                    setLoadingData(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setLoadingData(false);
            });
        }
    };


    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Create Project</Header>
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
                                    Create Project
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Message icon className='mb-2p'>
                                <Icon name='info circle' />
                                <Message.Content>
                                    <Message.Header>Note:</Message.Header>
                                    <p>Use this form to add a new or existing project that is not listed in Available Projects. Otherwise, visit the <Link to='/projects/available'>Available Projects list</Link> to select and start a new project.</p>
                                </Message.Content>
                            </Message>
                            <Form noValidate>
                                <Header as='h3'>Project Overview</Header>
                                <p><em>This project will be created within <strong>{org.name}</strong>. Collaborators can be added after creation.</em></p>
                                <Form.Group widths='equal'>
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
                                    <Form.Select
                                        fluid
                                        label={<label>Visibility <span className='muted-text'>(defaults to Private)</span></label>}
                                        placeholder='Visibility...'
                                        options={visibilityOptions}
                                        onChange={(_e, { value }) => setProjVisibility(value)}
                                        value={projVisibility}
                                    />
                                </Form.Group>
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
                                    <Form.Select
                                        fluid
                                        label={<label>Status <span className='muted-text'>(defaults to Open/In Progress)</span></label>}
                                        placeholder='Status...'
                                        options={statusOptions}
                                        onChange={(_e, { value }) => setProjStatus(value)}
                                        value={projStatus}
                                    />
                                </Form.Group>
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
                                    <Form.TextArea
                                        name='notes'
                                        onChange={(e) => setProjNotes(e.target.value)}
                                        value={projNotes}
                                        placeholder='Enter additional notes here...'
                                    />
                                </Form.Field>
                                <Button
                                    type='submit'
                                    color='green'
                                    fluid
                                    loading={loadingData}
                                    onClick={submitForm}
                                >
                                    <Icon name='add' />
                                    Create Project
                                </Button>
                            </Form>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectsCreate;
