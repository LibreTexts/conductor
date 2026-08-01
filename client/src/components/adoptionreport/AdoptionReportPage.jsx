import './AdoptionReport.css';

import {
    Button,
    Card,
    Checkbox,
    Grid,
    Heading,
    Input,
    Modal,
    RadioGroup,
    Select,
} from '@libretexts/davis-react';
import {
    IconBuilding,
    IconBook,
    IconCheck,
    IconCurrencyDollar,
    IconLink,
    IconMail,
    IconMessageCircle,
    IconPencil,
    IconUser,
    IconUserCircle,
    IconUsers,
} from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks';
import {
    iAmOptions,
    libreNetOptions,
    studentUseOptions,
    getInstructionTermOptions,
} from './AdoptionReportOptions.js';
import { libraryOptions } from '../util/LibraryOptions';
import { isEmptyString } from '../util/HelperFunctions.js';

/** Converts a Semantic-style {key, text, value} options array to Davis's {value, label},
 *  dropping the placeholder "Choose..." entry (Davis uses its own `placeholder` prop). */
const toSelectOptions = (opts) =>
    opts.filter((o) => o.value !== '').map((o) => ({ value: o.value, label: o.text }));

const AdoptionReportPage = (props) => {

    // Global State and Error Handling
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    // UI
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    /** Data **/
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
    const [instrResourceURL, setInstrResourceURL] = useState('');
    const [instrResourceLib, setInstrResourceLib] = useState('');
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
    const [instrResLibErr, setInstrResLibErr] = useState(false);

    const instrTaughtOptions = getInstructionTermOptions();

    /**
     * Update page title.
     */
    useEffect(() => {
        document.title = "LibreCommons | Adoption Report";
    }, []);


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


    /**
     * Validate the form data, return
     * 'true' if all fields are valid,
     * 'false' otherwise
     */
    const validateForm = () => {
        var validForm = true;
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
            if (isEmptyString(instrResourceLib)) {
                validForm = false;
                setInstrResLibErr(true);
            }
        }
        return validForm;
    };


    /**
     * Reset all form error states.
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
        setInstrResLibErr(false);
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
                resource: {}
            };
            if (iAm === 'instructor') {
                let postInstrStudentAccess = [];
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
                if (!isEmptyString(instrResourceURL)) {
                    formData.resource.link = instrResourceURL;
                }
                formData.resource.library = instrResourceLib;
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
                let postStudentAccess = [];
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
            let postURL = "";
            if (org.orgID !== 'libretexts' && import.meta.env.VITE_ADOPTIONREPORT_URL) {
              postURL = import.meta.env.VITE_ADOPTIONREPORT_URL;
            } else {
              postURL = '/adoptionreport';
            }
            axios.post(postURL, formData).then((res) => {
                if (!res.data.err) {
                    setShowSuccessModal(true);
                } else {
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
            });
        }
        setSubmitLoading(false);
    };


    /**
     * Called when the Succes Modal
     * is closed. Redirects user
     * to home page.
     */
    const successModalClosed = () => {
        setShowSuccessModal(false);
        props.history.push('/');
    };


    return (
        <Grid cols={1} className="component-container">
            <div className="flex justify-center items-center w-full my-4">
                <img
                    src="/transparent_logo.png"
                    alt="LibreTexts"
                    className="w-full max-w-xs cursor-pointer"
                    onClick={() => {
                        window.open('https://libretexts.org', '_blank', 'noopener');
                    }}
                />
            </div>
            <Heading level={1} align="center" className="mb-6">Adoption Report</Heading>

            <div className="mx-auto w-full max-w-3xl px-4 pb-12">
                <Card>
                    <Card.Body>
                        <p className="mb-4 text-gray-700">If you are an instructor or student using LibreTexts in your class, it would help us greatly if you would fill out this form.</p>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    name="ar-email-input"
                                    label="Your Email"
                                    type="email"
                                    placeholder="Email..."
                                    required
                                    leftIcon={<IconMail size={16} />}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    error={emailErr}
                                    errorMessage={emailErr ? 'Email is required.' : undefined}
                                />
                                <Input
                                    name="ar-name-input"
                                    label="Your Name"
                                    type="text"
                                    placeholder="Name..."
                                    required
                                    leftIcon={<IconUser size={16} />}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    error={nameErr}
                                    errorMessage={nameErr ? 'Name is required.' : undefined}
                                />
                            </div>
                            <Select
                                name="ar-iam-select"
                                label="I am a(n)"
                                placeholder="Choose..."
                                options={toSelectOptions(iAmOptions)}
                                value={iAm}
                                onChange={(e) => setIAm(e.target.value)}
                                required
                                error={iAmErr}
                                errorMessage={iAmErr ? 'Please make a selection.' : undefined}
                            />
                            {(iAm === 'instructor') &&
                                <div className="pt-4 border-t space-y-4">
                                    <Heading level={3}>Instructor</Heading>
                                    <p className="text-gray-700">If you are using LibreTexts in your class(es), please help us by providing some additional data.</p>
                                    <RadioGroup
                                        name="ar-libnet-radio"
                                        label="Is your Institution part of the LibreNet consortium?"
                                        value={libreNetInst || undefined}
                                        onChange={(value) => setLibreNetInst(value)}
                                        options={[
                                            { label: 'Yes', value: 'yes' },
                                            { label: 'No', value: 'no' },
                                            { label: "Don't Know", value: 'dk' },
                                        ]}
                                        required
                                        error={libreNetInstErr}
                                    />
                                    {((libreNetInst === 'yes') || (libreNetInst === 'dk')) &&
                                        <Select
                                            name="ar-libnet-inst-select"
                                            label="Institution Name"
                                            placeholder="Choose..."
                                            options={toSelectOptions(libreNetOptions)}
                                            value={instrInstName}
                                            onChange={(e) => setInstrInstName(e.target.value)}
                                            required
                                            error={instrInstNameErr}
                                        />
                                    }
                                    {(libreNetInst === 'no') &&
                                        <Input
                                            name="ar-not-libre-inst-input"
                                            label="Institution Name"
                                            type="text"
                                            placeholder="Institution..."
                                            required
                                            leftIcon={<IconBuilding size={16} />}
                                            value={instrInstName}
                                            onChange={(e) => setInstrInstName(e.target.value)}
                                            error={instrInstNameErr}
                                        />
                                    }
                                    <Input
                                        name="ar-instr-class-input"
                                        label="Class Name"
                                        type="text"
                                        placeholder="Class..."
                                        required
                                        leftIcon={<IconPencil size={16} />}
                                        value={instrClassName}
                                        onChange={(e) => setInstrClassName(e.target.value)}
                                        error={instrClassNameErr}
                                    />
                                    <p className="text-sm text-gray-600"><em>If you have taught this class multiple times, please fill out this form for each.</em></p>
                                    <Select
                                        name="ar-instr-term-select"
                                        label="When did you teach this class?"
                                        placeholder="Choose..."
                                        options={toSelectOptions(instrTaughtOptions)}
                                        value={instrTaughtTerm}
                                        onChange={(e) => setInstrTaughtTerm(e.target.value)}
                                        required
                                        error={instrTaughtTermErr}
                                    />
                                    <Input
                                        name="ar-instr-num-students-input"
                                        label="Number of Students"
                                        type="number"
                                        min={0}
                                        placeholder="Number..."
                                        required
                                        leftIcon={<IconUsers size={16} />}
                                        value={instrNumStudents}
                                        onChange={(e) => setInstrNumStudents(e.target.value)}
                                        error={instrNumStudentsErr}
                                    />
                                    <Input
                                        name="ar-instr-resource-url"
                                        label="Link to adopted LibreTexts resource"
                                        type="url"
                                        placeholder="URL..."
                                        leftIcon={<IconLink size={16} />}
                                        value={instrResourceURL}
                                        onChange={(e) => setInstrResourceURL(e.target.value)}
                                    />
                                    <Select
                                        name="ar-instr-resource-lib-select"
                                        label="LibreTexts Library"
                                        placeholder="Choose..."
                                        options={toSelectOptions(libraryOptions)}
                                        value={instrResourceLib}
                                        onChange={(e) => setInstrResourceLib(e.target.value)}
                                        required
                                        error={instrResLibErr}
                                    />
                                    <p className="text-sm text-gray-600"><em>If you used more than one LibreTexts resource for your class please put the main text here and add additional links in the comment section before submission.</em></p>
                                    <Input
                                        name="ar-instr-replace-cost-input"
                                        label="Cost of textbook that LibreTexts replaced"
                                        type="number"
                                        placeholder="Cost..."
                                        leftIcon={<IconCurrencyDollar size={16} />}
                                        value={instrReplaceCost}
                                        onChange={(e) => setInstrReplaceCost(e.target.value)}
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">In which ways did students use LibreTexts in your class? (Select all that apply)</p>
                                        <div className="flex flex-col gap-2">
                                            <Checkbox
                                                name="ar-instr-access-online"
                                                label="Online"
                                                checked={instrStudentAccess[0]}
                                                onChange={() => { handleInstrStudentAccessChange(0) }}
                                            />
                                            <Checkbox
                                                name="ar-instr-access-print"
                                                label="Printed Book"
                                                checked={instrStudentAccess[1]}
                                                onChange={() => { handleInstrStudentAccessChange(1) }}
                                            />
                                            <Checkbox
                                                name="ar-instr-access-pdf"
                                                label="Downloaded PDF"
                                                checked={instrStudentAccess[2]}
                                                onChange={() => { handleInstrStudentAccessChange(2) }}
                                            />
                                            <Checkbox
                                                name="ar-instr-access-lms"
                                                label="Via LMS"
                                                checked={instrStudentAccess[3]}
                                                onChange={() => { handleInstrStudentAccessChange(3) }}
                                            />
                                            <Checkbox
                                                name="ar-instr-access-librebox"
                                                label="LibreTexts in a Box"
                                                checked={instrStudentAccess[4]}
                                                onChange={() => { handleInstrStudentAccessChange(4) }}
                                            />
                                        </div>
                                    </div>
                                    <Input
                                        name="ar-instr-print-cost-input"
                                        label="If you used a printed version of a LibreText, how much did it cost?"
                                        type="number"
                                        placeholder="Cost..."
                                        leftIcon={<IconBook size={16} />}
                                        value={instrPrintCost}
                                        onChange={(e) => setInstrPrintCost(e.target.value)}
                                    />
                                </div>
                            }
                            {(iAm === 'student') &&
                                <div className="pt-4 border-t space-y-4">
                                    <Heading level={3}>Student</Heading>
                                    <p className="text-gray-700">We are happy to hear that you are using LibreTexts in your classes.</p>
                                    <Select
                                        name="ar-student-use-select"
                                        label="How is LibreTexts used in your class?"
                                        placeholder="Choose..."
                                        options={toSelectOptions(studentUseOptions)}
                                        value={studentUse}
                                        onChange={(e) => setStudentUse(e.target.value)}
                                    />
                                    <Input
                                        name="ar-student-inst-input"
                                        label="Institution Name"
                                        type="text"
                                        placeholder="Institution..."
                                        leftIcon={<IconBuilding size={16} />}
                                        value={studentInst}
                                        onChange={(e) => setStudentInst(e.target.value)}
                                    />
                                    <Input
                                        name="ar-student-class-input"
                                        label="Class Name"
                                        type="text"
                                        placeholder="Class..."
                                        leftIcon={<IconPencil size={16} />}
                                        value={studentClass}
                                        onChange={(e) => setStudentClass(e.target.value)}
                                    />
                                    <Input
                                        name="ar-student-instructor-input"
                                        label="Instructor Name"
                                        type="text"
                                        placeholder="Instructor..."
                                        leftIcon={<IconUserCircle size={16} />}
                                        value={studentInstr}
                                        onChange={(e) => setStudentInstr(e.target.value)}
                                    />
                                    <RadioGroup
                                        name="ar-student-quality-radio"
                                        label="On a scale from 1 to 5, what is the quality of the LibreTexts content?"
                                        value={studentQuality ? String(studentQuality) : undefined}
                                        onChange={(value) => setStudentQuality(Number(value))}
                                        options={[
                                            { label: '1 (Very low)', value: '1' },
                                            { label: '2', value: '2' },
                                            { label: '3', value: '3' },
                                            { label: '4', value: '4' },
                                            { label: '5 (Very high)', value: '5' },
                                        ]}
                                    />
                                    <RadioGroup
                                        name="ar-student-navigate-radio"
                                        label="On a scale from 1 to 5, how easy is it to navigate the LibreTexts site?"
                                        value={studentNavigate ? String(studentNavigate) : undefined}
                                        onChange={(value) => setStudentNavigate(Number(value))}
                                        options={[
                                            { label: '1 (Very hard)', value: '1' },
                                            { label: '2', value: '2' },
                                            { label: '3', value: '3' },
                                            { label: '4', value: '4' },
                                            { label: '5 (Very easy)', value: '5' },
                                        ]}
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 mb-2">How did you access LibreTexts? (Select all that apply)</p>
                                        <div className="flex flex-col gap-2">
                                            <Checkbox
                                                name="ar-student-access-online"
                                                label="Online"
                                                checked={studentAccess[0]}
                                                onChange={() => { handleStudentAccessChange(0) }}
                                            />
                                            <Checkbox
                                                name="ar-student-access-print"
                                                label="Printed Book"
                                                checked={studentAccess[1]}
                                                onChange={() => { handleStudentAccessChange(1) }}
                                            />
                                            <Checkbox
                                                name="ar-student-access-pdf"
                                                label="Downloaded PDF"
                                                checked={studentAccess[2]}
                                                onChange={() => { handleStudentAccessChange(2) }}
                                            />
                                            <Checkbox
                                                name="ar-student-access-lms"
                                                label="Via LMS"
                                                checked={studentAccess[3]}
                                                onChange={() => { handleStudentAccessChange(3) }}
                                            />
                                            <Checkbox
                                                name="ar-student-access-librebox"
                                                label="LibreTexts in a Box"
                                                checked={studentAccess[4]}
                                                onChange={() => { handleStudentAccessChange(4) }}
                                            />
                                        </div>
                                    </div>
                                    <Input
                                        name="ar-student-print-cost-input"
                                        label="If you used a printed version of a LibreText, how much did it cost?"
                                        type="number"
                                        placeholder="Cost..."
                                        leftIcon={<IconBook size={16} />}
                                        value={studentPrintCost}
                                        onChange={(e) => setStudentPrintCost(e.target.value)}
                                    />
                                </div>
                            }
                            <div className="pt-4 border-t">
                                <Input
                                    name="ar-addtl-comments-input"
                                    label="If you have additional comments, please share below"
                                    type="text"
                                    placeholder="Comments..."
                                    leftIcon={<IconMessageCircle size={16} />}
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                />
                            </div>
                            <Button
                                variant="primary"
                                fullWidth
                                icon={<IconCheck size={16} />}
                                loading={submitLoading}
                                onClick={submitReport}
                            >
                                Submit
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </div>

            <Modal open={showSuccessModal} onClose={() => successModalClosed()}>
                <Modal.Header>
                    <Modal.Title>Adoption Report: Success</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Thank you for submitting an Adoption Report! You will now be redirected to the main page.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={successModalClosed}>Okay</Button>
                </Modal.Footer>
            </Modal>
        </Grid>
    )
}

export default AdoptionReportPage;
