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
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks.js';
import { isEmptyString } from '../util/HelperFunctions.js';
import { libraryOptions } from '../util/LibraryOptions.js';
import { purposeOptions } from '../util/AccountRequestOptions.js';

const AccountRequest = (props) => {

    // Global State and Error
    const location = useLocation();
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [showSuccessModal, setSuccessModal] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [showOpenCommons, setShowOpenCommons] = useState(false);

    // Form Data
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [purpose, setPurpose] = useState('');
    const [libs, setLibs] = useState([]);
    const [institution, setInstitution] = useState('');
    const [url, setURL] = useState('');
    const [moreInfo, setMoreInfo] = useState('');

    // Form Validation
    const [emailErr, setEmailErr] = useState(false);
    const [nameErr, setNameErr] = useState(false);
    const [purposeErr, setPurposeErr] = useState(false);
    const [libsErr, setLibsErr] = useState(false);
    const [instErr, setInstErr] = useState(false);
    const [urlErr, setURLErr] = useState(false);

    /**
     * Update page title.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Account Request";
    }, []);

    /**
     * Reads URL parameters and updates UI, if necessary.
     */
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const refSrc = urlParams.get('src');
        if (refSrc === 'commons') setShowOpenCommons(true);
    }, [location.search, setShowOpenCommons]);

    /** Form input handlers **/
    const onChange = (e) => {
        switch (e.target.id) {
            case 'email':
                setEmail(e.target.value);
                break;
            case 'name':
                setName(e.target.value);
                break;
            case 'institution':
                setInstitution(e.target.value);
                break;
            case 'url':
                setURL(e.target.value);
                break;
            default:
                break // silence React warning
        }
    };

    /**
     * Validate the form data.
     * @returns {Boolean} true if valid form, false otherwise.
     */
    const validateForm = () => {
        var valid = true;
        if (!user.isAuthenticated && isEmptyString(email)) {
            valid = false;
            setEmailErr(true);
        }
        if (!user.isAuthenticated && isEmptyString(name)) {
            valid = false;
            setNameErr(true);
        }
        if (isEmptyString(purpose)) {
            valid = false;
            setPurposeErr(true);
        }
        if (purpose === 'oer' && (!Array.isArray(libs) || libs.length < 1 || libs.length > 3)) {
            valid = false;
            setLibsErr(true);
        }
        if (isEmptyString(institution)) {
            valid = false;
            setInstErr(true);
        }
        if (isEmptyString(url)) {
            valid = false;
            setURLErr(true);
        }
        return valid;
    };

    /**
     * Resets all form error states.
     */
    const resetForm = () => {
        setEmailErr(false);
        setNameErr(false);
        setPurposeErr(false);
        setLibsErr(false);
        setInstErr(false);
        setURLErr(false);
    };

    /**
     * Submit data via POST to the server, then
     * open the Success Modal.
     */
    const onSubmit = () => {
        resetForm();
        if (validateForm()) {
            setLoadingData(true);
            let requestData = {
                email: email,
                name: name,
                institution: institution,
                purpose: purpose,
                facultyURL: url
            };
            if (purpose === 'oer') requestData.libraries = libs;
            if (moreInfo !== '' && moreInfo === 'true') requestData.moreInfo = true;
            else if (moreInfo !== '' && moreInfo === 'false') requestData.moreInfo = false;
            axios.post('/accountrequest', requestData).then((res) => {
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
     * Called when the Succes Modal is closed. Redirects user
     * to Home or main page.
     */
    const successModalClosed = () => {
        setSuccessModal(false);
        if (user.isAuthenticated) props.history.push('/home');
        else props.history.push('/');
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
                                <Header as='h1' textAlign='center'>Request Instructor Account(s)</Header>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column mobile={16} computer={10}>
                    <Segment raised className='mb-4r'>
                        {showOpenCommons && (
                            <Message icon info className='mb-2p'>
                                <Icon name='lock open' />
                                <Message.Content>
                                    <Message.Header>Conductor Is Open to All</Message.Header>
                                    <p>This form is for instructors to request accounts on <strong>LibreTexts libraries</strong>, the <strong>LibreStudio</strong>, and the <strong>ADAPT homework system</strong>. Conductor is open to all community members without explicit approval. To register for or log in to Conductor, <Link to='/login'>navigate here</Link>.</p>
                                </Message.Content>
                            </Message>
                        )}
                        <p className='text-center'>Instructor accounts are for instructors only. Please use your campus email address to facilitate verification of your instructor status. <em>Upon approval, you should receive a notification from LibreTexts Conductor. Login details for your requested service(s) will arrive separately. Please check your junk/spam folder if you do not receive them.</em></p>
                        <p className='text-center mt-2p'>Accounts are required to modify content on the LibreTexts libraries including editing pages, uploading content, creating new Course Shells, and remixing customized textbooks. Fill out and submit this form to request an Instructor account.</p>
                        {user.isAuthenticated &&
                            <Message icon positive className='mt-2p'>
                                <Icon name='user circle' />
                                <Message.Content>
                                    <Message.Header>Welcome, {user.firstName}</Message.Header>
                                    <p>Your Conductor name and email address will be used in this account request.</p>
                                </Message.Content>
                            </Message>
                        }
                        <Form onSubmit={onSubmit}>
                            {!user.isAuthenticated &&
                            <Form.Field required error={emailErr}>
                                <label htmlFor='email'>Email</label>
                                <Input
                                    fluid
                                    id='email'
                                    type='email'
                                    name='email'
                                    placeholder='Email...'
                                    value={email}
                                    onChange={onChange}
                                    icon='mail'
                                    iconPosition='left'
                                />
                            </Form.Field>
                            }
                            {!user.isAuthenticated &&
                                <Form.Field required error={nameErr}>
                                    <label htmlFor='name'>Name</label>
                                    <Input
                                        fluid
                                        id='name'
                                        type='text'
                                        name='name'
                                        placeholder='Name...'
                                        value={name}
                                        onChange={onChange}
                                        icon='user circle'
                                        iconPosition='left'
                                    />
                                </Form.Field>
                            }
                            <Form.Select
                                required
                                id='purpose'
                                fluid
                                label='What do you need accounts for?'
                                options={purposeOptions}
                                placeholder='Choose purpose...'
                                onChange={(_e, { value }) => setPurpose(value)}
                                value={purpose}
                                error={purposeErr}
                            />
                            {(purpose === 'oer') && (
                              <Form.Field>
                                <label htmlFor="library">
                                  {`Which libraries do you need accounts on? `}
                                  <span className="muted-text">Pick the library that best fits your needs. (min. 1, max. 3)</span>
                                </label>
                                <Form.Select
                                    required={purpose === 'oer'}
                                    id='library'
                                    fluid
                                    multiple
                                    options={libraryOptions}
                                    placeholder='Libraries...'
                                    onChange={(_e, { value }) => setLibs(value)}
                                    value={libs}
                                    error={libsErr}
                                />
                              </Form.Field>
                            )}
                            <Divider />
                            <Header as='h3'>Instructor Verification</Header>
                            <p>Anyone can access and read the full LibreTexts content: no account is necessary to access content. These accounts are only for instructors who needs to create custom textbooks for their class or who want to upload new content to the LibreTexts Libraries.</p>
                            <p>To verify instructor status you must provide a link to a web page showing your faculty status. Links to your institution's web page are NOT sufficient. A URL which shows that you are an instructor is needed. Please provide your complete name, department and status otherwise we will not approve your application.</p>
                            <Form.Field required error={instErr}>
                                <label htmlFor='institution'>Your Institution</label>
                                <Input
                                    fluid
                                    id='institution'
                                    type='text'
                                    name='institution'
                                    placeholder='Institution...'
                                    value={institution}
                                    onChange={onChange}
                                    icon='university'
                                    iconPosition='left'
                                />
                            </Form.Field>
                            <Form.Field required error={urlErr}>
                                <label htmlFor='url'>Link to your faculty entry on your institution's website (or other URL that shows your faculty status)</label>
                                <Input
                                    fluid
                                    id='url'
                                    type='text'
                                    name='url'
                                    placeholder='URL...'
                                    value={url}
                                    onChange={onChange}
                                    icon='compass'
                                    iconPosition='left'
                                />
                            </Form.Field>
                            <Form.Select
                                id='moreinfo'
                                fluid
                                label='Are you interested in more information about how your institution can become a member of the LibreNet?'
                                options={[
                                    { key: 'yes',   text: 'Yes',    value: 'true' },
                                    { key: 'no',    text: 'No',     value: 'false' }
                                ]}
                                placeholder='Choose...'
                                onChange={(_e, { value }) => setMoreInfo(value)}
                                value={moreInfo}
                            />
                            <Button
                                type='submit'
                                color='blue'
                                size='large'
                                fluid
                                loading={loadingData}
                                className='mt-4p'
                            >
                                Submit Request
                            </Button>
                        </Form>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
            {/* Success Modal */}
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

export default AccountRequest;
