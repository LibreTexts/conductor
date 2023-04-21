import './PeerReview.css';

import {
    Header,
    Segment,
    Button,
    Icon,
    Modal,
    Loader,
    Checkbox,
    Grid
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';

import {
    getPeerReviewAuthorText,
    getPeerReviewLikertPointText
} from '../util/ProjectHelpers.js';

import StarRating from './StarRating.jsx';

import useGlobalError from '../error/ErrorHooks';

const PeerReviewView = ({
    peerReviewID,
    peerReviewData,
    open,
    onClose,
    publicView,
    ...props
}) => {

    /* Global State and Error Handling */
    const { handleGlobalError } = useGlobalError();

    /* UI and Form State */
    const [allElements, setAllElements] = useState([]);
    const [reviewData, setReviewData] = useState({});
    const [reviewDate, setReviewDate] = useState('');
    const [reviewTime, setReviewTime] = useState('');
    const [loadingData, setLoadingData] = useState(false);


    /**
     * Register date plugin(s) on initialization.
     */
    useEffect(() => {
        date.plugin(ordinal);
    }, []);


    /**
     * Sets the internal state with the provided data or retrieves the review data from the server
     * if a PeerReviewID was provided.
     */
    useEffect(() => {
        if (open) {
            if (typeof (peerReviewData) === 'object' && Object.keys(peerReviewData).length > 0) {
                setReviewData(peerReviewData);
            } else if (typeof (peerReviewID) === 'string' && peerReviewID.length > 0) {
                setLoadingData(true);
                axios.get('/peerreview', {
                    params: {
                        peerReviewID: peerReviewID
                    }
                }).then((res) => {
                    if (!res.data.err && typeof (res.data.review) === 'object') {
                        setReviewData(res.data.review);
                    } else {
                        handleGlobalError(res.data.errMsg);
                    }
                    setLoadingData(false);
                }).catch((err) => {
                    setLoadingData(false);
                    handleGlobalError(err);
                });
            } else {
                handleGlobalError("No review data provided.");
            }
        }
    }, [open, peerReviewID, peerReviewData, setReviewData, setLoadingData, handleGlobalError])


    /**
     * Processes all rubric elements and responses for UI presentation whenever the review data changes.
     */
    useEffect(() => {
        if (Object.keys(reviewData).length > 0) {
            setLoadingData(true);
            let allElem = [];
            if (reviewData.createdAt) {
                const timestamp = new Date(reviewData.createdAt);
                const dateFormatted = date.format(timestamp, 'MMM DDD, YYYY');
                const timeFormatted = date.format(timestamp, 'h:mm A');
                setReviewDate(dateFormatted);
                setReviewTime(timeFormatted);
            }
            if (Array.isArray(reviewData.headings)) {
                let headings = reviewData.headings.map((item) => {
                    return {
                        ...item,
                        uiType: 'heading'
                    }
                });
                allElem = [...allElem, ...headings];
            }
            if (Array.isArray(reviewData.textBlocks)) {
                let textBlocks = reviewData.textBlocks.map((item) => {
                    return {
                        ...item,
                        uiType: 'textBlock'
                    };
                });
                allElem = [...allElem, ...textBlocks];
            }
            if (Array.isArray(reviewData.responses)) {
                let responses = reviewData.responses.map((item) => {
                    let processed = {
                        ...item,
                        uiType: 'response'
                    };
                    if (
                        item.promptType === 'dropdown'
                        && typeof (item.dropdownResponse) === 'string'
                        && Array.isArray(item.promptOptions)
                    ) {
                        let foundOption = item.promptOptions.find((option) => option.value === item.dropdownResponse);
                        if (foundOption !== undefined && typeof (foundOption.text) === 'string') {
                            processed.dropdownText = foundOption.text;
                        }
                    } else {
                        processed.dropdownText = 'Unknown';
                    }
                    return processed;
                });
                allElem = [...allElem, ...responses];
            }
            allElem.sort((a, b) => {
                let aOrder = a.order;
                let bOrder = b.order;
                if (typeof (aOrder) !== 'number') aOrder = 1;
                if (typeof (bOrder) !== 'number') bOrder = 1;
                if (aOrder < bOrder) return -1;
                if (aOrder > bOrder) return 1;
                return 0;
            });
            setAllElements(allElem);
            setLoadingData(false);
        }
    }, [reviewData, setAllElements, setLoadingData]);


    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                size='fullscreen'
                role='dialog'
                aria-labelledby='peerreview-view-modal-title'
            >
                <Modal.Header id='peerreview-view-modal-title'>Peer Review</Modal.Header>
                <Modal.Content
                    scrolling
                    className='peerreview-modal-content'
                >
                    {loadingData && (
                        <div className='mt-4p mb-4p'>
                            <Loader
                                active
                                size='large'
                                inline='centered'
                            />
                        </div>
                    )}
                    <Segment>
                        <Grid stackable className='mb-1p'>
                            <Grid.Row columns='equal'>
                                <Grid.Column>
                                    <Header sub>Review Type</Header>
                                    <span>{getPeerReviewAuthorText(reviewData.authorType)}</span>
                                </Grid.Column>
                                <Grid.Column>
                                    <Header sub>Reviewer Name</Header>
                                    <span>{reviewData.author}</span>
                                </Grid.Column>
                                {(typeof (reviewData.rubricTitle) === 'string') && (
                                    <Grid.Column>
                                        <Header sub>Rubric</Header>
                                        <span>{reviewData.rubricTitle}</span>
                                    </Grid.Column>
                                )}
                                {(!publicView && !reviewData.anonAuthor) && (
                                    <Grid.Column>
                                        <Header sub>Conductor User</Header>
                                        <Icon name='check' />
                                    </Grid.Column>
                                )}
                                <Grid.Column>
                                    <Header sub>Review {!publicView ? 'Time' : 'Date'}</Header>
                                    <span>{reviewDate} {!publicView && `at ${reviewTime}`}</span>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                        {(typeof (reviewData.rating) === 'number' && reviewData.rating > 0) && (
                            <>
                                <p className='form-field-label margin-none'>Overall Quality Rating:</p>
                                <div className='center-flex mb-2p'>
                                    <StarRating
                                        value={reviewData.rating}
                                        displayMode={true}
                                        singleRating={true}
                                    />
                                </div>
                            </>
                        )}
                        {allElements.map((item) => {
                            if (item.uiType === 'heading') {
                                return (
                                    <Header
                                        as='h4'
                                        key={item.order}
                                        dividing
                                    >
                                        {item.text}
                                    </Header>
                                )
                            } else if (item.uiType === 'textBlock') {
                                return (
                                    <p
                                        className='mb-2p'
                                        key={item.order}
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(marked(item.text))
                                        }}
                                    />
                                )
                            } else if (item.uiType === 'response') {
                                let responseClass = 'form-field-label mt-2p';
                                if (item.promptType !== 'checkbox' && item.promptRequired) responseClass += ' form-required';
                                if (typeof (item.promptType) === 'string' && item.promptType.includes('likert')) {
                                    let typeSplit = item.promptType.split('-');
                                    let likertPoints = parseInt(typeSplit[0]);
                                    if (!isNaN(likertPoints) && likertPoints > 0 && likertPoints < 8) {
                                        return (
                                            <React.Fragment key={item.order}>
                                                <p className={responseClass}>{item.promptText}</p>
                                                <Segment raised>
                                                    {(typeof (item.likertResponse) === 'number') ? (
                                                        <p><em>{getPeerReviewLikertPointText(item.likertResponse, likertPoints)}</em></p>
                                                    ) : <p><em>No response</em></p>}
                                                </Segment>
                                            </React.Fragment>
                                        )
                                    }
                                } else if (item.promptType === 'text') {
                                    return (
                                        <React.Fragment key={item.order}>
                                            <p className={responseClass}>{item.promptText}</p>
                                            <Segment raised>
                                                {(typeof (item.textResponse) === 'string' && item.textResponse.length > 0) ? (
                                                    <p>{item.textResponse}</p>
                                                ) : <p><em>No response</em></p>}
                                            </Segment>
                                        </React.Fragment>
                                    )
                                } else if (item.promptType === 'dropdown') {
                                    return (
                                        <React.Fragment key={item.order}>
                                            <p className={responseClass}>{item.promptText}</p>
                                            <Segment raised>
                                                {(typeof (item.dropdownText) === 'string' && item.dropdownText.length > 0) ? (
                                                    <p><em>{item.dropdownText}</em></p>
                                                ) : <p><em>No response</em></p>}
                                            </Segment>
                                        </React.Fragment>
                                    )
                                } else if (item.promptType === 'checkbox') {
                                    return (
                                        <Checkbox
                                            key={item.order}
                                            label={(
                                                <label className={responseClass}>
                                                    <span className={item.promptRequired ? 'form-required' : ''}>{item.promptText}</span>
                                                </label>
                                            )}
                                            checked={item.checkboxResponse}
                                            className='checkbox-display'
                                        />
                                    )
                                }
                            }
                            return null;
                        })}
                        {(!loadingData && allElements.length === 0) && (
                            <p className='text-center muted-text mt-4p mb-2p'>No data found.</p>
                        )}
                    </Segment>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        color='blue'
                        onClick={onClose}
                    >
                        Done
                    </Button>
                </Modal.Actions>
            </Modal>
        </>
    )
};

PeerReviewView.defaultProps = {
    peerReviewID: '',
    peerReviewData: {},
    open: false,
    onClose: () => { },
    publicView: true
};

PeerReviewView.propTypes = {
    peerReviewID: PropTypes.string,
    peerReviewData: PropTypes.object,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    publicView: PropTypes.bool
};

export default PeerReviewView;