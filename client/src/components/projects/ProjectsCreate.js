import './ProjectsPortal.css';

import {
  Grid,
  Header,
  Menu,
  Input,
  Segment,
  Divider,
  Message,
  Icon,
  Button,
  Table,
  Loader,
  Form
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
//import axios from 'axios';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import queryString from 'query-string';

import { isEmptyString } from '../util/HelperFunctions.js';

import { visibilityOptions } from '../util/ProjectOptions.js';
import { licenseOptions } from '../util/HarvestingMasterOptions.js';

const ProjectsCreate = (props) => {

    // Global State
    const org = useSelector((state) => state.org);

    // UI

    // Project Data
    const [projTitle, setProjTitle] = useState('');
    const [projVisibility, setProjVisibility] = useState('');
    const [projProgress, setProjProgress] = useState(0);
    const [projURL, setProjURL] = useState('');
    const [projTags, setProjTags] = useState([]);
    const [projResAuthor, setProjResAuthor] = useState('');
    const [projResLicense, setProjResLicense] = useState('');
    const [projResURL, setProjResURL] = useState('');
    const [projNotes, setProjNotes] = useState('');

    // Form Errors
    const [projTitleErr, setProjTitleErr] = useState(false);
    const [projProgressErr, setProjProgressErr] = useState(false);


    useEffect(() => {
        document.title = "LibreTexts Conductor | Projects | Add Existing";
        date.plugin(ordinal);
    }, []);

    useEffect(() => {
        console.log(org);
    }, [org]);

    const resetFormErrors = () => {
        setProjTitleErr(false);
        setProjProgressErr(false);
    };

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

    const submitForm = () => {
        resetFormErrors();
        if (validateForm()) {

        }
    };

    return(
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Projects</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment>
                        <Link to='/projects'>
                            <Button color='blue' basic>
                                <Button.Content>
                                    <Icon name='arrow left' />
                                    Back to Projects
                                </Button.Content>
                            </Button>
                        </Link>
                        <Divider />
                        <Segment basic className='component-innercontainer'>
                            <Header as='h2' className='formheader'>Create Project</Header>
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
                                            onChange={(e) => { setProjTitle(e.target.value) }}
                                            value={projTitle}
                                        />
                                    </Form.Field>
                                    <Form.Select
                                        fluid
                                        label={<label>Visibility <span className='muted-text'>(defaults to private)</span></label>}
                                        placeholder='Visibility...'
                                        options={visibilityOptions}
                                        onChange={(e, { value }) => { setProjVisibility(value) }}
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
                                            onChange={(e) => { setProjProgress(e.target.value) }}
                                            value={projProgress}
                                        />
                                    </Form.Field>
                                    <Form.Field>
                                        <label>Project URL <span className='muted-text'>(if applicable)</span></label>
                                        <Form.Input
                                            name='projectURL'
                                            type='url'
                                            placeholder='Enter project URL...'
                                            onChange={(e) => { setProjURL(e.target.value) }}
                                            value={projURL}
                                        />
                                    </Form.Field>
                                </Form.Group>
                                    <Form.Dropdown
                                        label='Project Tags'
                                        placeholder='Search tags...'
                                        multiple
                                        search
                                        selection
                                        options={[
                                            { key: 'empty', text: 'Clear...', value: ''}
                                        ]}
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
                                            onChange={(e) => { setProjResAuthor(e.target.value) }}
                                            value={projResAuthor}
                                        />
                                    </Form.Field>
                                    <Form.Select
                                        fluid
                                        label='License'
                                        placeholder='License...'
                                        options={licenseOptions}
                                    />
                                </Form.Group>
                                <Form.Field>
                                    <label>Original URL</label>
                                    <Form.Input
                                        name='resourceURL'
                                        type='url'
                                        placeholder='Enter resource URL...'
                                        onChange={(e) => { setProjResURL(e.target.value) }}
                                        value={projResURL}
                                    />
                                </Form.Field>
                                <Divider />
                                <Header as='h3'>Additional Information</Header>
                                <Form.Field>
                                    <label>Notes</label>
                                    <Form.TextArea
                                        name='notes'
                                        onChange={(e) => { setProjNotes(e.target.value) }}
                                        value={projNotes}
                                        placeholder='Enter additional notes here...'
                                    />
                                </Form.Field>
                                <Button
                                    type='submit'
                                    color='green'
                                    className='button-float-right'
                                >
                                    Create Project
                                </Button>
                            </Form>
                        </Segment>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );

};

export default ProjectsCreate;
