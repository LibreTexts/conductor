import './Commons.css';

import {
    Grid,
    Image,
    Icon,
    Segment,
    Header,
    Button,
    Accordion,
    List,
    Modal,
    Form,
    Input,
    Divider,
    Checkbox
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
//import axios from 'axios';


import { getDemoBooks, getInstName } from '../util/DemoBooks.js';

import { getLicenseText, getGlyphAddress, getLibraryName } from '../util/HarvestingMasterOptions.js';

const CommonsBook = (props) => {

    const orgBooks = getDemoBooks(process.env.REACT_APP_ORG_ID);
    const book = orgBooks[props.match.params.id-1];
    const [activeAccordion, setActiveAccordion] = useState(0);
    const [tocChapterPanels, setTOCCPanels] = useState([]);

    // Adoption Report
    const [showARModal, setShowARModal] = useState(false);
    const [arEmail, setAREmail] = useState('');
    const [arName, setARName] = useState('');
    const [arIAm, setARIAm] = useState('');

    // AR — Instructor
    const [arlibreNetInst, setARLibreNetInst] = useState('');
    const [arInstrInstName, setARInstrInstName] = useState('');
    const [arInstrClassName, setARInstrClassName] = useState('');
    const [arInstrTaughtTerm, setARInstrTaughtTerm] = useState('');
    const [arInstrNumStudents, setARInstrNumStudents] = useState(0);
    const [arInstrReplaceCost, setARInstrReplaceCost] = useState(0);
    const [arInstrPrintcost, setARInstrPrintCost] = useState(0);

    const handleARInputChange = (e) => {
        switch (e.target.id) {
            case 'ar-not-libre-inst-input':
                setARInstrInstName(e.target.value);
                break;
            case 'ar-instr-class-input':
                setARInstrClassName(e.target.value);
                break;
            case 'ar-instr-num-students-input':
                setARInstrNumStudents(e.target.value);
                break;
            case 'ar-instr-replace-cost-input':
                setARInstrReplaceCost(e.target.value);
                break;
            case 'ar-instr-print-cost-input':
                setARInstrPrintCost(e.target.value);
                break;
            default:
                break // Silence React warning
        }
    }

    const [studentQuality, setStudentQuality] = useState(0);
    const [studentNavigate, setStudentNavigate] = useState(0);

    const arIAmOptions = [
        { key: 'empty', text: 'Choose...', value: '' },
        { key: 'student', text: 'Student', value: 'student' },
        { key: 'instructor', text: 'Instructor', value: 'instructor' }
    ];

    const libreNetOptions = [
        { key: 'empty', text: 'Choose...', value: '' },
        { key: 'asccc', text: 'ASCCC', value: 'ASCCC' },
        { key: 'calstate', text: 'CalState University', value: 'CalState University' },
        { key: 'contracosta', text: 'Contra Costa Community College', value: 'Contra Costa Community College' },
        { key: 'harrisburgarea', text: 'Harrisburg Area Community College', value: 'Harrisburg Area Community College' },
        { key: 'hopecollege', text: 'Hope College', value: 'Hope College' },
        { key: 'kansasstate', text: 'Kansas State University', value: 'Kansas State University' },
        { key: 'losrios', text: 'Los Rios Community College', value: 'Los Rios Community College' },
        { key: 'princegeorges', text: "Prince George's Community College", value: "Prince George's Community College" },
        { key: 'ualr', text: 'University of Arkansas at Little Rock', value: 'University of Arkansas at Little Rock' },
        { key: 'ucd', text: 'University of California, Davis', value: 'University of California, Davis' },
        { key: 'uoh', text: 'University of Hawaii', value: 'University of Hawaii' },
        { key: 'other', text: 'Other', value: 'Other' }
    ];

    const studentUseOptions = [
        { key: 'empty', text: 'Choose...', value: '' },
        { key: 'primary', text: 'As the primary textbook', value: 'Primary Textbook' },
        { key: 'supplement-suggested', text: 'Supplementary resource (suggested by instructor)', value: 'Supplementary (suggested by instructor)' },
        { key: 'supplement-notsuggested', text: 'Supplementary resource (not suggested by instructor)', value: 'Supplementary (not suggested by instructor)' }
    ];

    const instrTaughtOptions = [
        { key: 'empty', text: 'Choose...', value: '' },
        { key: 'fq19', text: 'Fall Quarter 2019', value: 'fq19' },
        { key: 'fs19', text: 'Fall Semester 2019', value: 'fs19' },
        { key: 'wq20', text: 'Winter Quarter 2020', value: 'wq20' },
        { key: 'sq20', text: 'Spring Quarter 2020', value: 'sq20' },
        { key: 'ss20', text: 'Spring Semester 2020', value: 'ss20' },
        { key: 'sum20', text: 'Summer 2020', value: 'sum20' },
        { key: 'fq20', text: 'Fall Quarter 2020', value: 'fq20' },
        { key: 'fs20', text: 'Fall Semester 2020', value: 'fs20' },
        { key: 'wq21', text: 'Winter Quarter 2021', value: 'wq21' },
        { key: 'sq21', text: 'Spring Quarter 2021', value: 'sq21' },
        { key: 'ss21', text: 'Spring Semester 2021', value: 'ss21' },
        { key: 'sum21', text: 'Summer 2021', value: 'sum21' }
    ];

    const closeARModal = () => {
        setShowARModal(false);
    };

    const listFactory = (pages) => {
        return (
            <List bulleted>
                {pages.map((page, idx) => {
                    return (
                        <List.Item key={idx} header={page} />
                    )
                })}
            </List>
        )
    };

    useEffect(() => {
        document.title = "LibreTexts | " + book.title;
        if (book.contents !== undefined) {
            var chapters = [];
            book.contents.forEach((item, idx) => {
                chapters.push({
                    key: `chapter-${idx}`,
                    title: item.title,
                    content: { content: listFactory(item.pages) }
                });
            });
            setTOCCPanels(chapters);
        }
    }, [book.title, book.contents]);

    const handleAccordionClick = (e, { index }) => {
        setActiveAccordion(index);
    };

    const handleIAmChange = (e, { value }) => {
        setARIAm(value);
    };

    const handleARLibreNetInstChange = (e, { value }) => {
        setARLibreNetInst(value);
    };

    const handleStudentUseChange = (e, { value }) => {

    };

    const handleStudentQualityChange = (e, { value }) => {
        setStudentQuality(value);
    };

    const handleStudentNavigateChange = (e, { value }) => {
        setStudentNavigate(value);
    };

    const ThumbnailAttribution = () => {
        if (book.thumbnailAttr) {
            if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license && book.thumbnailAttr.licLink) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the <a href={book.thumbnailAttr.licLink} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.license}</a> license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link && book.thumbnailAttr.license) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>, licensed under the {book.thumbnailAttr.license} license.</p>
                )
            } else if (book.thumbnailAttr.title && book.thumbnailAttr.link) {
                return (
                    <p><Icon name='file image'/> Thumbnail via <a href={book.thumbnailAttr.link} target='_blank' rel='noopener noreferrer'>{book.thumbnailAttr.title}</a>.</p>
                )
            } else if (book.thumbnailAttr.title) {
                return (
                    <p><Icon name='file image'/> Thumbnail via {book.thumbnailAttr.title}.</p>
                )
            }
        } else {
            return null;
        }
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment>
                        <Grid divided>
                            <Grid.Row>
                                <Grid.Column width={4}>
                                    <Image id='commons-book-image' src={book.thumbnail} />
                                    <div id='commons-book-details'>
                                        {(book.author !== '') &&
                                            <p><Icon name='user'/> {book.author}</p>
                                        }
                                        <p>
                                            <Image src={getGlyphAddress(book.library)} className='commons-content-glyph' inline/>
                                            {getLibraryName(book.library)}
                                        </p>
                                        {(book.license !== '') &&
                                            <p><Icon name='shield'/> {getLicenseText(book.license)}</p>
                                        }
                                        <p><Icon name='university'/> {book.institution}</p>
                                        <ThumbnailAttribution />
                                    </div>
                                    <Button icon='hand paper' content='Submit an Adoption Report' color='green' fluid onClick={() => { setShowARModal(true) }} />
                                    <Button.Group id='commons-book-actions' vertical labeled icon fluid color='blue'>
                                        <Button icon='linkify' content='Read Online' as='a' href={book.links.online} target='_blank' rel='noopener noreferrer' />
                                        <Button icon='file pdf' content='Download PDF' as='a' href={book.links.pdf} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='shopping cart' content='Buy Print Copy' as='a' href={book.links.buy} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='zip' content='Download Pages ZIP' as='a' href={book.links.zip} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='book' content='Download Print Files' as='a' href={book.links.files} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='graduation cap' content='Download LMS File' as='a' href={book.links.lms} target='_blank' rel='noopener noreferrer'/>
                                    </Button.Group>
                                </Grid.Column>
                                <Grid.Column width={12}>
                                    <Header as='h2'>{book.title}</Header>
                                    {(book.summary !== '') &&
                                        <Segment>
                                            <Header as='h3' dividing>Summary</Header>
                                            <p>{book.summary}</p>
                                        </Segment>
                                    }
                                    <Accordion styled fluid>
                                        <Accordion.Title
                                            index={0}
                                            active={activeAccordion === 0}
                                            onClick={handleAccordionClick}
                                        >
                                            <Icon name='dropdown' />
                                            Table of Contents
                                        </Accordion.Title>
                                        <Accordion.Content active={activeAccordion === 0}>
                                            <p><em>This feature is coming soon!</em></p>
                                        </Accordion.Content>
                                    </Accordion>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Segment>
                    <Modal
                        onClose={closeARModal}
                        open={showARModal}
                        closeOnDimmerClick={false}
                    >
                        <Modal.Header>Adoption Report (UNDER CONSTRUCTION)</Modal.Header>
                        <Modal.Content scrolling>
                            <p>If you are an instructor or student using this LibreText in your class, it would help us greatly if you would fill out this form.</p>
                            <Form>
                                <Form.Group widths='equal'>
                                    <Form.Field required>
                                        <label htmlFor='email'>Your Email</label>
                                        <Input fluid={true} id='ar-email-input' type='email' name='email' placeholder='Email...' required={true} icon='mail' iconPosition='left' />
                                    </Form.Field>
                                    <Form.Field required>
                                        <label htmlFor='name'>Your Name</label>
                                        <Input fluid={true} id='ar-name-input' type='text' name='name' placeholder='Name...' required={true} icon='user' iconPosition='left' />
                                    </Form.Field>
                                </Form.Group>
                                <Form.Select
                                    fluid
                                    label='I am a'
                                    options={arIAmOptions}
                                    placeholder='Choose...'
                                    onChange={handleIAmChange}
                                    value={arIAm}
                                />
                                {(arIAm === 'instructor') &&
                                    <div>
                                        <Divider />
                                        <Header as='h3'>Instructor</Header>
                                        <p>If you are using this LibreText in your class(es), please help us by providing some additional data.</p>
                                        <Form.Group grouped>
                                            <label>Is your Institution part of the LibreNet consortium?</label>
                                            <Form.Radio
                                                label='Yes'
                                                value='yes'
                                                onChange={handleARLibreNetInstChange}
                                                checked={arlibreNetInst === 'yes'}
                                            />
                                            <Form.Radio
                                                label='No'
                                                value='no'
                                                onChange={handleARLibreNetInstChange}
                                                checked={arlibreNetInst === 'no'}
                                            />
                                            <Form.Radio
                                                label="Don't Know"
                                                value='dk'
                                                onChange={handleARLibreNetInstChange}
                                                checked={arlibreNetInst === 'dk'}
                                            />
                                        </Form.Group>
                                        {((arlibreNetInst === 'yes') || (arlibreNetInst === 'dk')) &&
                                            <Form.Select
                                                fluid
                                                label='Institution Name'
                                                options={libreNetOptions}
                                                placeholder='Choose...'
                                                onChange={handleARInputChange}
                                                value={arInstrInstName}
                                            />
                                        }
                                        {(arlibreNetInst === 'no') &&
                                            <Form.Field>
                                                <label htmlFor='not-libre-inst'>Institution Name</label>
                                                <Input
                                                    fluid={true}
                                                    id='ar-not-libre-inst-input'
                                                    type='text'
                                                    name='not-libre-inst'
                                                    placeholder='Institution...'
                                                    required={true}
                                                    icon='university'
                                                    iconPosition='left'
                                                    onChange={handleARInputChange}
                                                    value={arInstrInstName}
                                                />
                                            </Form.Field>
                                        }
                                        <Form.Field>
                                            <label htmlFor='instr-class'>Class Name</label>
                                            <Input
                                                fluid={true}
                                                id='ar-instr-class-input'
                                                type='text'
                                                name='instr-class'
                                                placeholder='Class...'
                                                icon='calendar alternate outline'
                                                required={true}
                                                iconPosition='left'
                                                onchange={handleARInputChange}
                                                value={arInstrClassName}
                                            />
                                        </Form.Field>
                                        <p><em>If you have tought this class multiple times, please fill out this form for each.</em></p>
                                        <Form.Select
                                            fluid
                                            label='When did you teach this class?'
                                            options={instrTaughtOptions}
                                            placeholder='Choose...'
                                            onChange={(e, { value }) => { setARInstrTaughtTerm(value) }}
                                            value={arInstrTaughtTerm}
                                        />
                                        <Form.Field>
                                            <label htmlFor='instr-num-students'>Number of Students</label>
                                            <Input
                                                fluid={true}
                                                id='ar-instr-num-students-input'
                                                type='number'
                                                name='instr-num-students'
                                                placeholder='Number...'
                                                icon='users'
                                                iconPosition='left'
                                                onChange={handleARInputChange}
                                                value={arInstrNumStudents}
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
                                                onChange={handleARInputChange}
                                                value={arInstrReplaceCost}
                                            />
                                        </Form.Field>
                                        <Form.Group grouped>
                                            <label>In which ways did students use this LibreText in your class? (Select all that apply)</label>
                                            <Checkbox
                                                label='Online'
                                                className='ar-checkbox'
                                            />
                                            <Checkbox
                                                label='Printed Book'
                                                className='ar-checkbox'
                                            />
                                            <Checkbox
                                                label='Downloaded PDF'
                                                className='ar-checkbox'
                                            />
                                            <Checkbox
                                                label='Via LMS'
                                                className='ar-checkbox'
                                            />
                                            <Checkbox
                                                label='LibreTexts in a Box'
                                                className='ar-checkbox'
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
                                                onChange={handleARInputChange}
                                                value={arInstrPrintcost}
                                            />
                                        </Form.Field>
                                    </div>
                                }
                                {(arIAm === 'student') &&
                                    <div>
                                        <Divider />
                                        <Header as='h3'>Student</Header>
                                        <p>We are happy to hear that you are using LibreTexts in your classes.</p>
                                        <Form.Select
                                            fluid
                                            label='How is this LibreText used in your class?'
                                            options={studentUseOptions}
                                            placeholder='Choose...'
                                        />
                                        <Form.Field>
                                            <label htmlFor='student-inst'>Institution Name</label>
                                            <Input fluid={true} id='ar-student-inst-input' type='text' name='student-inst' placeholder='Institution...' icon='university' iconPosition='left' />
                                        </Form.Field>
                                        <Form.Field>
                                            <label htmlFor='student-class'>Class Name</label>
                                            <Input fluid={true} id='ar-student-class-input' type='text' name='student-class' placeholder='Class...' icon='calendar alternate outline' iconPosition='left' />
                                        </Form.Field>
                                        <Form.Field>
                                            <label htmlFor='student-instructor'>Instructor Name</label>
                                            <Input fluid={true} id='ar-student-instructor-input' type='text' name='student-instructor' placeholder='Instructor...' icon='user circle outline' iconPosition='left' />
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
                                            <Checkbox label='Online' className='ar-checkbox' />
                                            <Checkbox label='Printed Book' className='ar-checkbox' />
                                            <Checkbox label='Downloaded PDF' className='ar-checkbox' />
                                            <Checkbox label='Via LMS' className='ar-checkbox' />
                                            <Checkbox label='LibreTexts in a Box' className='ar-checkbox' />
                                        </Form.Group>
                                        <Form.Field>
                                            <label htmlFor='student-print-cost'>If you used a printed version of this LibreText, how much did it cost?</label>
                                            <Input fluid={true} id='ar-student-print-cost-input' type='number' name='student-print-cost' placeholder='Cost...' icon='book' iconPosition='left' />
                                        </Form.Field>
                                    </div>
                                }
                                <Divider />
                                <Form.Field>
                                    <label htmlFor='addtl-comments'>If you have additional comments, please share below</label>
                                    <Input fluid={true} id='ar-addtl-comments-input' type='text' name='addtl-comments' placeholder='Comments...' icon='comment' iconPosition='left' />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button content='Cancel' onClick={closeARModal} />
                            <Button content='Submit' color='green' labelPosition='right' icon='check' disabled />
                        </Modal.Actions>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsBook;


/*
<Accordion.Content active={activeAccordion === 0}>
    <Accordion.Accordion panels={tocChapterPanels} />
</Accordion.Content>





<List>
    {book.contents.map((item, index) => {
        return (
            <List.Item key={index}>
                <List.Icon name='folder open' />
                <List.Content>
                    <List.Header>{item.name}</List.Header>
                    <List.List>
                    {item.pages.map((page, pageIdx) => {
                        return (
                            <List.Item key={pageIdx}>
                                <List.Icon name='content' />
                                <List.Content>
                                    <List.Header>{page}</List.Header>
                                </List.Content>
                            </List.Item>
                        )
                    })}
                    </List.List>
                </List.Content>
            </List.Item>
        )
    })}
</List>
*/
