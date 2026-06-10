import './PeerReview.css';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import { Modal, Button, Spinner, Checkbox, Heading } from '@libretexts/davis-react';
import { getLikertResponseText } from '../util/LikertHelpers';
import { getPeerReviewAuthorText } from '../util/ProjectHelpers';
import StarRating from './StarRating.jsx';
import useGlobalError from '../error/ErrorHooks';

const PeerReviewView = ({
    peerReviewID = '',
    peerReviewData,
    open,
    onClose,
    publicView,
}) => {
    const { handleGlobalError } = useGlobalError();

    const [allElements, setAllElements] = useState([]);
    const [reviewData, setReviewData] = useState({});
    const [reviewDate, setReviewDate] = useState('');
    const [reviewTime, setReviewTime] = useState('');
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        date.plugin(ordinal);
    }, []);

    useEffect(() => {
        if (open) {
            if (typeof peerReviewData === 'object' && Object.keys(peerReviewData).length > 0) {
                setReviewData(peerReviewData);
            } else if (typeof peerReviewID === 'string' && peerReviewID.length > 0) {
                setLoadingData(true);
                axios.get('/peerreview', { params: { peerReviewID } }).then((res) => {
                    if (!res.data.err && typeof res.data.review === 'object') {
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
                handleGlobalError('No review data provided.');
            }
        }
    }, [open, peerReviewID, peerReviewData, handleGlobalError]);

    useEffect(() => {
        if (Object.keys(reviewData).length === 0) return;
        setLoadingData(true);
        let allElem = [];
        if (reviewData.createdAt) {
            const timestamp = new Date(reviewData.createdAt);
            setReviewDate(date.format(timestamp, 'MMM DDD, YYYY'));
            setReviewTime(date.format(timestamp, 'h:mm A'));
        }
        if (Array.isArray(reviewData.headings)) {
            allElem = [...allElem, ...reviewData.headings.map((h) => ({ ...h, uiType: 'heading' }))];
        }
        if (Array.isArray(reviewData.textBlocks)) {
            allElem = [...allElem, ...reviewData.textBlocks.map((t) => ({ ...t, uiType: 'textBlock' }))];
        }
        if (Array.isArray(reviewData.responses)) {
            allElem = [
                ...allElem,
                ...reviewData.responses.map((item) => {
                    const processed = { ...item, uiType: 'response' };
                    if (
                        item.promptType === 'dropdown' &&
                        typeof item.dropdownResponse === 'string' &&
                        Array.isArray(item.promptOptions)
                    ) {
                        const found = item.promptOptions.find((o) => o.value === item.dropdownResponse);
                        processed.dropdownText = found?.text ?? 'Unknown';
                    } else {
                        processed.dropdownText = 'Unknown';
                    }
                    return processed;
                }),
            ];
        }
        allElem.sort((a, b) => {
            const ao = typeof a.order === 'number' ? a.order : 1;
            const bo = typeof b.order === 'number' ? b.order : 1;
            return ao - bo;
        });
        setAllElements(allElem);
        setLoadingData(false);
    }, [reviewData]);

    return (
        <Modal open={open} onClose={onClose} size="full">
            <Modal.Header>
                <Modal.Title>Peer Review</Modal.Title>
            </Modal.Header>
            <Modal.Body className="overflow-y-auto max-h-[calc(100dvh-10rem)]">
                {loadingData && (
                    <div className="flex justify-center py-8">
                        <Spinner />
                    </div>
                )}

                {!loadingData && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
                        {/* Metadata grid */}
                        <div className="flex flex-wrap gap-6">
                            <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Review Type</p>
                                <span>{getPeerReviewAuthorText(reviewData.authorType)}</span>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Reviewer Name</p>
                                <span>{reviewData.author}</span>
                            </div>
                            {typeof reviewData.rubricTitle === 'string' && (
                                <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Rubric</p>
                                    <span>{reviewData.rubricTitle}</span>
                                </div>
                            )}
                            {!publicView && !reviewData.anonAuthor && (
                                <div>
                                    <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">Conductor User</p>
                                    <span>✓</span>
                                </div>
                            )}
                            <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 mb-0.5">
                                    Review {!publicView ? 'Time' : 'Date'}
                                </p>
                                <span>{reviewDate}{!publicView && ` at ${reviewTime}`}</span>
                            </div>
                        </div>

                        {/* Overall rating */}
                        {typeof reviewData.rating === 'number' && reviewData.rating > 0 && (
                            <div>
                                <p className="text-sm font-medium mb-1">Overall Quality Rating:</p>
                                <div className="flex justify-center">
                                    <StarRating value={reviewData.rating} displayMode singleRating />
                                </div>
                            </div>
                        )}

                        {/* Rubric elements */}
                        {allElements.map((item) => {
                            if (item.uiType === 'heading') {
                                return (
                                    <Heading level={4} key={item.order} className="!mt-8 border-b pb-1">
                                        {item.text}
                                    </Heading>
                                );
                            }
                            if (item.uiType === 'textBlock') {
                                return (
                                    <div
                                        key={item.order}
                                        className="prose prose-code:before:hidden prose-code:after:hidden"
                                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked(item.text)) }}
                                    />
                                );
                            }
                            if (item.uiType === 'response') {
                                const labelCls = `text-sm font-medium ${item.promptRequired && item.promptType !== 'checkbox' ? 'after:content-["*"] after:text-red-500 after:ml-0.5' : ''}`;

                                if (typeof item.promptType === 'string' && item.promptType.includes('likert')) {
                                    const pts = parseInt(item.promptType.split('-')[0]);
                                    if (!isNaN(pts) && pts > 0 && pts < 8) {
                                        return (
                                            <div key={item.order}>
                                                <p className={labelCls}>{item.promptText}</p>
                                                <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                                                    {typeof item.likertResponse === 'number'
                                                        ? <p><em>{getLikertResponseText(pts === 7 ? '7-likert' : pts === 5 ? '5-likert' : '3-likert', item.likertResponse)}</em></p>
                                                        : <p><em>No response</em></p>}
                                                </div>
                                            </div>
                                        );
                                    }
                                }
                                if (item.promptType === 'text') {
                                    return (
                                        <div key={item.order}>
                                            <p className={labelCls}>{item.promptText}</p>
                                            <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                                                {typeof item.textResponse === 'string' && item.textResponse.length > 0
                                                    ? <p>{item.textResponse}</p>
                                                    : <p><em>No response</em></p>}
                                            </div>
                                        </div>
                                    );
                                }
                                if (item.promptType === 'dropdown') {
                                    return (
                                        <div key={item.order}>
                                            <p className={labelCls}>{item.promptText}</p>
                                            <div className="mt-1 rounded-md border bg-white px-3 py-2 shadow-sm">
                                                {typeof item.dropdownText === 'string' && item.dropdownText.length > 0
                                                    ? <p><em>{item.dropdownText}</em></p>
                                                    : <p><em>No response</em></p>}
                                            </div>
                                        </div>
                                    );
                                }
                                if (item.promptType === 'checkbox') {
                                    return (
                                        <Checkbox
                                            key={item.order}
                                            name={`prview-checkbox-${item.order}`}
                                            label={item.promptText ?? ''}
                                            checked={!!item.checkboxResponse}
                                            disabled
                                        />
                                    );
                                }
                            }
                            return null;
                        })}

                        {!loadingData && allElements.length === 0 && (
                            <p className="text-center text-gray-400 py-4">No data found.</p>
                        )}
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <div className="flex justify-end">
                    <Button onClick={onClose}>Done</Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

PeerReviewView.defaultProps = {
    peerReviewID: '',
    peerReviewData: {},
    open: false,
    onClose: () => {},
    publicView: true,
};

PeerReviewView.propTypes = {
    peerReviewID: PropTypes.string,
    peerReviewData: PropTypes.object,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    publicView: PropTypes.bool,
};

export default PeerReviewView;
