import './AdoptionReport.css';

import {
    Header,
    Button,
    Modal,
    Form,
    Input,
    Divider,
    Checkbox
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks.js';

import {
    iAmOptions,
    libreNetOptions,
    studentUseOptions,
    instrTaughtOptions
} from './AdoptionReportOptions.js';
import { isEmptyString } from '../util/HelperFunctions.js';

const AdoptionReport = (props) => {

    const { setError } = useGlobalError();

    // Main
    const [showModal, setShowModal] = useState(false); // Controlled by the @open prop — do not modify directly
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [iAm, setIAm] = useState('');
    const [comments, setComments] = useState('');

    // Instructor
    const [libreNetInst, setLibreNetInst] = useState('');
    const [instrInstName, setInstrInstName] = useState('');
    const [instrClassName, setInstrClassName] = useState('');
    const [instrTaughtTerm, setInstrTaughtTerm] = useState('');
    const [instrNumStudents, setInstrNumStudents] = useState(0);
    const [instrReplaceCost, setInstrReplaceCost] = useState(0);
    const [instrPrintCost, setInstrPrintCost] = useState(0);
    const [instrStudentAccess, setInstrStudentAccess] = useState(
        new Array(5).fill(false)
    );

    // Student
    const [studentUse, setStudentUse] = useState('');
    const [studentInst, setStudentInst] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [studentInstr, setStudentInstr] = useState('');
    const [studentQuality, setStudentQuality] = useState(0);
    const [studentNavigate, setStudentNavigate] = useState(0);
    const [studentPrintCost, setStudentPrintCost] = useState(0);
    const [studentAccess, setStudentAccess] = useState(
        new Array(5).fill(false)
    );

    // Form Errors
    const [emailErr, setEmailErr] = useState(false);
    const [nameErr, setNameErr] = useState(false);
    const [iAmErr, setIAmErr] = useState(false);
    const [libreNetInstErr, setLibreNetInstErr] = useState(false);
    const [instrInstNameErr, setInstrInstNameErr] = useState(false);
    const [instrClassNameErr, setInstrClassNameErr] = useState(false);
    const [instrTaughtTermErr, setInstrTaughtTermErr] = useState(false);
    const [instrNumStudentsErr, setInstrNumStudentsErr] = useState(false);

    /**
     * Open or close the modal depending on the
     * boolean passed from the parent/host component
     */
    useEffect(() => {
        setShowModal(props.open);
    }, [props.open])

    const handleInputChange = (e) => {
        switch (e.target.id) {
            case 'ar-email-input':
                setEmail(e.target.value);
                break;
            case 'ar-name-input':
                setName(e.target.value);
                break;
            case 'ar-not-libre-inst-input':
                setInstrInstName(e.target.value);
                break;
            case 'ar-instr-class-input':
                setInstrClassName(e.target.value);
                break;
            case 'ar-instr-num-students-input':
                setInstrNumStudents(e.target.value);
                break;
            case 'ar-instr-replace-cost-input':
                setInstrReplaceCost(e.target.value);
                break;
            case 'ar-instr-print-cost-input':
                setInstrPrintCost(e.target.value);
                break;
            case 'ar-student-inst-input':
                setStudentInst(e.target.value);
                break;
            case 'ar-student-class-input':
                setStudentClass(e.target.value);
                break;
            case 'ar-student-instructor-input':
                setStudentInstr(e.target.value);
                break;
            case 'ar-student-print-cost-input':
                setStudentPrintCost(e.target.value);
                break;
            case 'ar-addtl-comments-input':
                setComments(e.target.value);
                break;
            default:
                break // Silence React warning
        }
    };


    /** Form input handlers **/
    const handleInstrStudentAccessChange = (index) => {
        const updated = instrStudentAccess.map((item, idx) => {
            if (index === idx) {
                return !item;
            } else {
                return item;
            }
        });
        setInstrStudentAccess(updated);
    };

    const handleStudentAccessChange = (index) => {
        const updated = studentAccess.map((item, idx) => {
            if (index === idx) {
                return !item;
            } else {
                return item;
            }
        });
        setStudentAccess(updated);
    };

    const handleLibreNetInstChange = (e, { value }) => {
        setLibreNetInst(value);
    };

    const handleStudentQualityChange = (e, { value }) => {
        setStudentQuality(value);
    };

    const handleStudentNavigateChange = (e, { value }) => {
        setStudentNavigate(value);
    };

    /**
     * Reset all fields, then call the onClose function
     * passed from the parent/host component. Parent component
     * should modify the @open prop value in/after the onClose
     * function to properly close the modal.
     */
    const closeModal = () => {
        resetFormErrors();
        setEmail('');
        setName('');
        setIAm('');
        setComments('');
        setLibreNetInst('');
        setInstrInstName('');
        setInstrClassName('');
        setInstrTaughtTerm('');
        setInstrNumStudents(0);
        setInstrReplaceCost(0);
        setInstrPrintCost(0);
        setInstrStudentAccess(
            new Array(5).fill(false)
        );
        setStudentUse('');
        setStudentInst('');
        setStudentClass('');
        setStudentInstr('');
        setStudentQuality(0);
        setStudentNavigate(0);
        setStudentPrintCost(0);
        setStudentAccess(
            new Array(5).fill(false)
        );
        setShowSuccessModal(false);
        props.onClose();
    };

    /**
     * Validate the form data, return
     * 'false' if validation errors exists,
     * 'true' otherwise
     */
    const validateForm = () => {
        var validForm = true;
        if (!props.resourceID || !props.resourceTitle || !props.resourceLibrary ||  isEmptyString(props.resourceID) || isEmptyString(props.resourceTitle) || isEmptyString(props.resourceLibrary)) {
            setError("Sorry, required internal values appear to be missing. Try reloading this page and submitting the form again.");
            validForm = false;
        }
        if (isEmptyString(email)) {
            validForm = false;
            setEmailErr(true);
        }
        if (isEmptyString(name)) {
            validForm = false;
            setNameErr(true);
        }
        if (isEmptyString(iAm)) {
            validForm = false;
            setIAmErr(true);
        }
        if (iAm === 'instructor') {
            if (isEmptyString(libreNetInst)) {
                validForm = false;
                setLibreNetInstErr(true);
            }
            if (isEmptyString(instrInstName)) {
                validForm = false;
                setInstrInstNameErr(true);
            }
            if (isEmptyString(instrClassName)) {
                validForm = false;
                setInstrClassNameErr(true);
            }
            if (isEmptyString(instrTaughtTerm)) {
                validForm = false;
                setInstrTaughtTermErr(true);
            }
            if (instrNumStudents === 0) {
                validForm = false;
                setInstrNumStudentsErr(true);
            }
        }
        return validForm;
    };

    /**
     * Reset all form error states
     */
    const resetFormErrors = () => {
        setEmailErr(false);
        setNameErr(false);
        setIAmErr(false);
        setLibreNetInstErr(false);
        setInstrInstNameErr(false);
        setInstrClassNameErr(false);
        setInstrTaughtTermErr(false);
        setInstrNumStudentsErr(false);
    };


    /**
     * Process a REST-returned error object and activate
     * the global error modal
     */
    const handleErr = (err) => {
        var message = "";
        if (err.response) {
            if (err.response.data.errMsg !== undefined) {
                message = err.response.data.errMsg;
            } else {
                message = "Error processing request.";
            }
            if (err.response.data.errors) {
                if (err.response.data.errors.length > 0) {
                    message = message.replace(/\./g, ': ');
                    err.response.data.errors.forEach((elem, idx) => {
                        if (elem.param) {
                            message += (String(elem.param).charAt(0).toUpperCase() + String(elem.param).slice(1));
                            if ((idx + 1) !== err.response.data.errors.length) {
                                message += ", ";
                            } else {
                                message += ".";
                            }
                        }
                    });
                }
            }
        } else if (err.name && err.message) {
            message = err.message;
        } else if (typeof(err) === 'string') {
            message = err;
        } else {
            message = err.toString();
        }
        setError(message);
    };

    /**
     * Submit data via POST to the server, then
     * call closeModal() on success.
     */
    const submitReport = () => {
        setSubmitLoading(true);
        resetFormErrors();
        if (validateForm()) {
            const formData = {
                email: email,
                name: name,
                role: iAm,
                comments: comments,
                resource: {
                    id: props.resourceID,
                    title: props.resourceTitle,
                    library: props.resourceLibrary
                }
            };
            if (iAm === 'instructor') {
                var postInstrStudentAccess = [];
                instrStudentAccess.forEach((item, idx) => {
                    switch (idx) {
                        case 0:
                            if (item === true) postInstrStudentAccess.push('online');
                            break;
                        case 1:
                            if (item === true) postInstrStudentAccess.push('print');
                            break;
                        case 2:
                            if (item === true) postInstrStudentAccess.push('pdf');
                            break;
                        case 3:
                            if (item === true) postInstrStudentAccess.push('lms');
                            break;
                        case 4:
                            if (item === true) postInstrStudentAccess.push('librebox');
                            break;
                        default:
                            break; // silence React warning
                    }
                });
                formData.instructor = {
                    isLibreNet: libreNetInst,
                    institution: instrInstName,
                    class: instrClassName,
                    term: instrTaughtTerm,
                    students: instrNumStudents,
                    replaceCost: instrReplaceCost,
                    printCost: instrPrintCost,
                    access: postInstrStudentAccess
                };
            } else if (iAm === 'student') {
                var postStudentAccess = [];
                studentAccess.forEach((item, idx) => {
                    switch (idx) {
                        case 0:
                            if (item === true) postStudentAccess.push('online');
                            break;
                        case 1:
                            if (item === true) postStudentAccess.push('print');
                            break;
                        case 2:
                            if (item === true) postStudentAccess.push('pdf');
                            break;
                        case 3:
                            if (item === true) postStudentAccess.push('lms');
                            break;
                        case 4:
                            if (item === true) postStudentAccess.push('librebox');
                            break;
                        default:
                            break; // silence React warning
                    }
                });
                formData.student = {
                    use: studentUse,
                    institution: studentInst,
                    class: studentClass,
                    instructor: studentInstr,
                    quality: studentQuality,
                    navigation: studentNavigate,
                    printCost: studentPrintCost,
                    access: postStudentAccess
                };
            }
            var postURL = "";
            if ((process.env.REACT_APP_ORG_ID !== 'libretexts') && (process.env.REACT_APP_ADOPTIONREPORT_URL)) {
                postURL = process.env.REACT_APP_ADOPTIONREPORT_URL;
            } else {
                postURL = '/adoptionreport';
            }
            axios.post(postURL, formData).then((res) => {
                if (!res.data.err) {
                    setShowSuccessModal(true);
                } else {
                    handleErr(res.data.errMsg);
                }
            }).catch((err) => {
                handleErr(err);
            });
        }
        setSubmitLoading(false);
    };

    return (
        <Modal
            onClose={closeModal}
            open={showModal}
            closeOnDimmerClick={false}
        >
            <Modal.Header>Adoption Report</Modal.Header>
            <Modal.Content scrolling>
                <p>If you are an instructor or student using this LibreText in your class, it would help us greatly if you would fill out this form.</p>
                <Form noValidate>
                    <Form.Group widths='equal'>
                        <Form.Field
                            required
                            error={emailErr}
                        >
                            <label htmlFor='email'>Your Email</label>
                            <Input
                                fluid
                                id='ar-email-input'
                                type='email'
                                name='email'
                                placeholder='Email...'
                                required
                                icon='mail'
                                iconPosition='left'
                                onChange={handleInputChange}
                                value={email}
                            />
                        </Form.Field>
                        <Form.Field
                            required
                            error={nameErr}
                        >
                            <label htmlFor='name'>Your Name</label>
                            <Input
                                fluid
                                id='ar-name-input'
                                type='text'
                                name='name'
                                placeholder='Name...'
                                required
                                icon='user'
                                iconPosition='left'
                                onChange={handleInputChange}
                                value={name}

                            />
                        </Form.Field>
                    </Form.Group>
                    <Form.Select
                        fluid
                        label='I am a(n)'
                        options={iAmOptions}
                        placeholder='Choose...'
                        onChange={(e, { value }) => { setIAm(value) }}
                        value={iAm}
                        required
                        error={iAmErr}
                    />
                    {(iAm === 'instructor') &&
                        <div>
                            <Divider />
                            <Header as='h3'>Instructor</Header>
                            <p>If you are using this LibreText in your class(es), please help us by providing some additional data.</p>
                            <Form.Group grouped required>
                                <label className='form-required'>Is your Institution part of the LibreNet consortium?</label>
                                <Form.Radio
                                    label='Yes'
                                    value='yes'
                                    onChange={handleLibreNetInstChange}
                                    checked={libreNetInst === 'yes'}
                                    error={libreNetInstErr}
                                />
                                <Form.Radio
                                    label='No'
                                    value='no'
                                    onChange={handleLibreNetInstChange}
                                    checked={libreNetInst === 'no'}
                                    error={libreNetInstErr}
                                />
                                <Form.Radio
                                    label="Don't Know"
                                    value='dk'
                                    onChange={handleLibreNetInstChange}
                                    checked={libreNetInst === 'dk'}
                                    error={libreNetInstErr}
                                />
                            </Form.Group>
                            {((libreNetInst === 'yes') || (libreNetInst === 'dk')) &&
                                <Form.Select
                                    fluid
                                    label='Institution Name'
                                    options={libreNetOptions}
                                    placeholder='Choose...'
                                    onChange={(e, { value }) => { setInstrInstName(value) }}
                                    value={instrInstName}
                                    required
                                    error={instrInstNameErr}
                                />
                            }
                            {(libreNetInst === 'no') &&
                                <Form.Field
                                    required
                                    error={instrInstNameErr}
                                >
                                    <label htmlFor='not-libre-inst'>Institution Name</label>
                                    <Input
                                        fluid
                                        id='ar-not-libre-inst-input'
                                        type='text'
                                        name='not-libre-inst'
                                        placeholder='Institution...'
                                        icon='university'
                                        iconPosition='left'
                                        onChange={handleInputChange}
                                        value={instrInstName}
                                    />
                                </Form.Field>
                            }
                            <Form.Field
                                required
                                error={instrClassNameErr}
                            >
                                <label htmlFor='instr-class'>Class Name</label>
                                <Input
                                    fluid
                                    id='ar-instr-class-input'
                                    type='text'
                                    name='instr-class'
                                    placeholder='Class...'
                                    icon='calendar alternate outline'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={instrClassName}
                                />
                            </Form.Field>
                            <p><em>If you have tought this class multiple times, please fill out this form for each.</em></p>
                            <Form.Select
                                fluid
                                label='When did you teach this class?'
                                options={instrTaughtOptions}
                                placeholder='Choose...'
                                onChange={(e, { value }) => { setInstrTaughtTerm(value) }}
                                value={instrTaughtTerm}
                                required
                                error={instrTaughtTermErr}
                            />
                            <Form.Field
                                required
                                error={instrNumStudentsErr}
                            >
                                <label htmlFor='instr-num-students'>Number of Students</label>
                                <Input
                                    fluid
                                    id='ar-instr-num-students-input'
                                    type='number'
                                    min={0}
                                    name='instr-num-students'
                                    placeholder='Number...'
                                    icon='users'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={instrNumStudents}
                                />
                            </Form.Field>
                            <Form.Field>
                                <label htmlFor='instr-replace-cost'>Cost of textbook that LibreTexts replaced</label>
                                <Input
                                    fluid={true}
                                    id='ar-instr-replace-cost-input'
                                    type='number'
                                    name='instr-replace-cost'
                                    placeholder='Cost...'
                                    icon='dollar'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={instrReplaceCost}
                                />
                            </Form.Field>
                            <Form.Group grouped>
                                <label>In which ways did students use this LibreText in your class? (Select all that apply)</label>
                                <Checkbox
                                    label='Online'
                                    className='ar-checkbox'
                                    checked={instrStudentAccess[0]}
                                    onChange={() => { handleInstrStudentAccessChange(0) }}
                                />
                                <Checkbox
                                    label='Printed Book'
                                    className='ar-checkbox'
                                    checked={instrStudentAccess[1]}
                                    onChange={() => { handleInstrStudentAccessChange(1) }}
                                />
                                <Checkbox
                                    label='Downloaded PDF'
                                    className='ar-checkbox'
                                    checked={instrStudentAccess[2]}
                                    onChange={() => { handleInstrStudentAccessChange(2) }}
                                />
                                <Checkbox
                                    label='Via LMS'
                                    className='ar-checkbox'
                                    checked={instrStudentAccess[3]}
                                    onChange={() => { handleInstrStudentAccessChange(3) }}
                                />
                                <Checkbox
                                    label='LibreTexts in a Box'
                                    className='ar-checkbox'
                                    checked={instrStudentAccess[4]}
                                    onChange={() => { handleInstrStudentAccessChange(4) }}
                                />
                            </Form.Group>
                            <Form.Field>
                                <label htmlFor='instr-print-cost'>If you used a printed version of this LibreText, how much did it cost?</label>
                                <Input
                                    fluid={true}
                                    id='ar-instr-print-cost-input'
                                    type='number'
                                    name='instr-print-cost'
                                    placeholder='Cost...'
                                    icon='book'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={instrPrintCost}
                                />
                            </Form.Field>
                        </div>
                    }
                    {(iAm === 'student') &&
                        <div>
                            <Divider />
                            <Header as='h3'>Student</Header>
                            <p>We are happy to hear that you are using LibreTexts in your classes.</p>
                            <Form.Select
                                fluid
                                label='How is this LibreText used in your class?'
                                options={studentUseOptions}
                                placeholder='Choose...'
                                onChange={(e, { value }) => { setStudentUse(value) }}
                                value={studentUse}
                            />
                            <Form.Field>
                                <label htmlFor='student-inst'>Institution Name</label>
                                <Input
                                    fluid
                                    id='ar-student-inst-input'
                                    type='text'
                                    name='student-inst'
                                    placeholder='Institution...'
                                    icon='university'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={studentInst}
                                />
                            </Form.Field>
                            <Form.Field>
                                <label htmlFor='student-class'>Class Name</label>
                                <Input
                                    fluid
                                    id='ar-student-class-input'
                                    type='text'
                                    name='student-class'
                                    placeholder='Class...'
                                    icon='calendar alternate outline'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={studentClass}
                                />
                            </Form.Field>
                            <Form.Field>
                                <label htmlFor='student-instructor'>Instructor Name</label>
                                <Input
                                    fluid
                                    id='ar-student-instructor-input'
                                    type='text'
                                    name='student-instructor'
                                    placeholder='Instructor...'
                                    icon='user circle outline'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={studentInstr}
                                />
                            </Form.Field>
                            <Form.Group grouped>
                                <label>On a scale from 1 to 5, what is the quality of this LibreTexts content?</label>
                                <Form.Radio
                                    label='1 (Very low)'
                                    value={1}
                                    onChange={handleStudentQualityChange}
                                    checked={studentQuality === 1}
                                />
                                <Form.Radio
                                    label='2'
                                    value={2}
                                    onChange={handleStudentQualityChange}
                                    checked={studentQuality === 2}
                                />
                                <Form.Radio
                                    label='3'
                                    value={3}
                                    onChange={handleStudentQualityChange}
                                    checked={studentQuality === 3}
                                />
                                <Form.Radio
                                    label='4'
                                    value={4}
                                    onChange={handleStudentQualityChange}
                                    checked={studentQuality === 4}
                                />
                                <Form.Radio
                                    label='5 (Very high)'
                                    value={5}
                                    onChange={handleStudentQualityChange}
                                    checked={studentQuality === 5}
                                />
                            </Form.Group>
                            <Form.Group grouped>
                                <label>On a scale from 1 to 5, how easy is it to navigate the LibreTexts site?</label>
                                <Form.Radio
                                    label='1 (Very hard)'
                                    value={1}
                                    onChange={handleStudentNavigateChange}
                                    checked={studentNavigate === 1}
                                />
                                <Form.Radio
                                    label='2'
                                    value={2}
                                    onChange={handleStudentNavigateChange}
                                    checked={studentNavigate === 2}
                                />
                                <Form.Radio
                                    label='3'
                                    value={3}
                                    onChange={handleStudentNavigateChange}
                                    checked={studentNavigate === 3}
                                />
                                <Form.Radio
                                    label='4'
                                    value={4}
                                    onChange={handleStudentNavigateChange}
                                    checked={studentNavigate === 4}
                                />
                                <Form.Radio
                                    label='5 (Very easy)'
                                    value={5}
                                    onChange={handleStudentNavigateChange}
                                    checked={studentNavigate === 5}
                                />
                            </Form.Group>
                            <Form.Group grouped>
                                <label>How did you access this LibreText? (Select all that apply)</label>
                                <Checkbox
                                    label='Online'
                                    className='ar-checkbox'
                                    checked={studentAccess[0]}
                                    onChange={() => { handleStudentAccessChange(0) }}
                                />
                                <Checkbox
                                    label='Printed Book'
                                    className='ar-checkbox'
                                    checked={studentAccess[1]}
                                    onChange={() => { handleStudentAccessChange(1) }}
                                />
                                <Checkbox
                                    label='Downloaded PDF'
                                    className='ar-checkbox'
                                    checked={studentAccess[2]}
                                    onChange={() => { handleStudentAccessChange(2) }}
                                />
                                <Checkbox
                                    label='Via LMS'
                                    className='ar-checkbox'
                                    checked={studentAccess[3]}
                                    onChange={() => { handleStudentAccessChange(3) }}
                                />
                                <Checkbox
                                    label='LibreTexts in a Box'
                                    className='ar-checkbox'
                                    checked={studentAccess[4]}
                                    onChange={() => { handleStudentAccessChange(4) }}
                                />
                            </Form.Group>
                            <Form.Field>
                                <label htmlFor='student-print-cost'>If you used a printed version of this LibreText, how much did it cost?</label>
                                <Input
                                    fluid
                                    id='ar-student-print-cost-input'
                                    type='number'
                                    name='student-print-cost'
                                    placeholder='Cost...'
                                    icon='book'
                                    iconPosition='left'
                                    onChange={handleInputChange}
                                    value={studentPrintCost}
                                />
                            </Form.Field>
                        </div>
                    }
                    <Divider />
                    <Form.Field>
                        <label htmlFor='addtl-comments'>If you have additional comments, please share below</label>
                        <Input
                            fluid
                            id='ar-addtl-comments-input'
                            type='text'
                            name='addtl-comments'
                            placeholder='Comments...'
                            icon='comment'
                            iconPosition='left'
                            onChange={handleInputChange}
                            value={comments}
                        />
                    </Form.Field>
                </Form>
            </Modal.Content>
            <Modal.Actions>
                <Button
                    content='Cancel'
                    onClick={closeModal}
                />
                <Button
                    content='Submit'
                    onClick={submitReport}
                    loading={submitLoading}
                    color='green'
                    labelPosition='right'
                    icon='check'
                />
            </Modal.Actions>
            <Modal
                onClose={closeModal}
                open={showSuccessModal}
                closeOnDimmerClick={false}
            >
                <Modal.Header>Adoption Report: Success</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>Thank you for submitting an Adoption Report!</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="blue" onClick={closeModal}>Done</Button>
                </Modal.Actions>
            </Modal>
        </Modal>
    )
}

export default AdoptionReport;
