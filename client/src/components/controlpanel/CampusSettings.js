import './ControlPanel.css';

import {
  Grid,
  Header,
  Segment,
  Icon,
  List,
  Breadcrumb,
  Form,
  Divider,
  Button,
  Popup
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import { isEmptyString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks.js';

const CampusSettings = () => {

    // Global State
    const { handleGlobalError } = useGlobalError();

    // UI
    const [loadedData, setLoadedData] = useState(false);
    const [savedData, setSavedData] = useState(false);

    // Data
    const [originalData, setOriginalData] = useState({});
    const [coverPhoto, setCoverPhoto] = useState('');
    const [coverPhotoErr, setCoverPhotoErr] = useState(false);
    const [largeLogo, setLargeLogo] = useState('');
    const [largeLogoErr, setLargeLogoErr] = useState(false);
    const [mediumLogo, setMediumLogo] = useState('');
    const [mediumLogoErr, setMediumLogoErr] = useState(false);
    const [smallLogo, setSmallLogo] = useState('');
    const [aboutLink, setAboutLink] = useState('');
    const [aboutLinkErr, setAboutLinkErr] = useState(false);
    const [commonsHeader, setCommonsHeader] = useState('');
    const [commonsMessage, setCommonsMessage] = useState('');

    /**
     * Set page title on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Campus Settings";
        getOrgInfo();
    }, []);


    const getOrgInfo = () => {
        setLoadedData(false);
        axios.get('/org/info', {
            params: {
                orgID: process.env.REACT_APP_ORG_ID
            }
        }).then((res) => {
            if (!res.data.err) {
                var orgData = res.data;
                delete orgData.err;
                setOriginalData(orgData);
                if (orgData.coverPhoto) setCoverPhoto(orgData.coverPhoto);
                if (orgData.largeLogo) setLargeLogo(orgData.largeLogo);
                if (orgData.mediumLogo) setMediumLogo(orgData.mediumLogo);
                if (orgData.smallLogo) setSmallLogo(orgData.smallLogo);
                if (orgData.aboutLink) setAboutLink(orgData.aboutLink);
                if (orgData.commonsHeader) setCommonsHeader(orgData.commonsHeader);
                if (orgData.commonsMessage) setCommonsMessage(orgData.commonsMessage);
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };


    const resetFormErrors = () => {
        setCoverPhotoErr(false);
        setLargeLogoErr(false);
        setMediumLogoErr(false);
        setAboutLinkErr(false);
    };


    const validateForm = () => {
        var validForm = true;
        if (isEmptyString(coverPhoto)) {
            validForm = false;
            setCoverPhotoErr(true);
        }
        if (isEmptyString(largeLogo)) {
            validForm = false;
            setLargeLogoErr(true);
        }
        if (isEmptyString(mediumLogo)) {
            validForm = false;
            setMediumLogoErr(true);
        }
        if (isEmptyString(aboutLink)) {
            validForm = false;
            setAboutLinkErr(true);
        }
        return validForm;
    };


    const saveChanges = () => {
        resetFormErrors();
        if (validateForm()) {
            setLoadedData(false);
            var newData = {};
            if (originalData.coverPhoto !== coverPhoto) newData.coverPhoto = coverPhoto;
            if (originalData.largeLogo !== largeLogo) newData.largeLogo = largeLogo;
            if (originalData.mediumLogo !== mediumLogo) newData.mediumLogo = mediumLogo;
            if (originalData.smallLogo !== smallLogo) newData.smallLogo = smallLogo;
            if (originalData.aboutLink !== aboutLink) newData.aboutLink = aboutLink;
            if (originalData.commonsHeader !== commonsHeader) newData.commonsHeader = commonsHeader;
            if (originalData.commonsMessage !== commonsMessage) newData.commonsMessage = commonsMessage;
            axios.put('').then((res) => {
                if (!res.data.err) {
                    getOrgInfo();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setLoadedData(true);
                setSavedData(true);
            }).catch((err) => {
                handleGlobalError(err);
                setLoadedData(true);
            });
        }
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Campus Settings</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/controlpanel'>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Campus Settings
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment raised>
                            <h3>Branding Images</h3>
                            <Form noValidate>
                                <Form.Field
                                    required
                                >
                                    <label htmlFor='campusCover'>
                                        <span>Campus Cover Photo </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A <em>download link</em> to the organization's large cover photo, displayed on the Campus Commons jumbotron. Dimensions should be <em>at least</em> 1920x1080. <em>Organization logos should not be used as the Cover Photo.</em>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusCover'
                                        type='url'
                                        value={coverPhoto}
                                    />
                                </Form.Field>
                                <Form.Field
                                    required
                                >
                                    <label htmlFor='campusLarge'>
                                        <span>Campus Large Logo </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A <em>download link</em> to the organization's main/large logo. This is typically an extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens.
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusLarge'
                                        type='url'
                                        value={largeLogo}
                                    />
                                </Form.Field>
                                <Form.Field
                                    required
                                >
                                    <label htmlFor='campusMedium'>
                                        <span>Campus Medium Logo </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A <em>download link</em> to the organization's medium-sized logo. This is typically a standard, non-extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens. <em>If the organization does not have distinct large/medium logos, the same logo can be used for both.</em>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusMedium'
                                        type='url'
                                        value={mediumLogo}
                                    />
                                </Form.Field>
                                <Form.Field>
                                    <label htmlFor='campusSmall'>
                                        <span>Campus Small Logo </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A <em>download link</em> to the organization's smallest logo. This is typically the same style used for favicons or simplified communications branding. Logo should preferably have a transparent background. Dimensions should be approximately 800x800. <em>The Small Logo is not currently implemented in any portion of Commons or Conductor, but has been provisioned for possible future customizations.</em>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusSmall'
                                        type='url'
                                        value={smallLogo}
                                    />
                                </Form.Field>
                                <Divider />
                                <h3>Branding Links</h3>
                                <Form.Field
                                    required
                                >
                                    <label htmlFor='campusAbout'>
                                        <span>About Link </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A standard link to the organization's About page, or the main page if one is not provisioned.
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusAbout'
                                        type='url'
                                        value={aboutLink}
                                    />
                                </Form.Field>
                                <Divider />
                                <h3>Branding Text</h3>
                                <Form.Field>
                                    <label htmlFor='campusCommonsHeader'>
                                        <span>Campus Commons Header </span>
                                        <Popup
                                            content={
                                                <span>
                                                    An emphasized string of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is not required.</strong>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusCommonsHeader'
                                        type='text'
                                        value={commonsHeader}
                                    />
                                </Form.Field>
                                <Form.Field>
                                    <label htmlFor='campusCommonsMessage'>
                                        <span>Campus Commons Message </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A block of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is not required.</strong>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusCommonsMessage'
                                        type='text'
                                        value={commonsMessage}
                                    />
                                </Form.Field>
                            </Form>
                            <Button
                                color='green'
                                className='mt-2p'
                                fluid
                            >
                                <Icon name={savedData ? 'check' : 'save'} />
                                {!savedData && <span>Save Changes</span>}
                            </Button>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default CampusSettings;
