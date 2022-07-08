import './ControlPanel.css';
import '../peerreview/PeerReview.css';

import {
    Grid,
    Header,
    Segment,
    Button,
    Icon,
    Breadcrumb,
    List,
    Divider,
    Modal,
    Message
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import axios from 'axios';

import PeerReview from '../peerreview/PeerReview.jsx';

import useGlobalError from '../error/ErrorHooks.js';
import { isEmptyString } from '../util/HelperFunctions';

const PeerReviewRubrics = (props) => {

    // Global State
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);
    const org = useSelector((state) => state.org);

    // UI
    const [loadingRubrics, setLoadingRubrics] = useState(false);
    const [createdRubric, setCreatedRubric] = useState(false);
    const [savedRubric, setSavedRubric] = useState(false);
    const [prPreviewShow, setPRPreviewShow] = useState(false);
    const [prPreviewID, setPRPreviewID] = useState('');

    // Data
    const [rubrics, setRubrics] = useState([]);

    // Delete Rubric Modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteRubricID, setDeleteRubricID] = useState('');
    const [deleteRubricTitle, setDeleteRubricTitle] = useState('');
    const [deleteRubricLoading, setDeleteRubricLoading] = useState(false);


    /**
     * Retrieves available Peer Review Rubrics from the server.
     */
    const getRubrics = useCallback(() => {
        setLoadingRubrics(true);
        axios.get('/peerreview/rubrics').then((res) => {
            if (!res.data.err) {
                if (Array.isArray(res.data.rubrics)) {
                    setRubrics(res.data.rubrics);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadingRubrics(false);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadingRubrics(false);
        });
    }, [setLoadingRubrics, handleGlobalError]);


    /**
     * Register plugins on initialization.
     */
    useEffect(() => {
        date.plugin(ordinal);
    }, []);


    /**
     * Set special UI messages based on URL parameters, if applicable.
     */
    useEffect(() => {
        if (typeof (props.location?.search) !== 'undefined') {
            let urlParams = new URLSearchParams(props.location.search);
            let createdFlag = urlParams.get('created');
            let savedFlag = urlParams.get('saved');
            if (createdFlag === 'true') setCreatedRubric(true);
            if (savedFlag === 'true') setSavedRubric(true);
        }
    }, [props.location, setCreatedRubric, setSavedRubric]);


    /**
     * Loads current form configuration and initializes editing mode, if applicable.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Peer Review Rubrics";
        getRubrics();
    }, [getRubrics]);


    /**
     * Enters the desired Rubric's ID into state and opens the Peer Review Modal for preview.
     * @param {String} rubricID - The ID of the Rubric to preview.
     */
    const handleOpenPreviewModal = (rubricID) => {
        if (typeof (rubricID) === 'string' && rubricID.length > 0) {
            setPRPreviewID(rubricID);
            setPRPreviewShow(true);
        }
    };


    /**
     * Closes the Peer Review Modal and resets associated state.
     */
    const handleClosePreviewModal = () => {
        setPRPreviewShow(false);
        setPRPreviewID('');
    };


    /**
     * Opens the Delete Rubric Modal and enters information about the specified rubric
     * into state.
     * @param {Object} rubric - A Rubric information object.
     */
    const handleOpenDeleteModal = (rubric) => {
        if (typeof (rubric) === 'object' && !isEmptyString(rubric.rubricID)) {
            setDeleteRubricID(rubric.rubricID);
            if (!isEmptyString(rubric.rubricTitle)) setDeleteRubricTitle(rubric.rubricTitle);
            setShowDeleteModal(true);
        }
    };


    /**
     * Submits a request to the server to delete the Rubric currently in state,
     * then closes the Delete Rubric Modal on success.
     */
    const submitDeleteRubric = () => {
        if (!isEmptyString(deleteRubricID)) {
            setDeleteRubricLoading(true);
            axios.delete('/peerreview/rubric', {
                data: {
                    rubricID: deleteRubricID
                }
            }).then((res) => {
                if (!res.data.err) {
                    handleCloseDeleteModal();
                    getRubrics();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setDeleteRubricLoading(false);
                }
            }).catch((err) => {
                setDeleteRubricLoading(false);
                handleGlobalError(err);
            });
        }
    };


    /**
     * Closes the Delete Rubric Modal and resets associated state.
     */
    const handleCloseDeleteModal = () => {
        setShowDeleteModal(false);
        setDeleteRubricID('');
        setDeleteRubricTitle('');
        setDeleteRubricLoading(false);
    };


    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Peer Review Rubrics</Header>
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
                                    Peer Review Rubrics
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment loading={loadingRubrics}>
                            {createdRubric && (
                                <Message
                                    positive
                                    icon='check'
                                    content='Rubric successfully created!'
                                    className='mt-1p mb-2p'
                                />
                            )}
                            {savedRubric && (
                                <Message
                                    positive
                                    icon='check'
                                    content='Rubric successfully saved!'
                                    className='mt-1p mb-2p'
                                />
                            )}
                            <Segment raised color='blue'>
                                <Header as='h4'>Rubric Resolution</Header>
                                <p>Conductor will always attempt to choose a rubric in the following order:</p>
                                <ol>
                                    <li>The Project's <em>Preferred Peer Review Rubric</em></li>
                                    <li>The <em>Campus Default Rubric</em> of the Project's originating campus, if applicable</li>
                                    <li>The LibreTexts default Rubric</li>
                                </ol>
                            </Segment>
                            <Button
                                as={Link}
                                to='/controlpanel/peerreviewrubrics/create'
                                color='green'
                                fluid
                            >
                                <Icon name='add' />
                                Create Rubric
                            </Button>
                            <Divider className='mt-2p mb-2p' />
                            {(rubrics.length > 0) && (
                                <List divided>
                                    {rubrics.map((item) => {
                                        const itemDate = new Date(item.updatedAt);
                                        item.dateTime = date.format(itemDate, 'MMM DDD, YYYY h:mm A');
                                        return (
                                            <List.Item key={item.rubricID}>
                                                <div className='flex-row-div mt-05p mb-05p'>
                                                    <div className='left-flex'>
                                                        <div className='flex-col-div'>
                                                            <span className='peerreview-list-title'>{item.rubricTitle || "Unknown Rubric"}</span>
                                                            <span className='peerreview-list-detail muted-text'>
                                                                {item.organization?.shortName || "Unknown Organization"}
                                                                {(item.isOrgDefault === true) && (
                                                                    <span> <em>(Campus Default)</em></span>
                                                                )}
                                                                <span> <>&#8226;</> <em>Last Updated: {item.dateTime}</em></span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className='right-flex'>
                                                        <Button.Group>
                                                            {(
                                                                item.orgID === org.orgID
                                                                && (user.isCampusAdmin || user.isSuperAdmin)
                                                            ) && (
                                                                    <>
                                                                        <Button
                                                                            color='red'
                                                                            onClick={() => handleOpenDeleteModal(item)}
                                                                        >
                                                                            <Icon name='trash' />
                                                                            Delete Rubric
                                                                        </Button>
                                                                        <Button
                                                                            color='teal'
                                                                            as={Link}
                                                                            to={`/controlpanel/peerreviewrubrics/edit/${item.rubricID}`}
                                                                        >
                                                                            <Icon name='pencil' />
                                                                            Edit Rubric
                                                                        </Button>
                                                                    </>
                                                                )}
                                                            <Button
                                                                color='blue'
                                                                onClick={() => handleOpenPreviewModal(item.rubricID)}
                                                            >
                                                                <Icon name='eye' />
                                                                Preview Rubric
                                                            </Button>
                                                        </Button.Group>
                                                    </div>
                                                </div>
                                            </List.Item>
                                        )
                                    })}
                                </List>
                            )}
                            {(rubrics.length === 0) && (
                                <p className='muted-text mt-2p mb-2p text-center'>No rubrics found.</p>
                            )}
                        </Segment>
                    </Segment.Group>
                    {/* Delete Rubric Modal */}
                    <Modal
                        open={showDeleteModal}
                        onClose={handleCloseDeleteModal}
                    >
                        <Modal.Header>Delete Peer Review Rubric</Modal.Header>
                        <Modal.Content>
                            <p>Are your sure you want to delete the <strong>{deleteRubricTitle}</strong> rubric <span className='muted-text'>(ID: {deleteRubricID})</span>?</p>
                            <p>Projects using this as their Preferred Rubric will fallback to the Campus or LibreTexts default.</p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button onClick={handleCloseDeleteModal}>Cancel</Button>
                            <Button
                                color='red'
                                loading={deleteRubricLoading}
                                onClick={submitDeleteRubric}
                            >
                                <Icon name='trash' />
                                Delete Rubric
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    <PeerReview
                        open={prPreviewShow}
                        onClose={handleClosePreviewModal}
                        rubricID={prPreviewID}
                        demoView={true}
                    />
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default PeerReviewRubrics;
