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
  List,
  Message
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';

import { getShelvesNameText } from '../util/BookHelpers.js';
import {
  isEmptyString,
  basicArraysEqual,
} from '../util/HelperFunctions.js';
import { itemsPerPageOptions } from '../util/PaginationOptions.js';
import useGlobalError from '../error/ErrorHooks.js';

const CollectionsManager = () => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    // Data
    const [collections, setCollections] = useState([]);
    const [displayColls, setDisplayColls] = useState([]);
    const [pageColls, setPageColls] = useState([]);

    // UI
    const [activePage, setActivePage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loadedData, setLoadedData] = useState(false);
    const [searchString, setSearchString] = useState('');
    const [sortChoice, setSortChoice] = useState('title');

    // Create/Edit Collection Modal
    const DEFAULT_COLL_LOCS = [
      { key: 'central', value: false },
      { key: 'campus', value: false },
    ];

    const [showEditCollModal, setShowEditCollModal] = useState(false);
    const [editCollCreate, setEditCollCreate] = useState(false);
    const [editCollID, setEditCollID] = useState('');
    const [editCollTitle, setEditCollTitle] = useState('');
    const [editCollPhoto, setEditCollPhoto] = useState('');
    const [editCollPriv, setEditCollPriv] = useState('public');
    const [editCollAuto, setEditCollAuto] = useState(false);
    const [editCollProg, setEditCollProg] = useState('');
    const [editCollLocs, setEditCollLocs] = useState(DEFAULT_COLL_LOCS);
    const [editCollOrigTitle, setEditCollOrigTitle] = useState('');
    const [editCollOrigPhoto, setEditCollOrigPhoto] = useState('');
    const [editCollOrigPriv, setEditCollOrigPriv] = useState('');
    const [editCollOrigAuto, setEditCollOrigAuto] = useState(false);
    const [editCollOrigProg, setEditCollOrigProg] = useState('');
    const [editCollOrigLocs, setEditCollOrigLocs] = useState([]);
    const [editCollTitleErr, setEditCollTitleErr] = useState(false);
    const [editCollProgErr, setEditCollProgErr] = useState(false);
    const [editCollLocsErr, setEditCollLocsErr] = useState(false);
    const [editCollLoading, setEditCollLoading] = useState(false);
    const photoRef = useRef(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoUploaded, setPhotoUploaded] = useState(false);

    // Manage Resources Modal
    const [showManageResModal, setManageResModal] = useState(false);
    const [manageResID, setManageResID] = useState('');
    const [manageResTitle, setManageResTitle] = useState('');
    const [manageResItems, setManageResItems] = useState([]);
    const [manageResWorking, setManageResWorking] = useState(false);

    // Delete Collection Modal
    const [showDelCollModal, setShowDelCollModal] = useState(false);
    const [delCollID, setDelCollID] = useState('');
    const [delCollTitle, setDelCollTitle] = useState('');
    const [delCollLoading, setDelCollLoading] = useState(false);

    const sortOptions = [
        { key: 'title', text: 'Sort by Title', value: 'title' },
        { key: 'resources', text: 'Sort by Number of Resources', value: 'resources' }
    ];
    const privacyOptions = [
        { key: 'public', text: 'Public', value: 'public' },
        { key: 'private', text: 'Private', value: 'private'},
        { key: 'campus', text: 'Campus', value: 'campus'}
    ];


    /**
     * Retrieve all collections via GET request
     * to the server.
     */
    const getCollections = useCallback(() => {
      axios.get('/commons/collections/all').then((res) => {
          if (!res.data.err) {
              if (Array.isArray(res.data.colls) && res.data.colls.length > 0) {
                  setCollections(res.data.colls);
              }
          } else {
              handleGlobalError(res.data.errMsg);
          }
          setLoadedData(true);
      }).catch((err) => {
          handleGlobalError(err);
          setLoadedData(true);
      });
    }, [setCollections, setLoadedData, handleGlobalError]);


    /**
     * Set page title and retrieve collections
     * on initial load.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Collections Manager";
        getCollections();
    }, [getCollections]);


    /**
     * Track changes to the number of collections loaded
     * and the selected itemsPerPage and update the
     * set of collections to display.
     */
    useEffect(() => {
        setTotalPages(Math.ceil(displayColls.length/itemsPerPage));
        setPageColls(displayColls.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage));
    }, [itemsPerPage, displayColls, activePage]);


    /**
     * Filter and sort collections according to
     * user's choices, then update the list.
     */
    useEffect(() => {
        filterAndSortColls();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collections, searchString, sortChoice]);


    /**
     * Filter and sort collections according
     * to current filters and sort
     * choice.
     */
    const filterAndSortColls = () => {
        setLoadedData(false);
        let filtered = collections.filter((coll) => {
            var include = true;
            var descripString = String(coll.title).toLowerCase();
            if (searchString !== '' && String(descripString).indexOf(String(searchString).toLowerCase()) === -1) {
                include = false;
            }
            if (include) {
                return coll;
            } else {
                return false;
            }
        })
        if (sortChoice === 'title') {
            const sorted = [...filtered].sort((a, b) => {
                var normalA = String(a.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                var normalB = String(b.title).toLowerCase().replace(/[^A-Za-z]+/g, "");
                if (normalA < normalB) {
                    return -1;
                }
                if (normalA > normalB) {
                    return 1;
                }
                return 0;
            });
            setDisplayColls(sorted);
        } else if (sortChoice === 'resources') {
            const sorted = [...filtered].sort((a, b) => {
                if (a.resources < b.resources) {
                    return -1;
                }
                if (a.resources > b.resources) {
                    return 1;
                }
                return 0;
            });
            setDisplayColls(sorted);
        }
        setLoadedData(true);
    }


    /**
     * Resets all fields in the Create/Edit Collection Modal to their default values.
     */
    const resetEditCollFormValues = () => {
      setEditCollTitle('');
      setEditCollOrigTitle('');
      setEditCollPhoto('');
      setEditCollOrigPhoto('');
      setEditCollPriv('public');
      setEditCollOrigPriv('');
      setEditCollAuto(false);
      setEditCollOrigAuto(false);
      setEditCollProg('');
      setEditCollOrigProg('');
      setEditCollLocs(DEFAULT_COLL_LOCS);
      setEditCollOrigLocs([]);
    };


    /**
     * Reset any form errors in the Edit Collection Modal.
     */
    const resetEditCollFormErrs = () => {
        setEditCollTitleErr(false);
        setEditCollProgErr(false);
        setEditCollLocsErr(false);
    };


    /**
     * Validate the Edit Collection
     * Modal form.
     */
    const validateEditCollForm = () => {
        let validForm = true;
        if (isEmptyString(editCollTitle) || String(editCollTitle).length < 3) {
            validForm = false;
            setEditCollTitleErr(true);
        }
        if (editCollAuto) {
          if (isEmptyString(editCollProg)) {
            validForm = false;
            setEditCollProgErr(true);
          }
          const checked = editCollLocs.filter((loc) => loc.value === true);
          if (checked.length < 1) {
            validForm = false;
            setEditCollLocsErr(true);
          }
        }
        return validForm;
    };


    /**
     * If the Create/Edit Collection form is valid,
     * submit the new collection or update(s) to the
     * server via POST or PUT request.
     */
    const submitEditCollForm = () => {
        resetEditCollFormErrs();
        if (validateEditCollForm()) {
            setEditCollLoading(true);
            let collData = {};
            let axiosReq;
            const selectedLocs = editCollLocs.map((loc) => {
              return loc.value ? loc.key : null;
            }).filter((loc) => loc !== null);
            if (editCollCreate) {
                collData.title = editCollTitle;
                if (!isEmptyString(editCollPhoto)) {
                    collData.coverPhoto = editCollPhoto;
                }
                if (!isEmptyString(editCollPriv)) {
                    collData.privacy = editCollPriv;
                }
                collData.autoManage = editCollAuto;
                collData.program = editCollProg;
                collData.locations = selectedLocs;
                axiosReq = axios.post('/commons/collection/create', collData);
            } else {
                collData.collID = editCollID;
                if (editCollTitle !== editCollOrigTitle) {
                    collData.title = editCollTitle;
                }
                if (editCollPhoto !== editCollOrigPhoto) {
                    collData.coverPhoto = editCollPhoto;
                }
                if (editCollPriv !== editCollOrigPriv) {
                    collData.privacy = editCollPriv;
                }
                if (editCollAuto !== editCollOrigAuto) {
                    collData.autoManage = editCollAuto;
                }
                if (editCollProg !== editCollOrigProg) {
                    collData.program = editCollProg;
                }
                if (!basicArraysEqual(selectedLocs, editCollOrigLocs)) {
                    collData.locations = selectedLocs;
                }
                axiosReq = axios.put('/commons/collection/edit', collData);
            }
            axiosReq.then((res) => {
                if (!res.data.err) {
                    closeEditCollModal();
                    getCollections();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setEditCollLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setEditCollLoading(false);
            });
        }
    };


    /**
     * Open the Create/Edit Collection Modal in Create mode and reset all fields
     * to their defaults.
     */
    const openCreateCollModal = () => {
        setShowEditCollModal(true);
        setEditCollCreate(true);
        resetEditCollFormValues();
        resetEditCollFormErrs();
    };


    /**
     * Open the Create/Edit Collection Modal in Edit mode and set all fields
     * to their existing values.
     * 
     * @param {object} coll - The collection to inspect.
     */
    const openEditCollModal = (coll) => {
        setShowEditCollModal(true);
        setEditCollCreate(false);
        setEditCollID(coll.collID)
        setEditCollTitle(coll.title);
        setEditCollOrigTitle(coll.title);
        setEditCollPhoto(coll.coverPhoto);
        setEditCollOrigPhoto(coll.coverPhoto);
        setEditCollPriv(coll.privacy);
        setEditCollOrigPriv(coll.privacy);
        if (typeof (coll.autoManage) === 'boolean') {
          const locsToSet = DEFAULT_COLL_LOCS.map((loc) => {
            if (Array.isArray(coll.locations) && coll.locations.includes(loc.key)) {
              return {
                ...loc,
                value: true,
              }
            }
            return loc;
          });
          setEditCollAuto(coll.autoManage);
          setEditCollOrigAuto(coll.autoManage);
          setEditCollProg(coll.program);
          setEditCollOrigProg(coll.program);
          setEditCollLocs(locsToSet);
          setEditCollOrigLocs(coll.locations);
        }
        resetEditCollFormErrs();
    };


    /**
     * Close the Create/Edit Collection Modal and reset all fields to their default values.
     */
    const closeEditCollModal = () => {
        setShowEditCollModal(false);
        setEditCollCreate(false);
        setPhotoUploaded(false)
        resetEditCollFormValues();
        resetEditCollFormErrs();
    };

    /**
     * Activates the Cover Photo file input selector.
     */
    function handleUploadCoverPhoto() {
        if (photoRef.current) {
            photoRef.current.click();
        }
    }

    /**
     * Passes the Cover photo file selection event to the asset uploader.
     *
     * @param {React.FormEvent<HTMLInputElement>} event - File selection event.
     */
    function handleCoverPhotoFileChange(event) {
        handleAssetUpload(
        event,
        'coverPhoto',
        setEditCollPhoto,
        setPhotoLoading,
        setPhotoUploaded,
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
        `/commons/collection/${editCollID}/assets/${assetName}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (!uploadRes.data.err) {
        getCollections();
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

    /**
     * Updates a Collection Search Location choice in the Create/Edit Collection Modal.
     * 
     * @param {string} locKey - The key field of the option to toggle.
     */
    const handleEditCollLocationsChange = (locKey) => {
      const updatedLocs = editCollLocs.map((item) => {
        if (item.key === locKey) {
          return {
            ...item,
            value: !item.value,
          };
        }
        return item;
      });
      setEditCollLocs(updatedLocs);
    };


    /**
     * Given a Collection ID, load a list of
     * its resources via GET request to the server.
     */
    const getCollectionResources = (collID) => {
        if (collID && !isEmptyString(collID)) {
            setManageResWorking(true);
            axios.get('/commons/collection', {
                params: {
                    collID: collID
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (res.data.coll) {
                        if (res.data.coll.resources && Array.isArray(res.data.coll.resources)) {
                            var resources = [];
                            res.data.coll.resources.forEach((item) => {
                                resources.push({
                                    bookID: item.bookID,
                                    title: item.title,
                                    author: item.author
                                });
                            });
                            setManageResItems(resources);
                        }
                    }
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setManageResWorking(false);
            }).catch((err) => {
                handleGlobalError(err);
                setManageResWorking(false);
            })
        }
    };


    /**
     * Given a Book ID, submit a PUT request
     * to the server to have it removed from the
     * Collection being modified in the Manage
     * Resources Modal (manageResID).
     */
    const removeCollectionResource = (bookID) => {
        if (bookID && !isEmptyString(bookID)) {
            setManageResWorking(true);
            var collData = {
                collID: manageResID,
                bookID: bookID
            };
            axios.put('/commons/collection/removeresource', collData).then((res) => {
                if (!res.data.err) {
                    setManageResWorking(false);
                    getCollectionResources(manageResID);
                } else {
                    setManageResWorking(false);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setManageResWorking(false);
            });
        }
    };


    /**
     * Open the Manage Resource Modal and
     * set necessary metadata values, then
     * load the current Collection's resources.
     */
    const openManageResModal = (collID, collTitle) => {
        setManageResModal(true);
        setManageResID(collID);
        setManageResTitle(collTitle);
        setManageResItems([]);
        getCollectionResources(collID);
    };


    /**
     * Close the Manage Resources Modal and
     * reset all respective values to their defaults.
     */
    const closeManageResModal = () => {
        setManageResModal(false);
        setManageResTitle('');
        setManageResID('');
        setManageResItems([]);
        getCollections();
    };


    /**
     * Submit a PUT request to the server
     * to delete the Collection being
     * modified in the Delete Collection
     * Modal (delCollID).
     */
    const submitDeleteCollection = () => {
        setDelCollLoading(true);
        axios.put('/commons/collection/delete', {
            collID: delCollID
        }).then((res) => {
            if (!res.data.err) {
                closeDelCollModal();
                getCollections();
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setDelCollLoading(false);
        }).catch((err) => {
            handleGlobalError(err);
            setDelCollLoading(false);
        });
    };


    /**
     * Open the Delete Collection Modal and
     * set the respective values for the
     * Collection to be modified.
     */
    const openDelCollModal = (collID, collTitle) => {
        if ((collID !== '') && (collTitle !== '')) {
            setDelCollID(collID);
            setDelCollTitle(collTitle);
            setDelCollLoading(false);
            setShowDelCollModal(true);
        }
    };


    /**
     * Close the Delete Collection Modal
     * and reset all respective values
     * to their defaults.
     */
    const closeDelCollModal = () => {
        setShowDelCollModal(false);
        setDelCollLoading(false);
        setDelCollID('');
        setDelCollTitle('');
    };


    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Collections Manager</Header>
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
                                    Collections Manager
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
                                    <Input
                                        icon='search'
                                        placeholder='Search results...'
                                        onChange={(e) => { setSearchString(e.target.value) }}
                                        value={searchString}
                                    />
                                </div>
                                <div className='right-flex'>
                                    <Button
                                        color='green'
                                        className='float-right'
                                        onClick={openCreateCollModal}
                                    >
                                        <Icon name='add' />
                                        Create Collection
                                    </Button>
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
                                    <span> items per page of <strong>{Number(collections.length).toLocaleString()}</strong> results.</span>
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
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell colSpan='3'>
                                            {(sortChoice === 'title')
                                                ? <span><em>Collection Title</em></span>
                                                : <span>Collection Title</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'resources')
                                                ? <span><em>Number of Resources</em></span>
                                                : <span>Number of Resources</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Actions</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(pageColls.length > 0) &&
                                        pageColls.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell colSpan='3'>
                                                        <p><strong>{item.title}</strong></p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.resources}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            <Button
                                                                color='blue'
                                                                onClick={() => { openEditCollModal(item) }}
                                                            >
                                                                <Icon name='edit' />
                                                                Edit Collection Details
                                                            </Button>
                                                            <Button
                                                                color='teal'
                                                                onClick={() => { openManageResModal(item.collID, item.title) }}
                                                            >
                                                                <Icon name='list alternate outline' />
                                                                Manage Resources
                                                            </Button>
                                                            <Button
                                                                color='red'
                                                                onClick={() => { openDelCollModal(item.collID, item.title) }}
                                                            >
                                                                <Icon name='delete' />
                                                                Delete Collection
                                                            </Button>
                                                        </Button.Group>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(pageColls.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={3}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                    {/* Create/Edit Collection Modal */}
                    <Modal
                        open={showEditCollModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>{editCollCreate ? 'Create' : 'Edit'} Collection</Modal.Header>
                        <Modal.Content>
                            {(editCollCreate) &&
                                <p><em>This collection will be created inside of <strong>{org.shortName}</strong>.</em></p>
                            }
                            <Form noValidate>
                                <Form.Field
                                    error={editCollTitleErr}
                                >
                                    <label>Collection Title</label>
                                    <Input
                                        icon='folder open'
                                        placeholder='Collection Title...'
                                        type='text'
                                        iconPosition='left'
                                        onChange={(e) => { setEditCollTitle(e.target.value) }}
                                        value={editCollTitle}
                                    />
                                </Form.Field>
                                {(editCollCreate) && 
                                    <>
                                        <p><strong>Cover Photo</strong></p>
                                        <p><em>Save this collection first to upload a Cover Photo.</em></p>
                                    </>
                                }
                                {!editCollCreate && editCollID && (
                                    <Form.Field required className="mt-2r">
                                        <label htmlFor='coverPhoto'>Collection Cover Photo</label>
                                        <p>
                                            A <em>download link</em> to the collection's cover photo. Resolution should be high enough to avoid blurring on digital screens.
                                        </p>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png"
                                            id="conductor-org-coverphoto-upload"
                                            hidden
                                            ref={photoRef}
                                            onChange={handleCoverPhotoFileChange}
                                        />
                                        <Button.Group fluid>
                                            <Button disabled={!editCollPhoto} as="a" href={editCollPhoto} target="_blank" rel="noreferrer">
                                                <Icon name="external" />
                                                View Current
                                            </Button>
                                            <Button color="blue" onClick={handleUploadCoverPhoto} loading={photoLoading}>
                                                <Icon name="upload" />
                                                Upload New
                                            </Button>
                                        </Button.Group>
                                        {photoUploaded && (
                                            <Message positive>
                                                <Icon name="check circle" />
                                                <span>Cover Photo successfully uploaded.</span>
                                            </Message>
                                        )}
                                    </Form.Field>
                                )}
                                <Form.Select
                                    fluid
                                    label={<label>Collection Privacy <span className='muted-text'>(defaults to Public)</span></label>}
                                    placeholder='Collection Privacy...'
                                    options={privacyOptions}
                                    onChange={(_e, { value }) => { setEditCollPriv(value) }}
                                    value={editCollPriv}
                                />
                                <Form.Checkbox
                                  label='Allow Conductor to manage this collection automatically during Commons-Libraries syncs'
                                  checked={editCollAuto}
                                  onChange={() => setEditCollAuto(!editCollAuto)}
                                />
                                {editCollAuto && (
                                  <>
                                    <Form.Field className='mt-2p' error={editCollProgErr}>
                                      <label>Program Meta-Tag <span className='muted-text'>(used to match resources)</span></label>
                                      <Input
                                        icon='tag'
                                        placeholder='Meta-Tag'
                                        type='text'
                                        iconPosition='left'
                                        onChange={(e) => setEditCollProg(e.target.value)}
                                        value={editCollProg}
                                      />
                                    </Form.Field>
                                    <Form.Group grouped>
                                      <label>Locations to Search <span className='muted-text'>(at least one required)</span></label>
                                      {editCollLocs.map((option) => {
                                        return (
                                          <Form.Checkbox
                                            key={option.key}
                                            label={getShelvesNameText(option.key)}
                                            checked={option.value}
                                            onChange={() => handleEditCollLocationsChange(option.key)}
                                            error={editCollLocsErr}
                                          />
                                        )
                                      })}
                                    </Form.Group>
                                  </>
                                )}
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeEditCollModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color={editCollCreate ? 'green' : 'blue'}
                                onClick={submitEditCollForm}
                                loading={editCollLoading}
                            >
                                <Icon name={editCollCreate ? 'add' : 'edit'} />
                                {editCollCreate ? 'Create' : 'Edit'}
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Manage Resources Modal */}
                    <Modal
                        open={showManageResModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Manage Collection Resources</Modal.Header>
                        <Modal.Content scrolling>
                            <p><strong>Collection Title: </strong>{manageResTitle}</p>
                            <p><strong>Resources: </strong></p>
                            {(manageResItems.length > 0) &&
                                <List
                                    celled
                                    verticalAlign='middle'
                                    relaxed
                                >
                                    {manageResItems.map((item, idx) => {
                                        return (
                                            <List.Item key={idx}>
                                                <List.Content floated='right'>
                                                    <Button
                                                        color='blue'
                                                        compact
                                                        as='a'
                                                        href={`/book/${item.bookID}`}
                                                        target='_blank'
                                                        rel='noopener noreferrer'
                                                    >
                                                        <Icon name='external square' />
                                                        Open
                                                    </Button>
                                                    <Button
                                                        color='red'
                                                        compact
                                                        onClick={() => { removeCollectionResource(item.bookID) }}
                                                    >
                                                        <Icon name='remove circle' />
                                                        Remove
                                                    </Button>
                                                </List.Content>
                                                <List.Header>{item.title}</List.Header>
                                                <List.Content><em>{item.author}</em></List.Content>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            }
                            {(manageResItems.length === 0) &&
                                <p className='text-center'><em>This Collection doesn't have any resources.</em></p>
                            }
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                loading={manageResWorking}
                                onClick={closeManageResModal}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Delete Collection Modal */}
                    <Modal
                        open={showDelCollModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Delete Collection</Modal.Header>
                        <Modal.Content scrolling>
                            <p>Are you sure you want to delete <strong>{delCollTitle}</strong> <span className='muted-text'>({delCollID})</span>?</p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeDelCollModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='red'
                                loading={delCollLoading}
                                onClick={submitDeleteCollection}
                            >
                                <Icon name='delete' />
                                Delete
                            </Button>
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CollectionsManager;
