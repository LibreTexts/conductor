import { Grid, Segment, Button, Form, Input, Image, Modal, Message, Header, Divider } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import queryString from 'query-string';

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

    useEffect(() => {
        document.title = "LibreTexts Conductor | Harvest Request";
    }, []);

    const modalClosed = (modalName) => {
        switch (modalName) {
            case 'success':
                setSuccessModal(false);
                break;
            case 'error':
                setErrMsg('');
                setErrModal(false);
                break;
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
            case 'library':
                setLibrary(e.target.value);
                break;
            case 'url':
                setURL(e.target.value);
                break;
            case 'license':
                setLicense(e.target.value);
                break;
            case 'name':
                setName(e.target.value);
                break;
            case 'institution':
                setInstitution(e.target.value);
                break;
            case 'resourceUse':
                setResourceUse(e.target.value);
                break;
            case 'comments':
                setComments(e.target.value);
                break;
        }
    };

    const onSubmit = () => {
        console.log("Submit");
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
                    <Segment raised>
                        <p className='text-center'>If you want to request an existing openly licensed resource be integrated into a LibreTexts library please fill out and submit this form. </p>
                        <Form onSubmit={onSubmit}>
                            <Form.Field>
                                <label htmlFor='email'>Email</label>
                                <Input fluid={true} id='email' type='email' name='email' placeholder='Email' required={true} value={email} onChange={onChange} icon='mail' iconPosition='left' />
                            </Form.Field>
                            <Form.Field>
                                <label htmlFor='title'>Resource Title</label>
                                <Input fluid={true} id='title' type='text' name='title' placeholder='Title' required={true} value={title} onChange={onChange} icon='info circle' iconPosition='left' />
                            </Form.Field>
                            <Form.Select
                                id='library'
                                fluid
                                label='Library'
                                options={libraryOptions}
                                placeholder='Library...'
                                onChange={onChange}
                                value={library}
                            />
                            <Divider />
                            <Header as='h3'>Resource Format</Header>
                            <p>We can integrate OER content from nearly any format, although content in some formats requires more effort to integrate than others. If the requested resource exists online please enter the URL below. If the content format requires submiting a file to us, let us know in the comments and we'll contact you with more details. </p>
                            <Form.Field>
                                <label htmlFor='url'>URL</label>
                                <Input fluid={true} id='url' type='url' name='url' placeholder='URL' required={false} value={url} onChange={onChange} icon='compass' iconPosition='left' />
                            </Form.Field>
                            <Form.Select
                                id='license'
                                fluid
                                label='License'
                                options={licenseOptions}
                                placeholder='License...'
                                onChange={onChange}
                                value={license}
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
                                onChange={onChange}
                                value={resourceUse}
                            />
                            <Header as='h5'>Date integration has to be completed for adoption to be possible:</Header>
                            <Form.Group widths='equal'>
                                <Form.Field>
                                    <label>Month</label>
                                    <Input fluid={true} type='number' placeholder='Month'/>
                                </Form.Field>
                                <Form.Field>
                                    <label>Day</label>
                                    <Input fluid={true} type='number' placeholder='Day'/>
                                </Form.Field>
                                <Form.Field>
                                    <label>Year</label>
                                    <Input fluid={true} type='number' placeholder='Year'/>
                                </Form.Field>
                            </Form.Group>
                            <Divider />
                            <Form.Field>
                                <label htmlFor='comments'>Comments</label>
                                <Input fluid={true} id='comments' type='text' name='comments' placeholder='Comments' required={false} value={comments} onChange={onChange} icon='comment alternate' iconPosition='left' />
                            </Form.Field>
                            <Button type='submit' color='blue' size='large' fluid={true}>Submit Request</Button>
                        </Form>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
            <Modal
                onClose={() => { modalClosed('success') }}
                open={showErrModal}
            >
                <Modal.Header>LibreTexts Conductor: Success</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>Successfully submitted your request!</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="black" onClick={() => { modalClosed('success') }}>Okay</Button>
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
