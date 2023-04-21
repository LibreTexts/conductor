import './PeerReview.css';
import '@fortawesome/fontawesome-free/css/all.css';

import {
    Header,
    Segment,
    Button,
    Icon,
    Message,
    Modal,
    Form,
    Loader
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

import Breakpoint from '../util/Breakpoints.tsx';
import TextArea from '../TextArea';
import StarRating from './StarRating.jsx';

import {
    peerReviewAuthorTypes,
    peerReviewThreePointLikertOptions,
    peerReviewFivePointLikertOptions,
    peerReviewSevenPointLikertOptions
} from '../util/ProjectHelpers.js';
import { isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks';


const PeerReview = ({
    projectID,
    rubricID,
    isPublicView,
    demoView,
    open,
    onClose,
    ...props
}) => {

    /* Global State and Error Handling */
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    /* UI and Rubric State */
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


    /**
     * Initialization and register plugins.
     */
    useEffect(() => {
        // Hook to force Markdown links to open in new window
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
            if ('target' in node) {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer')
            }
        });
    }, []);


    /**
     * Processes all form elements for UI presentation whenever the form configuration changes.
     */
    useEffect(() => {
        let allElem = [];
        if (Array.isArray(rubric.headings)) {
            let headings = rubric.headings.map((item) => {
                return {
                    ...item,
                    uiType: 'heading'
                }
            });
            allElem = [...allElem, ...headings];
        }
        if (Array.isArray(rubric.textBlocks)) {
            let textBlocks = rubric.textBlocks.map((item) => {
                return {
                    ...item,
                    uiType: 'textBlock'
                };
            });
            allElem = [...allElem, ...textBlocks];
        }
        if (Array.isArray(rubric.prompts)) {
            let prompts = rubric.prompts.map((item) => {
                let initValue = null;
                if (item.promptType === 'text' || item.promptType === 'dropdown') {
                    initValue = "";
                } else if (item.promptType === 'checkbox') {
                    initValue = false;
                }
                return {
                    ...item,
                    uiType: 'prompt',
                    error: false,
                    value: initValue
                };
            });
            allElem = [...allElem, ...prompts];
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
    }, [rubric, setAllElements]);


    /**
     * Retrieves the proper Peer Review Rubric configuration from the server and enters it into state.
     */
    useEffect(() => {
        let rubricURL = null;
        let options = {};
        if (open === true || demoView === true) {
            if (!isEmptyString(projectID)) {
                rubricURL = '/peerreview/projectrubric';
                options = {
                    params: {
                        projectID: projectID
                    }
                };
            } else if (!isEmptyString(rubricID)) {
                rubricURL = '/peerreview/rubric';
                options = {
                    params: {
                        rubricID: rubricID
                    }
                };
            }
            if (rubricURL !== null) {
                axios.get(rubricURL, options).then((res) => {
                    if (!res.data.err) {
                        if (typeof (res.data.rubric) === 'object') {
                            setRubric(res.data.rubric);
                        }
                    } else if (demoView === false || open === true) {
                        handleGlobalError(res.data.errMsg);
                    }
                    setLoadedRubric(true);
                }).catch((err) => {
                    setLoadedRubric(true);
                    handleGlobalError(err);
                });
            }
        }
    }, [projectID, rubricID, demoView, open, setRubric, setLoadedRubric, handleGlobalError]);


    /**
     * Checks that all fields have valid responses and updates their error state.
     * @returns {Boolean} True if form is valid, false otherwise.
     */
    const validateForm = () => {
        let valid = true;
        if (isEmptyString(authorType)) {
            valid = false;
            setAuthorTypeErr(true);
        } else {
            setAuthorTypeErr(false);
        }
        if (!user.isAuthenticated) {
            if (isEmptyString(firstName)) {
                valid = false;
                setFirstNameErr(true);
            } else {
                setFirstNameErr(false);
            }
            if (isEmptyString(lastName)) {
                valid = false;
                setLastNameErr(true);
            } else {
                setLastNameErr(false);
            }
            if (isEmptyString(email)) {
                valid = false;
                setEmailErr(true);
            } else {
                setEmailErr(false);
            }
        }
        if (rating < 0.5 || rating > 5) {
            valid = false;
            setRatingErr(true);
        }
        let formUpdate = allElements.map((item) => {
            if (item.uiType === 'prompt') {
                let updatedItem = { ...item };
                if (item.promptRequired === true) {
                    if (item.promptType === '3-likert' && (item.value < 1 || item.value > 3)) {
                        valid = false;
                        updatedItem.error = true;
                    } else if (item.promptType === '5-likert' && (item.value < 1 || item.value > 5)) {
                        valid = false;
                        updatedItem.error = true;
                    } else if (item.promptType === '7-likert' && (item.value < 1 || item.value > 7)) {
                        valid = false;
                        updatedItem.error = true;
                    } else if ((item.promptType === 'text' || item.promptType === 'dropdown') && isEmptyString(item.value)) {
                        valid = false;
                        updatedItem.error = true;
                    } else if (item.promptType === 'checkbox' && item.value !== true) {
                        valid = false;
                        updatedItem.error = true;
                    } else {
                        updatedItem.error = false;
                    }
                } else if (
                    item.promptType === 'text'
                    && typeof (item.value) === 'string'
                    && item.value.length > 10000
                ) {
                    valid = false;
                    updatedItem.error = true;
                } else {
                    updatedItem.error = false;
                }
                return updatedItem;
            }
            return item;
        });
        setAllElements(formUpdate);
        return valid;
    };


    /**
     * Processes the Review form and, if valid, submits it to the server, then closes the modal.
     */
    const submitReview = () => {
        setSavingReview(true);
        if (validateForm() && !isEmptyString(projectID)) {
            let reviewObj = {
                projectID: projectID,
                authorType: authorType,
                rating: rating
            };
            if (!user.isAuthenticated) {
                reviewObj = {
                    ...reviewObj,
                    authorFirst: firstName,
                    authorLast: lastName,
                    authorEmail: email
                }
            }
            let responses = allElements.map((item) => {
                if (item.uiType === 'prompt' && typeof (item.promptType) === 'string') {
                    let includeResponse = false;
                    let responseObj = {
                        promptID: item._id,
                        promptType: item.promptType,
                        order: item.order
                    };
                    if (item.promptType.includes('likert') & item.value !== null) {
                        includeResponse = true;
                        responseObj.likertResponse = item.value;
                    }
                    if (item.promptType === 'text' && typeof (item.value) === 'string' && item.value.trim().length > 0) {
                        includeResponse = true;
                        responseObj.textResponse = item.value;
                    }
                    if (item.promptType === 'dropdown' && typeof (item.value) === 'string' && item.value.length > 0) {
                        includeResponse = true;
                        responseObj.dropdownResponse = item.value;
                    }
                    if (item.promptType === 'checkbox') {
                        includeResponse = true;
                        responseObj.checkboxResponse = item.value;
                    }
                    if (includeResponse) return responseObj;
                }
                return null;
            }).filter((item) => item !== null);
            reviewObj.promptResponses = responses;
            axios.post('/peerreview', reviewObj).then((res) => {
                if (!res.data.err) {
                    setSavingReview(false);
                    setShowSuccess(true);
                } else {
                    setSavingReview(false);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                setSavingReview(false);
                handleGlobalError(err);
            });
        } else {
            setSavingReview(false);
        }
    };


    /**
     * Closes the Success Modal and triggers the onClose function.
     */
    const handleCloseReview = () => {
        setShowSuccess(false);
        if (typeof (onClose) === 'function') onClose();
    };


    /**
     * Renders a Likert Scale response input.
     * @param {Object} props - Props to pass to the Likert Scale.
     * @param {Number} props.points - The number of Likert points to render (3,5,7).
     * @param {Number} props.promptOrder - The 'order' property of the containing prompt.
     * @param {Number} props.pointChecked - The value of the currently checked point.
     * @param {Function} props.onPointChange - The handler to run when the checked point is changed.
     * @param {Boolean} props.error - If the scale is in an error state.
     * @returns {JSX.Element} A div containing the rendered Likert Scale.
     */
    const LikertScale = ({ points, promptOrder, pointChecked, onPointChange, error }) => {
        let pointOptions = [];
        if (points === 3) {
            pointOptions = peerReviewThreePointLikertOptions;
        } else if (points === 5) {
            pointOptions = peerReviewFivePointLikertOptions;
        } else if (points === 7) {
            pointOptions = peerReviewSevenPointLikertOptions;
        }
        return (
            <div className='likert-row'>
                {(pointOptions.map((item, idx) => {
                    let likertIndex = idx + 1;
                    return (
                        <div className='likert-option' key={`prompt-${promptOrder}-container-${likertIndex}`}>
                            <input
                                type='radio'
                                name={`prompt-${promptOrder}`}
                                value={likertIndex}
                                id={`prompt-${promptOrder}-${likertIndex}`}
                                checked={pointChecked === likertIndex}
                                onChange={(e) => {
                                    if (onPointChange !== undefined) onPointChange(e.target.value);
                                }}
                            />
                            <label
                                htmlFor={`prompt-${promptOrder}-${likertIndex}`}
                                className={`${error ? 'form-error-label' : ''}`}
                            >
                                {item}
                            </label>
                        </div>
                    )
                }))}
            </div>
        )
    };


    /**
     * Updates state with the new value of a Prompt input.
     * @param {Object} promptObj - The Prompt's information object.
     * @param {String|Boolean} newValue - The new value of the Prompt input to save.
     */
    const handleFieldChange = (promptObj, newValue) => {
        let newValInternal = newValue;
        if (typeof (promptObj.promptType) === 'string' && promptObj.promptType.includes('likert')) {
            newValInternal = parseInt(newValue); // assert number
        }
        let updatedValues = allElements.map((item) => {
            let updatedVal = { ...item };
            if (item.order === promptObj.order) updatedVal.value = newValInternal;
            return updatedVal;
        });
        setAllElements(updatedValues);
    };


    return (
        <>
            <Modal
                open={open}
                onClose={handleCloseReview}
                size='fullscreen'
                role='dialog'
                aria-labelledby='peerreview-modal-title'
            >
                <Modal.Header id='peerreview-modal-title'>{demoView ? 'Preview' : 'Submit'} Peer Review</Modal.Header>
                <Modal.Content
                    scrolling
                    className='peerreview-modal-content'
                >
                    {!loadedRubric && (
                        <div className='mt-4p mb-4p'>
                            <Loader
                                active
                                size='large'
                                inline='centered'
                            />
                        </div>
                    )}
                    {(user.isAuthenticated && !demoView) && (
                        <Message info>
                            <Message.Content>
                                <Breakpoint name='desktop'>
                                    <Icon.Group size='big'>
                                        <Icon name='user circle' />
                                        <Icon corner name='key' />
                                    </Icon.Group>
                                    <span className='ml-1p'>You're logged into Conductor as <strong>{user.firstName} {user.lastName}</strong>.</span>
                                </Breakpoint>
                                <Breakpoint name='mobileOrTablet'>
                                    <div className='text-center'>
                                        <div>
                                            <Icon.Group size='big'>
                                                <Icon name='user circle' />
                                                <Icon corner name='key' />
                                            </Icon.Group>
                                        </div>
                                        <p>You're logged into Conductor as <strong>{user.firstName} {user.lastName}</strong>.</p>
                                    </div>
                                </Breakpoint>
                            </Message.Content>
                        </Message>
                    )}
                    <Message info>
                        <Message.Content>
                            <Breakpoint name='desktop'>
                                <Icon.Group size='big'>
                                    <Icon name='info circle' />
                                    <Icon corner name='eye' />
                                </Icon.Group>
                                <span className='ml-1p'>
                                    Your name will be attached to this Peer Review.
                                    {isPublicView
                                        ? <em> Peer Reviews for this resource are visible to all. Your email remains private.</em>
                                        : <em> <strong>Remember:</strong> if this Project is 'Public' and attached to a LibreTexts resource, its Peer Reviews are visible to all. Your email remains private.</em>
                                    }
                                </span>
                            </Breakpoint>
                            <Breakpoint name='mobileOrTablet'>
                                <div className='text-center'>
                                    <div>
                                        <Icon.Group size='big'>
                                            <Icon name='info circle' />
                                            <Icon corner name='eye' />
                                        </Icon.Group>
                                    </div>
                                    <p>Your name will be attached to this Peer Review.</p>
                                    <p>
                                        {isPublicView
                                            ? <em> Peer Reviews for this resource are visible to all. Your email remains private.</em>
                                            : <em> <strong>Remember:</strong> if this Project is 'Public' and attached to a LibreTexts resource, its Peer Reviews are visible to all. Your email remains private.</em>
                                        }
                                    </p>
                                </div>
                            </Breakpoint>
                        </Message.Content>
                    </Message>
                    <Segment.Group>
                        {(typeof(rubric.rubricTitle) === 'string') && (
                            <Segment>
                                <p><strong>Rubric:</strong> {rubric.rubricTitle}</p>
                            </Segment>
                        )}
                        <Segment>
                            <Form noValidate className='peerreview-form'>
                                {(!user.isAuthenticated || demoView) && (
                                    <>
                                        <Form.Group widths='equal'>
                                            <Form.Input
                                                label='First Name'
                                                fluid
                                                placeholder='Enter first name...'
                                                required
                                                type='text'
                                                value={firstName}
                                                onChange={(_e, { value }) => setFirstName(value)}
                                                error={firstNameErr}
                                            />
                                            <Form.Input
                                                label='Last Name'
                                                fluid
                                                placeholder='Enter last name...'
                                                required
                                                type='text'
                                                value={lastName}
                                                onChange={(_e, { value }) => setLastName(value)}
                                                error={lastNameErr}
                                            />
                                        </Form.Group>
                                        <Form.Input
                                            label='Email'
                                            fluid
                                            placeholder='Enter email...'
                                            required
                                            type='email'
                                            value={email}
                                            onChange={(_e, { value }) => setEmail(value)}
                                            error={emailErr}
                                        />
                                    </>
                                )}
                                <Form.Select
                                    options={peerReviewAuthorTypes}
                                    fluid
                                    selection
                                    label='I am a(n)'
                                    required
                                    placeholder='Choose...'
                                    value={authorType}
                                    onChange={(_e, { value }) => setAuthorType(value)}
                                    error={authorTypeErr}
                                    className='mb-3p'
                                    aria-required='true'
                                />
                                <p
                                    id='peerreview-starrating-label'
                                    className={`form-field-label form-required ${ratingErr ? 'form-error-label' : ''}`}
                                >
                                    Please rate this resource's overall quality:
                                </p>
                                <div className='center-flex'>
                                    <StarRating
                                        value={rating}
                                        onChange={(value) => setRating(value)}
                                        fieldLabel='peerreview-starrating-label'
                                        fieldRequired={true}
                                    />
                                </div>
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
                                    } else if (item.uiType === 'prompt') {
                                        if (item.promptType === '3-likert') {
                                            return (
                                                <Form.Field className='mt-2p mb-2p' key={item.order}>
                                                    <label
                                                        className={`${item.promptRequired ? 'form-required' : ''} ${item.error ? 'form-error-label' : ''} mb-05p`}
                                                    >
                                                        {item.promptText}
                                                    </label>
                                                    <LikertScale
                                                        points={3}
                                                        promptOrder={item.order}
                                                        pointChecked={item.value}
                                                        onPointChange={(value) => handleFieldChange(item, value)}
                                                        error={item.error}
                                                    />
                                                </Form.Field>
                                            )
                                        } else if (item.promptType === '5-likert') {
                                            return (
                                                <Form.Field className='mt-2p mb-2p' key={item.order}>
                                                    <label
                                                        className={`${item.promptRequired ? 'form-required' : ''} ${item.error ? 'form-error-label' : ''} mb-05p`}
                                                    >
                                                        {item.promptText}
                                                    </label>
                                                    <LikertScale
                                                        points={5}
                                                        promptOrder={item.order}
                                                        pointChecked={item.value}
                                                        onPointChange={(value) => handleFieldChange(item, value)}
                                                        error={item.error}
                                                    />
                                                </Form.Field>
                                            )
                                        } else if (item.promptType === '7-likert') {
                                            return (
                                                <Form.Field className='mt-2p mb-2p' key={item.order}>
                                                    <label
                                                        className={`${item.promptRequired ? 'form-required' : ''} ${item.error ? 'form-error-label' : ''} mb-05p`}
                                                    >
                                                        {item.promptText}
                                                    </label>
                                                    <LikertScale
                                                        points={7}
                                                        promptOrder={item.order}
                                                        pointChecked={item.value}
                                                        onPointChange={(value) => handleFieldChange(item, value)}
                                                        error={item.error}
                                                    />
                                                </Form.Field>
                                            )
                                        } else if (item.promptType === 'text') {
                                            return (
                                                <Form.Field className='mb-2p' key={item.order}>
                                                    <label className={item.promptRequired ? 'form-required' : ''}>{item.promptText}</label>
                                                    <TextArea
                                                        placeholder='Enter your response...'
                                                        textValue={item.value}
                                                        onTextChange={(value) => handleFieldChange(item, value)}
                                                        hideFormatMsg
                                                        contentType='response'
                                                        error={item.error}
                                                    />
                                                </Form.Field>
                                            )
                                        } else if (item.promptType === 'dropdown' && Array.isArray(item.promptOptions)) {
                                            return (
                                                <Form.Select
                                                    key={item.order}
                                                    fluid
                                                    selection
                                                    label={item.promptText}
                                                    options={item.promptOptions}
                                                    required={item.promptRequired}
                                                    placeholder='Choose...'
                                                    value={item.value}
                                                    onChange={(_e, { value }) => handleFieldChange(item, value)}
                                                    error={item.error}
                                                />
                                            )
                                        } else if (item.promptType === 'checkbox') {
                                            return (
                                                <Form.Checkbox
                                                    id={`peerreview-checkbox-${item.order}`}
                                                    key={item.order}
                                                    required={item.promptRequired}
                                                    label={(
                                                        <label
                                                            className='form-field-label'
                                                            htmlFor={`peerreview-checkbox-${item.order}`}
                                                        >
                                                            {item.promptText}
                                                        </label>
                                                    )}
                                                    checked={item.value}
                                                    onChange={() => handleFieldChange(item, !item.value)}
                                                    error={item.error}
                                                />
                                            )
                                        }
                                    }
                                    return null;
                                })}
                                {(loadedRubric && allElements.length === 0) && (
                                    <p className='text-center muted-text mt-4p mb-2p'>No rubric configuration found.</p>
                                )}
                            </Form>
                        </Segment>
                    </Segment.Group>
                </Modal.Content>
                <Modal.Actions>
                    {demoView ? (
                        <Button
                            color='blue'
                            content='Done'
                            onClick={onClose}
                        />
                    ) : (
                        <>
                            <Button
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={savingReview}
                                onClick={submitReview}
                                disabled={demoView}
                            >
                                <Icon name='save' />
                                Submit Review
                            </Button>
                        </>
                    )}
                </Modal.Actions>
            </Modal>
            <Modal
                open={showSuccess}
                onClose={handleCloseReview}
            >
                <Modal.Header>Peer Review Submitted</Modal.Header>
                <Modal.Content>
                    <p>Thank you for submitting a Peer Review!</p>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        color='blue'
                        content='Done'
                        onClick={handleCloseReview}
                    />
                </Modal.Actions>
            </Modal>
        </>
    )
};

PeerReview.defaultProps = {
    projectID: '',
    rubricID: '',
    isPublicView: false,
    demoView: false,
    open: false,
    onClose: () => { }
};

PeerReview.propTypes = {
    projectID: PropTypes.string,
    rubricID: PropTypes.string,
    isPublicView: PropTypes.bool,
    demoView: PropTypes.bool,
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired
};

export default PeerReview;