import { Grid, Segment, Button, Form, Input, Image, Modal, Header, Divider } from 'semantic-ui-react';
import { DateInput } from 'semantic-ui-calendar-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { isEmptyString } from '../util/HelperFunctions.js';

import {
    licenseOptions,
    textUseOptions,
    libraryOptions
} from '../util/HarvestingMasterOptions.js';

const HarvestRequest = (props) => {

    // UI
    const [showSuccessModal, setSuccessModal] = useState(false);
    const [showErrModal, setErrModal] = useState(false);
    const [errMsg, setErrMsg] = useState('');
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
    const [comments, setComments] = useState('');

    // Form Validation
    const [emailErr, setEmailErr] = useState(false);
    const [titleErr, setTitleErr] = useState(false);
    const [libErr, setLibErr] = useState(false);
    const [licErr, setLicErr] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Harvest Request";
    }, []);

    const modalClosed = (modalName) => {
        switch (modalName) {
            case 'success':
                setSuccessModal(false);
                props.history.push('/');
                break;
            case 'error':
                setErrMsg('');
                setErrModal(false);
                break;
            default:
                break // silence React warning
        }
    };

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

    const handleLibChange = (e, { value }) => {
        setLibrary(value);
    };

    const handleLicChange = (e, { value }) => {
        setLicense(value);
    };

    const handleUseChange = (e, { value }) => {
        setResourceUse(value);
    };

    const handleDateChange = (e, { value }) => {
        setDateIntegrate(value);
    };

    const validateForm = () => { // returns true if form is ok
        var valid = true;
        if (isEmptyString(email)) {
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

    const resetForm = () => { // resets all field errors
        setEmailErr(false);
        setTitleErr(false);
        setLibErr(false);
        setLicErr(false);
    };


    const handleErrModal = (err) => {
        var message = "";
        if (err.response) {
            if (err.response.data.errMsg !== undefined) {
                message = err.response.data.errMsg;
            } else {
                message = "Error processing request.";
            }
            if (err.response.data.errors) {
                if (err.response.data.errors.length > 0) {
                    message = message.replace(/\./g, ': ');
                    err.response.data.errors.forEach((elem, idx) => {
                        if (elem.param) {
                            message += (String(elem.param).charAt(0).toUpperCase() + String(elem.param).slice(1));
                            if ((idx + 1) !== err.response.data.errors.length) {
                                message += ", ";
                            } else {
                                message += ".";
                            }
                        }
                    });
                }
            }
        } else {
            message = err.toString();
        }
        setErrMsg(message);
        setErrModal(true);
    };

    const onSubmit = () => {
        resetForm();
        if (validateForm()) {
            setLoadingData(true);
            const requestData = {
                email: email,
                title: title,
                library: library,
                url: url,
                license: license,
                name: name,
                institution: institution,
                resourceUse: resourceUse,
                dateIntegrate: dateIntegrate,
                comments: comments
            };
            axios.post('/harvesting/request/new', requestData).then((res) => {
                if (!res.data.err) {
                    setSuccessModal(true);
                } else {
                    handleErrModal(res.data.errMsg);
                }
            }).catch((err) => {
                handleErrModal(err);
            });
            setLoadingData(false);
        }
    };

    return(
        <Grid centered={true} verticalAlign='middle' className='component-container'>
            <Grid.Row>
                <Grid.Column>
                    <Grid verticalAlign='middle' centered={true}>
                        <Grid.Row>
                            <Grid.Column>
                                <Image src="/transparent_logo.png" size='medium' centered/>
                                <Header as='h1' textAlign='center'>Request OER Integration</Header>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column mobile={16} computer={10}>
                    <Segment raised className='mb-4r'>
                        <p className='text-center'>If you want to request an existing openly licensed resource be integrated into a LibreTexts library please fill out and submit this form. </p>
                        <Form onSubmit={onSubmit}>
                            <Form.Field required error={emailErr}>
                                <label htmlFor='email'>Email</label>
                                <Input fluid={true} id='email' type='email' name='email' placeholder='Email' value={email} onChange={onChange} icon='mail' iconPosition='left' />
                            </Form.Field>
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
                            <p>We try to prioritize integrating OER texts that people are ready to adopt in their classes. If you would like to use this text in your class you can fill out this section for priority consideration (we cannot make promises).</p>
                            <Form.Field>
                                <label htmlFor='name'>Your Name</label>
                                <Input fluid={true} id='name' type='text' name='name' placeholder='Name' required={false} value={name} onChange={onChange} icon='user circle' iconPosition='left' />
                            </Form.Field>
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
                            <DateInput
                                name='dateIntegrate'
                                label='Date integration has to be completed for adoption to be possible:'
                                placeholder='Date...'
                                value={dateIntegrate}
                                iconPosition='left'
                                onChange={handleDateChange}
                                dateFormat='MM-DD-YYYY'
                                popupPosition='bottom center'
                            />
                            <Divider />
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
                onClose={() => { modalClosed('success') }}
                open={showSuccessModal}
            >
                <Modal.Header>LibreTexts Conductor: Success</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>Successfully submitted your request! You will now be redirected to the main page.</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="blue" onClick={() => { modalClosed('success') }}>Okay</Button>
                </Modal.Actions>
            </Modal>
            <Modal
                onClose={() => { modalClosed('error') }}
                open={showErrModal}
            >
                <Modal.Header>LibreTexts Conductor: Error</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>{errMsg}</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="black" onClick={() => { modalClosed('error') }}>Okay</Button>
                </Modal.Actions>
            </Modal>
        </Grid>
    );
};

export default HarvestRequest;
