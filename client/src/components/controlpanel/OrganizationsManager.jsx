import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Breadcrumb,
  Button,
  Divider,
  Dropdown,
  Form,
  Grid,
  Header,
  Icon,
  Input,
  Message,
  Modal,
  Pagination,
  Popup,
  Segment,
  Table,
} from 'semantic-ui-react';
import { isEmptyString } from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks';
import './ControlPanel.css';

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
  const [editOrgAddToGrid, setEditOrgAddToGrid] = useState(false);
  const [editOrgCoverPhoto, setEditOrgCoverPhoto] = useState('');
  const [editOrgLargeLogo, setEditOrgLargeLogo] = useState('');
  const [editOrgMediumLogo, setEditOrgMediumLogo] = useState('');
  const [editOrgSmallLogo, setEditOrgSmallLogo] = useState('');
  const [editOrgAboutLink, setEditOrgAboutLink] = useState('');
  const [editOrgAboutLinkErr, setEditOrgAboutLinkErr] = useState(false);
  const [editOrgCommonsHeader, setEditOrgCommonsHeader] = useState('');
  const [editOrgCommonsMessage, setEditOrgCommonsMessage] = useState('');
  const [editOrgCatalogMatchingTags, setEditOrgCatalogMatchingTags] = useState([]);
  const [editOrgLoading, setEditOrgLoading] = useState(false);

  // Asset Uploads
  const coverPhotoRef = useRef(null);
  const [coverPhotoLoading, setCoverPhotoLoading] = useState(false);
  const [coverPhotoUploaded, setCoverPhotoUploaded] = useState(false);
  const largeLogoRef = useRef(null);
  const [largeLogoLoading, setLargeLogoLoading] = useState(false);
  const [largeLogoUploaded, setLargeLogoUploaded] = useState(false);
  const mediumLogoRef = useRef(null);
  const [mediumLogoLoading, setMediumLogoLoading] = useState(false);
  const [mediumLogoUploaded, setMediumLogoUploaded] = useState(false);
  const smallLogoRef = useRef(null);
  const [smallLogoLoading, setSmallLogoLoading] = useState(false);
  const [smallLogoUploaded, setSmallLogoUploaded] = useState(false);

  const sortOptions = [
    { key: 'name', text: 'Sort by Name', value: 'name' },
  ];

  /**
  * Retrieve all organizations via GET request
  * to the server.
  */
  const getOrganizations = useCallback(async () => {
    try {
      const orgsRes = await axios.get('/orgs');
      if (!orgsRes.data.err) {
        if (orgsRes.data.orgs && Array.isArray(orgsRes.data.orgs)) {
          setOrgs(orgsRes.data.orgs);
        }
      } else {
        handleGlobalError(orgsRes.data.errMsg);
      }
      setLoadedData(true);
    } catch (err) {
      handleGlobalError(err);
      setLoadedData(true);
    }
  }, [setOrgs, setLoadedData, handleGlobalError]);

  /**
   * Set page title and retrieve organizations
   * on initial load.
   */
  useEffect(() => {
    document.title = "LibreTexts Conductor | Organizations Manager";
    getOrganizations();
  }, [getOrganizations]);

  /**
   * Track changes to the number of collections loaded
   * and the selected itemsPerPage and update the
   * set of collections to display.
   */
  useEffect(() => {
    setTotalPages(Math.ceil(displayOrgs.length / itemsPerPage));
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
   * Filter and sort collections according
   * to current filters and sort
   * choice.
   */
  function filterAndSortOrgs() {
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
  function resetFormErrors() {
    setEditOrgAboutLinkErr(false);
  };


  /**
   * Validate the Edit Organization form,
   * return true if no errors, false
   * otherwise.
   */
  function validateForm() {
    let validForm = true;
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
  async function saveChanges() {
    resetFormErrors();
    if (validateForm()) {
      setEditOrgLoading(true);
      let newData = {
        catalogMatchingTags: editOrgCatalogMatchingTags.reduce((acc, curr) => {
          if (curr.value && !acc.includes(curr.value)) {
            acc.push(curr.value);
          }
          return acc;
        }, []),
      };
      if (editOrgOriginalData.aboutLink !== editOrgAboutLink) newData.aboutLink = editOrgAboutLink;
      if (editOrgOriginalData.commonsHeader !== editOrgCommonsHeader) newData.commonsHeader = editOrgCommonsHeader;
      if (editOrgOriginalData.commonsMessage !== editOrgCommonsMessage) newData.commonsMessage = editOrgCommonsMessage;
      if (editOrgID !== 'libretexts' && editOrgOriginalData.addToLibreGridList !== editOrgAddToGrid) {
        newData.addToLibreGridList = editOrgAddToGrid;
      }
      try {
        const res = await axios.put(`/org/${editOrgID}`, newData);
        if (!res.data.err) {
          closeEditOrgModal();
          getOrganizations();
        } else {
          handleGlobalError(res.data.errMsg);
          setEditOrgLoading(false);
        }
      } catch (err) {
        handleGlobalError(err);
        setEditOrgLoading(false);
      }
    }
  };


  /**
   * Open the Edit Organization Modal
   * in the context of @orgData and
   * set all fields to their respective
   * values.
   */
  function openEditOrgModal(orgData) {
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
    if (orgData.addToLibreGridList) setEditOrgAddToGrid(orgData.addToLibreGridList);
    if (Array.isArray(orgData.catalogMatchingTags) && orgData.catalogMatchingTags.length > 0) {
      setEditOrgCatalogMatchingTags(orgData.catalogMatchingTags.map((tag) => ({
        key: crypto.randomUUID(),
        value: tag,
      })));
    }
    setShowEditOrgModal(true);
  };


  /**
   * Close the Edit Organization Modal
   * and reset all fields to their
   * default values.
   */
  function closeEditOrgModal() {
    setShowEditOrgModal(false);
    resetFormErrors();
    setEditOrgID('');
    setEditOrgAddToGrid(false);
    setEditOrgCoverPhoto('');
    setEditOrgLargeLogo('');
    setEditOrgMediumLogo('');
    setEditOrgSmallLogo('');
    setEditOrgAboutLink('');
    setEditOrgCommonsHeader('');
    setEditOrgCommonsMessage('');
    setEditOrgCatalogMatchingTags([]);
    setEditOrgLoading(false);
    setCoverPhotoLoading(false);
    setCoverPhotoUploaded(false);
    setLargeLogoLoading(false);
    setLargeLogoUploaded(false);
    setMediumLogoLoading(false);
    setMediumLogoUploaded(false);
    setSmallLogoLoading(false);
    setSmallLogoUploaded(false);
  };

  /**
   * Activates the Cover Photo file input selector.
   */
  function handleUploadCoverPhoto() {
    if (coverPhotoRef.current) {
      coverPhotoRef.current.click();
    }
  }

  /**
   * Activates the Large Logo file input selector.
   */
  function handleUploadLargeLogo() {
    if (largeLogoRef.current) {
      largeLogoRef.current.click();
    }
  }

  /**
   * Activates the Medium Logo file input selector.
   */
  function handleUploadMediumLogo() {
    if (mediumLogoRef.current) {
      mediumLogoRef.current.click();
    }
  }

  /**
   * Activates the Small Logo file input selector.
   */
  function handleUploadSmallLogo() {
    if (smallLogoRef.current) {
      smallLogoRef.current.click();
    }
  }

  /**
   * Passes the Cover Photo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleCoverPhotoFileChange(event) {
    handleAssetUpload(
      event,
      'coverPhoto',
      setEditOrgCoverPhoto,
      setCoverPhotoLoading,
      setCoverPhotoUploaded,
    );
  };

  /**
   * Passes the Large Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleLargeLogoFileChange(event) {
    handleAssetUpload(
      event,
      'largeLogo',
      setEditOrgLargeLogo,
      setLargeLogoLoading,
      setLargeLogoUploaded,
    );
  }

  /**
   * Passes the Medium Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleMediumLogoFileChange(event) {
    handleAssetUpload(
      event,
      'mediumLogo',
      setEditOrgMediumLogo,
      setMediumLogoLoading,
      setMediumLogoUploaded,
    );
  }

  /**
   * Passes the Small Logo file selection event to the asset uploader.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   */
  function handleSmallLogoFileChange(event) {
    handleAssetUpload(
      event,
      'smallLogo',
      setEditOrgSmallLogo,
      setSmallLogoLoading,
      setSmallLogoUploaded,
    );
  }

  /**
   * Uploads a selected asset file to the server, then updates state accordingly.
   *
   * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
   * @param {string} assetName - Name of the asset being uploaded/replaced.
   * @param {function} assetLinkUpdater - State setter for the respective asset link.
   * @param {function} uploadingStateUpdater - State setter for the respective asset upload status.
   * @param {function} uploadSuccessUpdater - State setter for the respective asset upload success flag.
   */
  async function handleAssetUpload(event, assetName, assetLinkUpdater, uploadingStateUpdater, uploadSuccessUpdater) {
    const validFileTypes = ['image/jpeg', 'image/png'];
    if (!event.target || typeof (event?.target?.files) !== 'object') {
      return;
    }
    if (event.target.files.length !== 1) {
      handleGlobalError('Only one file can be uploaded at a time.');
      return;
    }

    const newAsset = event.target.files[0];
    if (!(newAsset instanceof File) || !validFileTypes.includes(newAsset.type)) {
      handleGlobalError('Sorry, that file type is not supported.');
    }

    uploadingStateUpdater(true);
    const formData = new FormData();
    formData.append('assetFile', newAsset);

    try {
      const uploadRes = await axios.post(
        `/org/${editOrgID}/branding-images/${assetName}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (!uploadRes.data.err) {
        getOrganizations();
        uploadSuccessUpdater(true);
        if (uploadRes.data.url) {
          assetLinkUpdater(uploadRes.data.url);
        }
      } else {
        throw new Error(uploadRes.data.errMsg);
      }
    } catch (e) {
      handleGlobalError(e);
    }
    uploadingStateUpdater(false);
  }

  function handleCatalogMatchTagAdd() {
    setEditOrgCatalogMatchingTags((prev) => [...prev, { key: crypto.randomUUID(), value: '' }]);
  }

  function handleCatalogMatchTagEdit(e) {
    const rowID = e.target.id.split('.')[1];
    setEditOrgCatalogMatchingTags((prev) => prev.map((item) => {
      if (rowID === item.key) {
        return {
          ...item,
          value: e.target.value,
        };
      }
      return item;
    }));
  }

  function handleCatalogMatchTagDelete(key) {
    setEditOrgCatalogMatchingTags((prev) => prev.filter((item) => item.key !== key));
  }

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
                              onClick={() => openEditOrgModal(item)}
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
            onClose={closeEditOrgModal}
            size="fullscreen"
          >
            <Modal.Header>Edit Organization Details</Modal.Header>
            <Modal.Content scrolling>
              <Form noValidate>
                <h4>LibreGrid Settings</h4>
                <Form.Field>
                  <Form.Checkbox
                    toggle
                    disabled={editOrgID === 'libretexts'}
                    label="Add to global Campus Commons list"
                    onChange={() => setEditOrgAddToGrid(!editOrgAddToGrid)}
                    checked={editOrgAddToGrid}
                  />
                </Form.Field>
                <Divider />
                <h4>Commons Catalog Settings</h4>
                <label htmlFor="bookMatchingTagsTable" className="form-field-label mt-1r">Catalog Matching Tags</label>
                <p>
                  {`Use Catalog Matching Tags to customize the Book results that appear in the Campus Commons catalog: 
                  if a tag entered here is present in a Book's tags, the Book will automatically be included in the potential catalog search results.`}
                </p>
                <Table id="catalogMatchingTagsTable" className="mb-2r">
                  <Table.Header>
                    <Table.Row>
                      <Table.HeaderCell scope="col">Tag</Table.HeaderCell>
                      <Table.HeaderCell scope="col" collapsing>Actions</Table.HeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {editOrgCatalogMatchingTags.map((item) => (
                      <Table.Row key={item.key}>
                        <Table.Cell>
                          <Input
                            key={item.key}
                            type="text"
                            id={`value.${item.key}`}
                            value={item.value}
                            onChange={handleCatalogMatchTagEdit}
                            fluid
                          />
                        </Table.Cell>
                        <Table.Cell>
                          <Button
                            icon="remove circle"
                            color="red"
                            onClick={() => handleCatalogMatchTagDelete(item.key)}
                          />
                        </Table.Cell>
                      </Table.Row>
                    ))}
                    {editOrgCatalogMatchingTags.length === 0 && (
                      <Table.Row>
                        <Table.Cell colSpan={2}>
                          <p className="muted-text text-center">No entries yet</p>
                        </Table.Cell>
                      </Table.Row>
                    )}
                  </Table.Body>
                  <Table.Footer fullWidth>
                    <Table.Row>
                      <Table.HeaderCell colSpan={2}>
                        <Button
                          onClick={handleCatalogMatchTagAdd}
                          color="blue"
                          icon
                          labelPosition="left"
                        >
                          <Icon name="add circle" />
                          Add Tag
                        </Button>
                      </Table.HeaderCell>
                    </Table.Row>
                  </Table.Footer>
                </Table>
                <Divider />
                <h4>Branding Images</h4>
                <Form.Field required className="mt-1p">
                  <label htmlFor='campusCover'>Campus Cover Photo</label>
                  <p>
                    A <em>download link</em> to the organization's large cover photo, displayed on the Campus Commons jumbotron. Dimensions should be <em>at least</em> 1920x1080. <em>Organization logos should not be used as the Cover Photo.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={coverPhotoRef}
                    onChange={handleCoverPhotoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!editOrgCoverPhoto} as="a" href={editOrgCoverPhoto} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadCoverPhoto} loading={coverPhotoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {coverPhotoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Cover Photo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field required className="mt-2r">
                  <label htmlFor='campusLarge'>Campus Large Logo</label>
                  <p>
                    A <em>download link</em> to the organization's main/large logo. This is typically an extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens.
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={largeLogoRef}
                    onChange={handleLargeLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!editOrgLargeLogo} as="a" href={editOrgLargeLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadLargeLogo} loading={largeLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {largeLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Large Logo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field required className="mt-2r">
                  <label htmlFor='campusMedium'>Campus Medium Logo</label>
                  <p>
                    A <em>download link</em> to the organization's medium-sized logo. This is typically a standard, non-extended wordmark. Logo should preferably have a transparent background. Resolution should be high enough to avoid blurring on digital screens. <em>If the organization does not have distinct large/medium logos, the same logo can be used for both.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={mediumLogoRef}
                    onChange={handleMediumLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!editOrgMediumLogo} as="a" href={editOrgMediumLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadMediumLogo} loading={mediumLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {mediumLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Medium Logo successfully uploaded.</span>
                    </Message>
                  )}
                </Form.Field>
                <Form.Field className="mt-2p mb-2p">
                  <label htmlFor='campusSmall'>Campus Small Logo</label>
                  <p>
                    A <em>download link</em> to the organization's smallest logo. This is typically the same style used for favicons or simplified communications branding. Logo should preferably have a transparent background. Dimensions should be approximately 800x800. <em>The Small Logo is not currently implemented in any portion of Commons or Conductor, but has been provisioned for possible future customizations.</em>
                  </p>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    id="conductor-org-coverphoto-upload"
                    hidden
                    ref={smallLogoRef}
                    onChange={handleSmallLogoFileChange}
                  />
                  <Button.Group fluid>
                    <Button disabled={!editOrgSmallLogo} as="a" href={editOrgSmallLogo} target="_blank" rel="noreferrer">
                      <Icon name="external" />
                      View Current
                    </Button>
                    <Button color="blue" onClick={handleUploadSmallLogo} loading={smallLogoLoading}>
                      <Icon name="upload" />
                      Upload New
                    </Button>
                  </Button.Group>
                  {smallLogoUploaded && (
                    <Message positive>
                      <Icon name="check circle" />
                      <span>Campus Small Logo successfully uploaded.</span>
                    </Message>
                  )}
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
