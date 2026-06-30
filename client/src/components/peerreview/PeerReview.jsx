import './PeerReview.css';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
    Modal,
    Button,
    Alert,
    Spinner,
    Input,
    Select,
    Textarea,
    Checkbox,
} from '@libretexts/davis-react';

import StarRating from './StarRating.jsx';
import DavisLikertScale from './DavisLikertScale';

import { peerReviewAuthorTypes } from '../util/ProjectHelpers';
import { isEmptyString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks';

const authorTypeOpts = peerReviewAuthorTypes.map((t) => ({
    value: t.value,
    label: t.text,
}));

const PeerReview = ({
    projectID = '',
    rubricID = '',
    isPublicView = false,
    demoView = false,
    open,
    onClose,
}) => {
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    const [allElements, setAllElements] = useState([]);
    const [rubric, setRubric] = useState({});
    const [loadedRubric, setLoadedRubric] = useState(false);
    const [savingReview, setSavingReview] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [authorType, setAuthorType] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [rating, setRating] = useState(0);
    const [authorTypeErr, setAuthorTypeErr] = useState(false);
    const [firstNameErr, setFirstNameErr] = useState(false);
    const [lastNameErr, setLastNameErr] = useState(false);
    const [emailErr, setEmailErr] = useState(false);
    const [ratingErr, setRatingErr] = useState(false);

    useEffect(() => {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if ('target' in node) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer');
            }
        });
    }, []);

    useEffect(() => {
        let allElem = [];
        if (Array.isArray(rubric.headings)) {
            allElem = [...allElem, ...rubric.headings.map((item) => ({ ...item, uiType: 'heading' }))];
        }
        if (Array.isArray(rubric.textBlocks)) {
            allElem = [...allElem, ...rubric.textBlocks.map((item) => ({ ...item, uiType: 'textBlock' }))];
        }
        if (Array.isArray(rubric.prompts)) {
            allElem = [...allElem, ...rubric.prompts.map((item) => {
                let initValue = null;
                if (item.promptType === 'text' || item.promptType === 'dropdown') initValue = '';
                else if (item.promptType === 'checkbox') initValue = false;
                return { ...item, uiType: 'prompt', error: false, value: initValue };
            })];
        }
        allElem.sort((a, b) => {
            const aOrder = typeof a.order === 'number' ? a.order : 1;
            const bOrder = typeof b.order === 'number' ? b.order : 1;
            return aOrder - bOrder;
        });
        setAllElements(allElem);
    }, [rubric]);

    useEffect(() => {
        if (!open && !demoView) return;
        let rubricURL = null;
        let options = {};
        if (!isEmptyString(projectID)) {
            rubricURL = '/peerreview/projectrubric';
            options = { params: { projectID } };
        } else if (!isEmptyString(rubricID)) {
            rubricURL = '/peerreview/rubric';
            options = { params: { rubricID } };
        }
        if (!rubricURL) return;
        axios.get(rubricURL, options).then((res) => {
            if (!res.data.err && typeof res.data.rubric === 'object') {
                setRubric(res.data.rubric);
            } else if (!demoView || open) {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedRubric(true);
        }).catch((err) => {
            setLoadedRubric(true);
            handleGlobalError(err);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectID, rubricID, demoView, open]);

    const validateForm = () => {
        let valid = true;
        if (isEmptyString(authorType)) { valid = false; setAuthorTypeErr(true); } else setAuthorTypeErr(false);
        if (!user.isAuthenticated) {
            if (isEmptyString(firstName)) { valid = false; setFirstNameErr(true); } else setFirstNameErr(false);
            if (isEmptyString(lastName)) { valid = false; setLastNameErr(true); } else setLastNameErr(false);
            if (isEmptyString(email)) { valid = false; setEmailErr(true); } else setEmailErr(false);
        }
        if (rating < 0.5 || rating > 5) { valid = false; setRatingErr(true); } else setRatingErr(false);

        const formUpdate = allElements.map((item) => {
            if (item.uiType !== 'prompt') return item;
            const updated = { ...item };
            if (item.promptRequired) {
                if (item.promptType === '3-likert' && (item.value < 1 || item.value > 3)) { valid = false; updated.error = true; }
                else if (item.promptType === '5-likert' && (item.value < 1 || item.value > 5)) { valid = false; updated.error = true; }
                else if (item.promptType === '7-likert' && (item.value < 1 || item.value > 7)) { valid = false; updated.error = true; }
                else if ((item.promptType === 'text' || item.promptType === 'dropdown') && isEmptyString(item.value)) { valid = false; updated.error = true; }
                else if (item.promptType === 'checkbox' && item.value !== true) { valid = false; updated.error = true; }
                else updated.error = false;
            } else if (item.promptType === 'text' && typeof item.value === 'string' && item.value.length > 10000) {
                valid = false; updated.error = true;
            } else {
                updated.error = false;
            }
            return updated;
        });
        setAllElements(formUpdate);
        return valid;
    };

    const submitReview = () => {
        setSavingReview(true);
        if (!validateForm() || isEmptyString(projectID)) { setSavingReview(false); return; }

        let reviewObj = { projectID, authorType, rating };
        if (!user.isAuthenticated) {
            reviewObj = { ...reviewObj, authorFirst: firstName, authorLast: lastName, authorEmail: email };
        }
        const responses = allElements.flatMap((item) => {
            if (item.uiType !== 'prompt' || typeof item.promptType !== 'string') return [];
            const entry = { promptID: item._id, promptType: item.promptType, order: item.order };
            let include = false;
            if (item.promptType.includes('likert') && item.value !== null) { entry.likertResponse = item.value; include = true; }
            if (item.promptType === 'text' && typeof item.value === 'string' && item.value.trim()) { entry.textResponse = item.value; include = true; }
            if (item.promptType === 'dropdown' && typeof item.value === 'string' && item.value) { entry.dropdownResponse = item.value; include = true; }
            if (item.promptType === 'checkbox') { entry.checkboxResponse = item.value; include = true; }
            return include ? [entry] : [];
        });
        reviewObj.promptResponses = responses;

        axios.post('/peerreview', reviewObj).then((res) => {
            setSavingReview(false);
            if (!res.data.err) setShowSuccess(true);
            else handleGlobalError(res.data.errMsg);
        }).catch((err) => {
            setSavingReview(false);
            handleGlobalError(err);
        });
    };

    const handleCloseReview = () => {
        setShowSuccess(false);
        if (typeof onClose === 'function') onClose();
    };

    const handleFieldChange = (promptObj, newValue) => {
        const val = (typeof promptObj.promptType === 'string' && promptObj.promptType.includes('likert'))
            ? parseInt(newValue, 10)
            : newValue;
        setAllElements((prev) => prev.map((item) =>
            item.order === promptObj.order ? { ...item, value: val } : item
        ));
    };

    return (
        <>
            <Modal open={open} onClose={handleCloseReview} size="full">
                <Modal.Header>
                    <Modal.Title>{demoView ? 'Preview' : 'Submit'} Peer Review</Modal.Title>
                </Modal.Header>
                <Modal.Body className="space-y-4">
                    {!loadedRubric && (
                        <div className="flex justify-center my-6">
                            <Spinner />
                        </div>
                    )}

                    {user.isAuthenticated && !demoView && (
                        <Alert
                            variant="info"
                            message={`You are logged into Conductor as ${user.firstName} ${user.lastName}.`}
                        />
                    )}

                    <Alert
                        variant="info"
                        message={
                            isPublicView
                                ? "Your name will be attached to this Peer Review. Peer Reviews for this resource are visible to all. Your email remains private."
                                : "Your name will be attached to this Peer Review. If this Project is 'Public' and attached to a LibreTexts resource, its Peer Reviews are visible to all. Your email remains private."
                        }
                    />

                    {typeof rubric.rubricTitle === 'string' && (
                        <p className="text-sm text-gray-700">
                            <strong>Rubric:</strong> {rubric.rubricTitle}
                        </p>
                    )}

                    <div className="space-y-4">
                        {(!user.isAuthenticated || demoView) && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="First Name"
                                    placeholder="Enter first name..."
                                    required
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    error={firstNameErr}
                                    errorMessage={firstNameErr ? 'First name is required.' : undefined}
                                />
                                <Input
                                    label="Last Name"
                                    placeholder="Enter last name..."
                                    required
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    error={lastNameErr}
                                    errorMessage={lastNameErr ? 'Last name is required.' : undefined}
                                />
                                <Input
                                    label="Email"
                                    type="email"
                                    placeholder="Enter email..."
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    error={emailErr}
                                    errorMessage={emailErr ? 'Email is required.' : undefined}
                                    className="sm:col-span-2"
                                />
                            </div>
                        )}

                        <Select
                            label="I am a(n)"
                            placeholder="Choose..."
                            required
                            options={authorTypeOpts}
                            value={authorType}
                            onChange={(e) => setAuthorType(e.target.value)}
                            error={authorTypeErr}
                            errorMessage={authorTypeErr ? 'Please select your author type.' : undefined}
                        />

                        <div>
                            <p className={`text-sm font-medium mb-1 ${ratingErr ? 'text-red-600' : ''}`}>
                                Please rate this resource's overall quality{' '}
                                <span aria-hidden="true" className="text-red-500">*</span>
                            </p>
                            <div className="flex justify-center">
                                <StarRating
                                    value={rating}
                                    onChange={(value) => { setRating(value); if (value > 0) setRatingErr(false); }}
                                    fieldLabel="peerreview-starrating-label"
                                    fieldRequired
                                />
                            </div>
                            {ratingErr && (
                                <p role="alert" className="text-red-600 text-sm mt-1">
                                    Please rate this resource.
                                </p>
                            )}
                        </div>

                        {allElements.map((item) => {
                            if (item.uiType === 'heading') {
                                return (
                                    <h4 key={item.order} className="text-base font-semibold border-b pb-1 mt-6">
                                        {item.text}
                                    </h4>
                                );
                            }
                            if (item.uiType === 'textBlock') {
                                return (
                                    <p
                                        key={item.order}
                                        className="prose prose-code:before:hidden prose-code:after:hidden"
                                        dangerouslySetInnerHTML={{
                                            __html: DOMPurify.sanitize(marked(item.text)),
                                        }}
                                    />
                                );
                            }
                            if (item.uiType === 'prompt') {
                                if (item.promptType === '3-likert' || item.promptType === '5-likert' || item.promptType === '7-likert') {
                                    const points = item.promptType === '3-likert' ? 3 : item.promptType === '5-likert' ? 5 : 7;
                                    return (
                                        <DavisLikertScale
                                            key={item.order}
                                            name={`prompt-${item.order}`}
                                            label={item.promptText ?? ''}
                                            points={points}
                                            value={item.value}
                                            onChange={(val) => handleFieldChange(item, val)}
                                            required={item.promptRequired}
                                            error={item.error}
                                            errorMessage={item.error ? 'This field is required.' : undefined}
                                        />
                                    );
                                }
                                if (item.promptType === 'text') {
                                    return (
                                        <Textarea
                                            key={item.order}
                                            label={item.promptText ?? ''}
                                            placeholder="Enter your response..."
                                            required={item.promptRequired}
                                            value={item.value ?? ''}
                                            onChange={(e) => handleFieldChange(item, e.target.value)}
                                            error={item.error}
                                            errorMessage={item.error ? 'This field is required.' : undefined}
                                        />
                                    );
                                }
                                if (item.promptType === 'dropdown' && Array.isArray(item.promptOptions)) {
                                    const dropdownOpts = item.promptOptions.map((o) => ({
                                        value: typeof o === 'string' ? o : o.value,
                                        label: typeof o === 'string' ? o : (o.text ?? o.label ?? o.value),
                                    }));
                                    return (
                                        <Select
                                            key={item.order}
                                            label={item.promptText ?? ''}
                                            placeholder="Choose..."
                                            required={item.promptRequired}
                                            options={dropdownOpts}
                                            value={item.value ?? ''}
                                            onChange={(e) => handleFieldChange(item, e.target.value)}
                                            error={item.error}
                                            errorMessage={item.error ? 'This field is required.' : undefined}
                                        />
                                    );
                                }
                                if (item.promptType === 'checkbox') {
                                    return (
                                        <div key={item.order}>
                                            <Checkbox
                                                name={`pr-checkbox-${item.order}`}
                                                label={item.promptText ?? ''}
                                                checked={item.value === true}
                                                onChange={(checked) => handleFieldChange(item, checked)}
                                                required={item.promptRequired}
                                                error={item.error}
                                            />
                                            {item.error && (
                                                <p role="alert" className="text-red-600 text-sm mt-1">
                                                    This field is required.
                                                </p>
                                            )}
                                        </div>
                                    );
                                }
                            }
                            return null;
                        })}

                        {loadedRubric && allElements.length === 0 && (
                            <p className="text-center text-gray-400 py-8">No rubric configuration found.</p>
                        )}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    {demoView ? (
                        <Button onClick={onClose}>Done</Button>
                    ) : (
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button loading={savingReview} onClick={submitReview}>Submit Review</Button>
                        </div>
                    )}
                </Modal.Footer>
            </Modal>

            <Modal open={showSuccess} onClose={handleCloseReview}>
                <Modal.Header>
                    <Modal.Title>Peer Review Submitted</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Thank you for submitting a Peer Review!</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleCloseReview}>Done</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

PeerReview.defaultProps = {
    projectID: '',
    rubricID: '',
    isPublicView: false,
    demoView: false,
    open: false,
    onClose: () => {},
};

PeerReview.propTypes = {
    projectID: PropTypes.string,
    rubricID: PropTypes.string,
    isPublicView: PropTypes.bool,
    demoView: PropTypes.bool,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};

export default PeerReview;
