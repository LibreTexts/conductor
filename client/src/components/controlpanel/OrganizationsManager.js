import './ControlPanel.css';

import {
  Grid,
  Header,
  Segment,
  Form,
  Table,
  Modal,
  Button,
  Dropdown,
  Icon,
  Pagination,
  Input,
  Breadcrumb,
  Popup,
  Divider
} from 'semantic-ui-react';
import { ChromePicker } from 'react-color';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

import {
    isEmptyString,
} from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const OrganizationsManager = () => {

    // Global State
    const { handleGlobalError } = useGlobalError();

    // Data
    const [orgs, setOrgs] = useState([]);
    const [displayOrgs, setDisplayOrgs] = useState([]);
    const [pageOrgs, setPageOrgs] = useState([]);

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('name');

    // Edit Organization Modal
    const [showEditOrgModal, setShowEditOrgModal] = useState(false);
    const [editOrgID, setEditOrgID] = useState('');
    const [editOrgOriginalData, setEditOrgOriginalData] = useState({});
    const [editOrgCoverPhoto, setEditOrgCoverPhoto] = useState('');
    const [editOrgCoverPhotoErr, setEditOrgCoverPhotoErr] = useState(false);
    const [editOrgLargeLogo, setEditOrgLargeLogo] = useState('');
    const [editOrgLargeLogoErr, setEditOrgLargeLogoErr] = useState(false);
    const [editOrgMediumLogo, setEditOrgMediumLogo] = useState('');
    const [editOrgMediumLogoErr, setEditOrgMediumLogoErr] = useState(false);
    const [editOrgSmallLogo, setEditOrgSmallLogo] = useState('');
    const [editOrgAboutLink, setEditOrgAboutLink] = useState('');
    const [editOrgAboutLinkErr, setEditOrgAboutLinkErr] = useState(false);
    const [editOrgCommonsHeader, setEditOrgCommonsHeader] = useState('');
    const [editOrgCommonsMessage, setEditOrgCommonsMessage] = useState('');
    const [editOrgLoading, setEditOrgLoading] = useState(false);

    const sortOptions = [
        { key: 'name', text: 'Sort by Name', value: 'name' },
    ];


    /**
     * Set page title and retrieve organizations
     * on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Organizations Manager";
        getOrganizations();
    }, []);


    /**
     * Track changes to the number of collections loaded
     * and the selected itemsPerPage and update the
     * set of collections to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(displayOrgs.length/itemsPerPage));
        setPageOrgs(displayOrgs.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayOrgs, activePage]);


    /**
     * Filter and sort organizations according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortOrgs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgs, searchString, sortChoice]);


    /**
     * Retrieve all organizations via GET request
     * to the server.
     */
    const getOrganizations = () => {
        axios.get('/orgs').then((res) => {
            if (!res.data.err) {
                if (res.data.orgs && Array.isArray(res.data.orgs)) {
                    setOrgs(res.data.orgs);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };


    /**
     * Filter and sort collections according
     * to current filters and sort
     * choice.
     */
    const filterAndSortOrgs = () => {
        setLoadedData(false);
        let filtered = orgs.filter((org) => {
            var include = true;
            var descripString = String(org.name).toLowerCase() + String(org.shortName).toLowerCase()
                                + String(org.abbreviation).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return org;
            } else {
                return false;
            }
        });
        if (sortChoice === 'name') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.name).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.name).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayOrgs(sorted);
        }
        setLoadedData(true);
    };


    /**
     * Reset all Edit Organization
     * form errors.
     */
    const resetFormErrors = () => {
        setEditOrgCoverPhotoErr(false);
        setEditOrgLargeLogoErr(false);
        setEditOrgMediumLogoErr(false);
        setEditOrgAboutLinkErr(false);
    };


    /**
     * Validate the Edit Organization form,
     * return true if no errors, false
     * otherwise.
     */
    const validateForm = () => {
        var validForm = true;
        if (isEmptyString(editOrgCoverPhoto)) {
            validForm = false;
            setEditOrgCoverPhotoErr(true);
        }
        if (isEmptyString(editOrgLargeLogo)) {
            validForm = false;
            setEditOrgLargeLogoErr(true);
        }
        if (isEmptyString(editOrgMediumLogo)) {
            validForm = false;
            setEditOrgMediumLogoErr(true);
        }
        if (isEmptyString(editOrgAboutLink)) {
            validForm = false;
            setEditOrgAboutLinkErr(true);
        }
        return validForm;
    };


    /**
     * Validate the Edit Organization form,
     * then submit changes (if any) via PUT
     * request to the server, then re-sync
     * Organizations info.
     */
    const saveChanges = () => {
        resetFormErrors();
        if (validateForm()) {
            setEditOrgLoading(true);
            var newData = {
                orgID: editOrgID
            };
            if (editOrgOriginalData.coverPhoto !== editOrgCoverPhoto) newData.coverPhoto = editOrgCoverPhoto;
            if (editOrgOriginalData.largeLogo !== editOrgLargeLogo) newData.largeLogo = editOrgLargeLogo;
            if (editOrgOriginalData.mediumLogo !== editOrgMediumLogo) newData.mediumLogo = editOrgMediumLogo;
            if (editOrgOriginalData.smallLogo !== editOrgSmallLogo) newData.smallLogo = editOrgSmallLogo;
            if (editOrgOriginalData.aboutLink !== editOrgAboutLink) newData.aboutLink = editOrgAboutLink;
            if (editOrgOriginalData.commonsHeader !== editOrgCommonsHeader) newData.commonsHeader = editOrgCommonsHeader;
            if (editOrgOriginalData.commonsMessage !== editOrgCommonsMessage) newData.commonsMessage = editOrgCommonsMessage;
            if (Object.keys(newData).length > 1) {
                axios.put('/org/info', newData).then((res) => {
                    if (!res.data.err) {
                        closeEditOrgModal();
                        getOrganizations();
                    } else {
                        handleGlobalError(res.data.errMsg);
                        setEditOrgLoading(false);
                    }
                }).catch((err) => {
                    handleGlobalError(err);
                    setEditOrgLoading(false);
                });
            } else {
                closeEditOrgModal();
            }
        }
    };


    /**
     * Open the Edit Organization Modal
     * in the context of @orgData and
     * set all fields to their respective
     * values.
     */
    const openEditOrgModal = (orgData) => {
        setEditOrgLoading(false);
        resetFormErrors();
        setEditOrgID(orgData.orgID);
        setEditOrgOriginalData(orgData);
        if (orgData.coverPhoto) setEditOrgCoverPhoto(orgData.coverPhoto);
        if (orgData.largeLogo) setEditOrgLargeLogo(orgData.largeLogo);
        if (orgData.mediumLogo) setEditOrgMediumLogo(orgData.mediumLogo);
        if (orgData.smallLogo) setEditOrgSmallLogo(orgData.smallLogo);
        if (orgData.aboutLink) setEditOrgAboutLink(orgData.aboutLink);
        if (orgData.commonsHeader) setEditOrgCommonsHeader(orgData.commonsHeader);
        if (orgData.commonsMessage) setEditOrgCommonsMessage(orgData.commonsMessage);
        setShowEditOrgModal(true);
    };


    /**
     * Close the Edit Organization Modal
     * and reset all fields to their
     * default values.
     */
    const closeEditOrgModal = () => {
        setShowEditOrgModal(false);
        resetFormErrors();
        setEditOrgID('');
        setEditOrgCoverPhoto('');
        setEditOrgLargeLogo('');
        setEditOrgMediumLogo('');
        setEditOrgSmallLogo('');
        setEditOrgAboutLink('');
        setEditOrgCommonsHeader('');
        setEditOrgCommonsMessage('');
        setEditOrgLoading(false);
    };


    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Organizations Manager</Header>
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
                                    Organizations Manager
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <Dropdown
                                        placeholder='Sort by...'
                                        floating
                                        selection
                                        button
                                        options={sortOptions}
                                        onChange={(_e, { value }) => { setSortChoice(value) }}
                                        value={sortChoice}
                                    />

                                </div>
                                <div className='right-flex'>
                                    <Input
                                        icon='search'
                                        iconPosition='left'
                                        placeholder='Search results...'
                                        onChange={(e) => { setSearchString(e.target.value) }}
                                        value={searchString}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        className='commons-content-pagemenu-dropdown'
                                        selection
                                        options={itemsPerPageOptions}
                                        onChange={(_e, { value }) => {
                                            setItemsPerPage(value);
                                        }}
                                        value={itemsPerPage}
                                    />
                                    <span> items per page of <strong>{Number(orgs.length).toLocaleString()}</strong> results.</span>
                                </div>
                                <div className='right-flex'>
                                    <Pagination
                                        activePage={activePage}
                                        totalPages={totalPages}
                                        firstItem={null}
                                        lastItem={null}
                                        onPageChange={(_e, data) => {
                                            setActivePage(data.activePage)
                                        }}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment loading={!loadedData}>
                            <Table striped fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell colSpan={3}>
                                            {(sortChoice === 'name')
                                                ? <span><em>Organization Name</em></span>
                                                : <span>Organization Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Actions</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageOrgs.length > 0) &&
                                        pageOrgs.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell colSpan={3}>
                                                        <p><strong>{item.name}</strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button
                                                            color='blue'
                                                            fluid
                                                            onClick={() => openEditOrgModal(item) }
                                                        >
                                                            <Icon name='edit' />
                                                            Edit Organization Details
                                                        </Button>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageOrgs.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={4}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    <Modal
                        open={showEditOrgModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Edit Organization Details</Modal.Header>
                        <Modal.Content>
                            <Form noValidate>
                                <h4>Branding Images</h4>
                                <Form.Field
                                    required
                                    error={editOrgCoverPhotoErr}
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
                                        onChange={(e) => setEditOrgCoverPhoto(e.target.value)}
                                        value={editOrgCoverPhoto}
                                    />
                                </Form.Field>
                                <Form.Field
                                    required
                                    error={editOrgLargeLogoErr}
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
                                        onChange={(e) => setEditOrgLargeLogo(e.target.value)}
                                        value={editOrgLargeLogo}
                                    />
                                </Form.Field>
                                <Form.Field
                                    required
                                    error={editOrgMediumLogoErr}
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
                                        onChange={(e) => setEditOrgMediumLogo(e.target.value)}
                                        value={editOrgMediumLogo}
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
                                        onChange={(e) => setEditOrgSmallLogo(e.target.value)}
                                        value={editOrgSmallLogo}
                                    />
                                </Form.Field>
                                <Divider />
                                <h4>Branding Links</h4>
                                <Form.Field
                                    required
                                    error={editOrgAboutLinkErr}
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
                                        onChange={(e) => setEditOrgAboutLink(e.target.value)}
                                        value={editOrgAboutLink}
                                    />
                                </Form.Field>
                                <Divider />
                                <h4>Branding Text</h4>
                                <Form.Field>
                                    <label htmlFor='campusCommonsHeader'>
                                        <span>Campus Commons Header </span>
                                        <Popup
                                            content={
                                                <span>
                                                    An emphasized string of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is optional.</strong>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusCommonsHeader'
                                        type='text'
                                        onChange={(e) => setEditOrgCommonsHeader(e.target.value)}
                                        value={editOrgCommonsHeader}
                                    />
                                </Form.Field>
                                <Form.Field>
                                    <label htmlFor='campusCommonsMessage'>
                                        <span>Campus Commons Message </span>
                                        <Popup
                                            content={
                                                <span>
                                                    A block of text placed at the top of the Catalog Search interface, used to welcome users to the Campus Commons. <strong>This text is optional.</strong>
                                                </span>
                                            }
                                            trigger={<Icon name='info circle' />}
                                        />
                                    </label>
                                    <Form.Input
                                        id='campusCommonsMessage'
                                        type='text'
                                        onChange={(e) => setEditOrgCommonsMessage(e.target.value)}
                                        value={editOrgCommonsMessage}
                                    />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeEditOrgModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                icon
                                labelPosition='left'
                                loading={editOrgLoading}
                                onClick={saveChanges}
                            >
                                <Icon name='save' />
                                Save
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default OrganizationsManager;
