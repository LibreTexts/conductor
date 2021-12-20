import {
    Grid,
    Segment,
    Button,
    Form,
    Input,
    Image,
    Modal,
    Header,
    Divider,
    Message,
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import date from 'date-and-time';

import ConductorDateInput from '../util/ConductorDateInput';

import useGlobalError from '../error/ErrorHooks.js';
import { isEmptyString } from '../util/HelperFunctions.js';
import { libraryOptions } from '../util/LibraryOptions.js';
import { licenseOptions } from '../util/LicenseOptions.js';
import { textUseOptions } from '../util/HarvestingMasterOptions.js';

const HarvestRequest = (props) => {

    // Global State and Error
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [showSuccessModal, setSuccessModal] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    // Form Data
    const [email, setEmail] = useState('');
    const [title, setTitle] = useState('');
    const [library, setLibrary] = useState('');
    const [url, setURL] = useState('');
    const [license, setLicense] = useState('');
    const [name, setName] = useState('');
    const [institution, setInstitution] = useState('');
    const [resourceUse, setResourceUse] = useState('');
    const [dateIntegrate, setDateIntegrate] = useState('');
    const [addToProject, setAddToProject] = useState(true);
    const [comments, setComments] = useState('');

    // Form Validation
    const [emailErr, setEmailErr] = useState(false);
    const [titleErr, setTitleErr] = useState(false);
    const [libErr, setLibErr] = useState(false);
    const [licErr, setLicErr] = useState(false);


    /**
     * Update page title.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Harvest Request";
    }, []);


    /** Form input handlers **/
    const onChange = (e) => {
        switch (e.target.id) {
            case 'email':
                setEmail(e.target.value);
                break;
            case 'title':
                setTitle(e.target.value);
                break;
            case 'url':
                setURL(e.target.value);
                break;
            case 'name':
                setName(e.target.value);
                break;
            case 'institution':
                setInstitution(e.target.value);
                break;
            case 'comments':
                setComments(e.target.value);
                break;
            default:
                break // silence React warning
        }
    };

    const handleLibChange = (_e, { value }) => {
        setLibrary(value);
    };

    const handleLicChange = (_e, { value }) => {
        setLicense(value);
    };

    const handleUseChange = (_e, { value }) => {
        setResourceUse(value);
    };

    const handleDateChange = (_e, { value }) => {
        setDateIntegrate(value);
    };


    /**
     * Validate the form data, return
     * 'true' if all fields are valid,
     * 'false' otherwise
     */
    const validateForm = () => { // returns true if form is ok
        var valid = true;
        if (!user.isAuthenticated && isEmptyString(email)) {
            valid = false;
            setEmailErr(true);
        }
        if (isEmptyString(title)) {
            valid = false;
            setTitleErr(true);
        }
        if (isEmptyString(library)) {
            valid = false;
            setLibErr(true);
        }
        if (isEmptyString(license)) {
            valid = false;
            setLicErr(true);
        }
        return valid;
    };


    /**
     * Reset all form error states.
     */
    const resetForm = () => { // resets all field errors
        setEmailErr(false);
        setTitleErr(false);
        setLibErr(false);
        setLicErr(false);
    };


    /**
     * Submit data via POST to the server, then
     * open the Success Modal.
     */
    const onSubmit = () => {
        resetForm();
        if (validateForm()) {
            setLoadingData(true);
            let dateString = '';
            if (dateIntegrate !== '') dateString = date.format(dateIntegrate, 'MM-DD-YYYY');
            const requestData = {
                email: email,
                title: title,
                library: library,
                url: url,
                license: license,
                name: name,
                institution: institution,
                resourceUse: resourceUse,
                dateIntegrate: dateString,
                comments: comments,
                addToProject: addToProject
            };
            axios.post('/harvestingrequest', requestData).then((res) => {
                if (!res.data.err) {
                    setSuccessModal(true);
                    setLoadingData(false);
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


    /**
     * Called when the Succes Modal
     * is closed. Redirects user
     * to home page.
     */
    const successModalClosed = () => {
        setSuccessModal(false);
        if (user.isAuthenticated) {
            props.history.push('/dashboard');
        } else {
            props.history.push('/');
        }
    };

    return(
        <Grid centered={true} verticalAlign='middle' className='component-container'>
            <Grid.Row>
                <Grid.Column>
                    <Grid verticalAlign='middle' centered={true}>
                        <Grid.Row>
                            <Grid.Column>
                                <Image
                                    src="/transparent_logo.png"
                                    size='medium'
                                    centered
                                    className='cursor-pointer'
                                    onClick={() => {
                                        window.open('https://libretexts.org', '_blank', 'noopener');
                                    }}
                                />
                                <Header as='h1' textAlign='center'>Request OER Integration</Header>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column mobile={16} computer={10}>
                    <Segment raised className='mb-4r'>
                        <p className='text-center'>If you want to request an existing openly licensed resource be integrated into a LibreTexts library, please fill out and submit this form. </p>
                        {user.isAuthenticated &&
                            <Message icon positive>
                                <Icon name='user circle' />
                                <Message.Content>
                                    <Message.Header>Welcome, {user.firstName}</Message.Header>
                                    <p>This integration request will be tied to your Conductor account.</p>
                                </Message.Content>
                            </Message>
                        }
                        {!user.isAuthenticated &&
                            <Message info>
                                <p>Are you a Conductor user? <Link to='/login?redirect_uri=%2Fharvestrequest'><strong>Log in</strong></Link> to have this request tied to your account so you can track its status!</p>
                            </Message>
                        }
                        <Form onSubmit={onSubmit}>
                            {!user.isAuthenticated &&
                                <Form.Field required error={emailErr}>
                                    <label htmlFor='email'>Email</label>
                                    <Input fluid={true} id='email' type='email' name='email' placeholder='Email' value={email} onChange={onChange} icon='mail' iconPosition='left' />
                                </Form.Field>
                            }
                            <Form.Field required error={titleErr}>
                                <label htmlFor='title'>Resource Title</label>
                                <Input fluid={true} id='title' type='text' name='title' placeholder='Title' value={title} onChange={onChange} icon='info circle' iconPosition='left' />
                            </Form.Field>
                            <Form.Select
                                required
                                id='library'
                                fluid
                                label='Library'
                                options={libraryOptions}
                                placeholder='Library...'
                                onChange={handleLibChange}
                                value={library}
                                error={libErr}
                            />
                            <Divider />
                            <Header as='h3'>Resource Format</Header>
                            <p>We can integrate OER content from nearly any format, although content in some formats requires more effort to integrate than others. If the requested resource exists online please enter the URL below. If the content format requires submiting a file to us, let us know in the comments and we'll contact you with more details. </p>
                            <Form.Field>
                                <label htmlFor='url'>URL</label>
                                <Input fluid={true} id='url' type='text' name='url' placeholder='URL' required={false} value={url} onChange={onChange} icon='compass' iconPosition='left' />
                            </Form.Field>
                            <Form.Select
                                required
                                id='license'
                                fluid
                                label='License'
                                options={licenseOptions}
                                placeholder='License...'
                                onChange={handleLicChange}
                                value={license}
                                error={licErr}
                            />
                            <Divider />
                            <Header as='h3'>Priority Integration</Header>
                            <p>We try to prioritize integrating OER texts that people are ready to adopt in their classes. If you would like to use this text in your class you can fill out this section for priority consideration.</p>
                            {!user.isAuthenticated &&
                                <Form.Field>
                                    <label htmlFor='name'>Your Name</label>
                                    <Input fluid={true} id='name' type='text' name='name' placeholder='Name' required={false} value={name} onChange={onChange} icon='user circle' iconPosition='left' />
                                </Form.Field>
                            }
                            <Form.Field>
                                <label htmlFor='institution'>Your Institution</label>
                                <Input fluid={true} id='institution' type='text' name='institution' placeholder='Institution' required={false} value={institution} onChange={onChange} icon='university' iconPosition='left' />
                            </Form.Field>
                            <Form.Select
                                id='resourceUse'
                                fluid
                                label='I would like to use this resource in my class:'
                                options={textUseOptions}
                                placeholder='Use...'
                                onChange={handleUseChange}
                                value={resourceUse}
                            />
                            <ConductorDateInput
                                value={dateIntegrate}
                                onChange={(value) => setDateIntegrate(value)}
                                label='Date integration has to be completed for adoption to be possible:*'
                                inlineLabel={false}
                                className='mr-2p'
                            />
                            <p>
                                *
                                <em>
                                    We try to integrate projects by the date they are needed but cannot guarantee this. If you have questions, you can always
                                    <a href='mailto:info@libretexts.org' target='_blank' rel='noopener noreferrer'> get in touch</a> with the LibreTexts team.
                                </em>
                            </p>
                            <Divider />
                            {user.isAuthenticated &&
                                <Form.Select
                                    id='addToProject'
                                    fluid
                                    label='Do you want to be added to the project to observe and/or participate in the harvesting efforts?'
                                    options={[
                                        { key: 'yes',   text: 'Yes',    value: true },
                                        { key: 'no',    text: 'No',     value: false }
                                    ]}
                                    placeholder='Choose...'
                                    onChange={(_e, { value }) => setAddToProject(value)}
                                    value={addToProject}
                                />
                            }
                            <Form.Field>
                                <label htmlFor='comments'>Comments</label>
                                <Input fluid={true} id='comments' type='text' name='comments' placeholder='Comments' required={false} value={comments} onChange={onChange} icon='comment alternate' iconPosition='left' />
                            </Form.Field>
                            <Button type='submit' color='blue' size='large' fluid={true} loading={loadingData}>Submit Request</Button>
                        </Form>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
            <Modal
                onClose={successModalClosed}
                open={showSuccessModal}
            >
                <Modal.Header>LibreTexts Conductor: Success</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>Successfully submitted your request! You will now be redirected to the main page.</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="blue" onClick={successModalClosed}>Okay</Button>
                </Modal.Actions>
            </Modal>
        </Grid>
    );
};

export default HarvestRequest;
