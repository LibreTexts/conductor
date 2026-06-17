import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
    Modal,
    Button,
    Input,
    Select,
    RadioGroup,
    Checkbox,
    Heading,
    Textarea,
} from '@libretexts/davis-react';
import useGlobalError from '../error/ErrorHooks';
import {
    iAmOptions,
    libreNetOptions,
    studentUseOptions,
    getInstructionTermOptions,
} from './AdoptionReportOptions.js';
import { isEmptyString } from '../util/HelperFunctions.js';
import { numberIsNotNullOrUndefined } from '../../utils/misc';

// Map Semantic UI {key,text,value} → Davis Select {value,label}
const toSelectOpts = (opts) => opts
    .filter((o) => o.value !== '')
    .map((o) => ({ value: o.value, label: o.text }));

const iAmSelectOpts = toSelectOpts(iAmOptions);
const libreNetSelectOpts = toSelectOpts(libreNetOptions);
const studentUseSelectOpts = toSelectOpts(studentUseOptions);

const libreNetRadioOpts = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'dk', label: "Don't Know" },
];

const qualityRadioOpts = [
    { value: '1', label: '1 (Very low)' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5 (Very high)' },
];

const navigateRadioOpts = [
    { value: '1', label: '1 (Very hard)' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
    { value: '5', label: '5 (Very easy)' },
];

const ACCESS_LABELS = ['Online', 'Printed Book', 'Downloaded PDF', 'Via LMS', 'LibreTexts in a Box'];
const ACCESS_VALUES = ['online', 'print', 'pdf', 'lms', 'librebox'];

const AdoptionReport = (props) => {
    const { handleGlobalError } = useGlobalError();
    const org = useSelector((state) => state.org);

    const instrTaughtOptions = getInstructionTermOptions();
    const instrTaughtSelectOpts = instrTaughtOptions
        .filter((o) => o.value !== '')
        .map((o) => ({ value: o.value, label: o.text }));

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
    const [instrNumStudents, setInstrNumStudents] = useState('');
    const [instrReplaceCost, setInstrReplaceCost] = useState('');
    const [instrPrintCost, setInstrPrintCost] = useState('');
    const [instrStudentAccess, setInstrStudentAccess] = useState(new Array(5).fill(false));

    // Student
    const [studentUse, setStudentUse] = useState('');
    const [studentInst, setStudentInst] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [studentInstr, setStudentInstr] = useState('');
    const [studentQuality, setStudentQuality] = useState('');
    const [studentNavigate, setStudentNavigate] = useState('');
    const [studentPrintCost, setStudentPrintCost] = useState('');
    const [studentAccess, setStudentAccess] = useState(new Array(5).fill(false));

    // Errors
    const [emailErr, setEmailErr] = useState(false);
    const [nameErr, setNameErr] = useState(false);
    const [iAmErr, setIAmErr] = useState(false);
    const [libreNetInstErr, setLibreNetInstErr] = useState(false);
    const [instrInstNameErr, setInstrInstNameErr] = useState(false);
    const [instrClassNameErr, setInstrClassNameErr] = useState(false);
    const [instrTaughtTermErr, setInstrTaughtTermErr] = useState(false);
    const [instrNumStudentsErr, setInstrNumStudentsErr] = useState(false);

    const toggleAccess = (arr, setter, index) => {
        setter(arr.map((v, i) => (i === index ? !v : v)));
    };

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
        setInstrNumStudents('');
        setInstrReplaceCost('');
        setInstrPrintCost('');
        setInstrStudentAccess(new Array(5).fill(false));
        setStudentUse('');
        setStudentInst('');
        setStudentClass('');
        setStudentInstr('');
        setStudentQuality('');
        setStudentNavigate('');
        setStudentPrintCost('');
        setStudentAccess(new Array(5).fill(false));
        setShowSuccessModal(false);
        props.onClose();
    };

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

    const validateForm = () => {
        let valid = true;
        if (
            !props.resourceID || !props.resourceTitle || !props.resourceLibrary ||
            isEmptyString(props.resourceID) || isEmptyString(props.resourceTitle) || isEmptyString(props.resourceLibrary)
        ) {
            handleGlobalError('Sorry, required internal values appear to be missing. Try reloading this page and submitting the form again.');
            valid = false;
        }
        if (isEmptyString(email)) { setEmailErr(true); valid = false; }
        if (isEmptyString(name)) { setNameErr(true); valid = false; }
        if (isEmptyString(iAm)) { setIAmErr(true); valid = false; }
        if (iAm === 'instructor') {
            if (isEmptyString(libreNetInst)) { setLibreNetInstErr(true); valid = false; }
            if (isEmptyString(instrInstName)) { setInstrInstNameErr(true); valid = false; }
            if (isEmptyString(instrClassName)) { setInstrClassNameErr(true); valid = false; }
            if (isEmptyString(instrTaughtTerm)) { setInstrTaughtTermErr(true); valid = false; }
            if (!instrNumStudents || instrNumStudents === '0') { setInstrNumStudentsErr(true); valid = false; }
        }
        return valid;
    };

    const buildAccessArray = (flags) =>
        ACCESS_VALUES.filter((_, i) => flags[i]);

    const submitReport = () => {
        setSubmitLoading(true);
        resetFormErrors();
        if (validateForm()) {
            const formData = {
                email,
                name,
                role: iAm,
                comments,
                resource: {
                    id: props.resourceID,
                    title: props.resourceTitle,
                    library: props.resourceLibrary,
                },
            };
            if (iAm === 'instructor') {
                formData.instructor = {
                    isLibreNet: libreNetInst,
                    institution: instrInstName,
                    class: instrClassName,
                    term: instrTaughtTerm,
                    students: instrNumStudents,
                    replaceCost: instrReplaceCost,
                    printCost: instrPrintCost,
                    access: buildAccessArray(instrStudentAccess),
                };
            } else if (iAm === 'student') {
                formData.student = {
                    use: studentUse,
                    institution: studentInst,
                    class: studentClass,
                    instructor: studentInstr,
                    ...(numberIsNotNullOrUndefined(studentQuality) && { quality: Number(studentQuality) }),
                    ...(numberIsNotNullOrUndefined(studentNavigate) && { navigation: Number(studentNavigate) }),
                    printCost: studentPrintCost,
                    access: buildAccessArray(studentAccess),
                };
            }
            const postURL =
                org.orgID !== 'libretexts' && import.meta.env.VITE_ADOPTIONREPORT_URL
                    ? import.meta.env.VITE_ADOPTIONREPORT_URL
                    : '/adoptionreport';
            axios.post(postURL, formData).then((res) => {
                if (!res.data.err) {
                    setShowSuccessModal(true);
                } else {
                    handleGlobalError(res.data.errMsg);
                }
            }).catch(handleGlobalError);
        }
        setSubmitLoading(false);
    };

    return (
        <>
            <Modal open={!!props.open} onClose={closeModal} size="lg">
                <Modal.Header>
                    <Modal.Title>Adoption Report</Modal.Title>
                </Modal.Header>
                <Modal.Body className="space-y-4 overflow-y-auto max-h-[calc(100dvh-10rem)]">
                    <p>If you are an instructor or student using this LibreText in your class, it would help us greatly if you would fill out this form.</p>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Input
                            name="email"
                            label="Your Email"
                            type="email"
                            placeholder="Email..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            error={emailErr}
                            errorMessage={emailErr ? 'Email is required.' : undefined}
                        />
                        <Input
                            name="name"
                            label="Your Name"
                            type="text"
                            placeholder="Name..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            error={nameErr}
                            errorMessage={nameErr ? 'Name is required.' : undefined}
                        />
                    </div>

                    <Select
                        name="iAm"
                        label="I am a(n)"
                        placeholder="Choose..."
                        options={iAmSelectOpts}
                        value={iAm}
                        onChange={(e) => setIAm(e.target.value)}
                        required
                        error={iAmErr}
                        errorMessage={iAmErr ? 'Please select your role.' : undefined}
                    />

                    {iAm === 'instructor' && (
                        <div className="space-y-4">
                            <hr className="my-2" />
                            <Heading level={3}>Instructor</Heading>
                            <p>If you are using this LibreText in your class(es), please help us by providing some additional data.</p>

                            <RadioGroup
                                name="libreNetInst"
                                label="Is your Institution part of the LibreNet consortium?"
                                options={libreNetRadioOpts}
                                value={libreNetInst}
                                onChange={setLibreNetInst}
                                required
                                error={libreNetInstErr}
                                errorMessage={libreNetInstErr ? 'Please select an option.' : undefined}
                                orientation="vertical"
                            />

                            {(libreNetInst === 'yes' || libreNetInst === 'dk') && (
                                <Select
                                    name="instrInstName"
                                    label="Institution Name"
                                    placeholder="Choose..."
                                    options={libreNetSelectOpts}
                                    value={instrInstName}
                                    onChange={(e) => setInstrInstName(e.target.value)}
                                    required
                                    error={instrInstNameErr}
                                    errorMessage={instrInstNameErr ? 'Institution name is required.' : undefined}
                                />
                            )}
                            {libreNetInst === 'no' && (
                                <Input
                                    name="instrInstName"
                                    label="Institution Name"
                                    type="text"
                                    placeholder="Institution..."
                                    value={instrInstName}
                                    onChange={(e) => setInstrInstName(e.target.value)}
                                    required
                                    error={instrInstNameErr}
                                    errorMessage={instrInstNameErr ? 'Institution name is required.' : undefined}
                                />
                            )}

                            <Input
                                name="instrClassName"
                                label="Class Name"
                                type="text"
                                placeholder="Class..."
                                value={instrClassName}
                                onChange={(e) => setInstrClassName(e.target.value)}
                                required
                                error={instrClassNameErr}
                                errorMessage={instrClassNameErr ? 'Class name is required.' : undefined}
                            />

                            <p><em>If you have taught this class multiple times, please fill out this form for each.</em></p>

                            <Select
                                name="instrTaughtTerm"
                                label="When did you teach this class?"
                                placeholder="Choose..."
                                options={instrTaughtSelectOpts}
                                value={instrTaughtTerm}
                                onChange={(e) => setInstrTaughtTerm(e.target.value)}
                                required
                                error={instrTaughtTermErr}
                                errorMessage={instrTaughtTermErr ? 'Please select a term.' : undefined}
                            />

                            <Input
                                name="instrNumStudents"
                                label="Number of Students"
                                type="number"
                                min={0}
                                placeholder="Number..."
                                value={instrNumStudents}
                                onChange={(e) => setInstrNumStudents(e.target.value)}
                                required
                                error={instrNumStudentsErr}
                                errorMessage={instrNumStudentsErr ? 'Please enter the number of students.' : undefined}
                            />

                            <Input
                                name="instrReplaceCost"
                                label="Cost of textbook that LibreTexts replaced"
                                type="number"
                                placeholder="Cost..."
                                value={instrReplaceCost}
                                onChange={(e) => setInstrReplaceCost(e.target.value)}
                            />

                            <fieldset>
                                <legend className="text-sm font-medium text-gray-700 mb-2">
                                    In which ways did students use this LibreText in your class? (Select all that apply)
                                </legend>
                                <div className="space-y-2">
                                    {ACCESS_LABELS.map((label, i) => (
                                        <Checkbox
                                            key={label}
                                            name={`instr-access-${i}`}
                                            label={label}
                                            checked={instrStudentAccess[i]}
                                            onChange={() => toggleAccess(instrStudentAccess, setInstrStudentAccess, i)}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            <Input
                                name="instrPrintCost"
                                label="If you used a printed version of this LibreText, how much did it cost?"
                                type="number"
                                placeholder="Cost..."
                                value={instrPrintCost}
                                onChange={(e) => setInstrPrintCost(e.target.value)}
                            />
                        </div>
                    )}

                    {iAm === 'student' && (
                        <div className="space-y-4">
                            <hr className="my-2" />
                            <Heading level={3}>Student</Heading>
                            <p>We are happy to hear that you are using LibreTexts in your classes.</p>

                            <Select
                                name="studentUse"
                                label="How is this LibreText used in your class?"
                                placeholder="Choose..."
                                options={studentUseSelectOpts}
                                value={studentUse}
                                onChange={(e) => setStudentUse(e.target.value)}
                                re
                            />

                            <Input
                                name="studentInst"
                                label="Institution Name"
                                type="text"
                                placeholder="Institution..."
                                value={studentInst}
                                onChange={(e) => setStudentInst(e.target.value)}
                            />

                            <Input
                                name="studentClass"
                                label="Class Name"
                                type="text"
                                placeholder="Class..."
                                value={studentClass}
                                onChange={(e) => setStudentClass(e.target.value)}
                            />

                            <Input
                                name="studentInstr"
                                label="Instructor Name"
                                type="text"
                                placeholder="Instructor..."
                                value={studentInstr}
                                onChange={(e) => setStudentInstr(e.target.value)}
                            />

                            <RadioGroup
                                name="studentQuality"
                                label="On a scale from 1 to 5, what is the quality of this LibreTexts content?"
                                options={qualityRadioOpts}
                                value={studentQuality}
                                onChange={setStudentQuality}
                                orientation="vertical"
                            />

                            <RadioGroup
                                name="studentNavigate"
                                label="On a scale from 1 to 5, how easy is it to navigate the LibreTexts site?"
                                options={navigateRadioOpts}
                                value={studentNavigate}
                                onChange={setStudentNavigate}
                                orientation="vertical"
                            />

                            <fieldset>
                                <legend className="text-sm font-medium text-gray-700 mb-2">
                                    How did you access this LibreText? (Select all that apply)
                                </legend>
                                <div className="space-y-2">
                                    {ACCESS_LABELS.map((label, i) => (
                                        <Checkbox
                                            key={label}
                                            name={`student-access-${i}`}
                                            label={label}
                                            checked={studentAccess[i]}
                                            onChange={() => toggleAccess(studentAccess, setStudentAccess, i)}
                                        />
                                    ))}
                                </div>
                            </fieldset>

                            <Input
                                name="studentPrintCost"
                                label="If you used a printed version of this LibreText, how much did it cost?"
                                type="number"
                                placeholder="Cost..."
                                value={studentPrintCost}
                                onChange={(e) => setStudentPrintCost(e.target.value)}
                            />
                        </div>
                    )}

                    <hr className="my-2" />

                    <Textarea
                        name="comments"
                        label="If you have additional comments, please share below"
                        placeholder="Comments..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={3}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={closeModal}>Cancel</Button>
                        <Button loading={submitLoading} onClick={submitReport}>Submit</Button>
                    </div>
                </Modal.Footer>
            </Modal>

            {/* Success confirmation modal */}
            <Modal open={showSuccessModal} onClose={closeModal} size="sm">
                <Modal.Header>
                    <Modal.Title>Adoption Report: Success</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Thank you for submitting an Adoption Report!</p>
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex justify-end">
                        <Button onClick={closeModal}>Done</Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default AdoptionReport;
