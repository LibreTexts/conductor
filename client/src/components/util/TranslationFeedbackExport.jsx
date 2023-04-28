import {
    Grid,
    Image,
    Icon,
    Segment,
    Header,
    Button,
    Form,
    Divider
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';

import useGlobalError from '../error/ErrorHooks';

const TranslationFeedbackExport = (props) => {

    const { handleGlobalError } = useGlobalError();

    /* UI */
    const [formLoading, setFormLoading] = useState(false);

    /* Form Data */
    const [startMonth, setStartMonth] = useState(1);
    const [startDay, setStartDay] = useState(1);
    const [startYear, setStartYear] = useState(2021);
    const [endMonth, setEndMonth] = useState(12);
    const [endDay, setEndDay] = useState(31);
    const [endYear, setEndYear] = useState(2021);
    const [outFormat, setOutFormat] = useState('json');

    /* Form Error States */
    const [smError, setSMError] = useState(false);
    const [sdError, setSDError] = useState(false);
    const [syError, setSYError] = useState(false);
    const [emError, setEMError] = useState(false);
    const [edError, setEDError] = useState(false);
    const [eyError, setEYError] = useState(false);


    /**
     * Update page title.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Translation Feedback Data Export";
    }, []);


    const validateForm = () => {
        let validForm = true;
        if (startMonth < 1 || startMonth > 12) {
            validForm = false;
            setSMError(true);
        }
        if (startDay < 1 || startDay > 31) {
            validForm = false;
            setSDError(true);
        }
        if (startYear < 2021 || startYear > 2050) {
            validForm = false;
            setSYError(true);
        }
        if (endMonth < 1 || endMonth > 12) {
            validForm = false;
            setEMError(true);
        }
        if (endDay < 1 || endDay > 31) {
            validForm = false;
            setEDError(true);
        }
        if (endYear < 2021 || endYear > 2050) {
            validForm = false;
            setEYError(true);
        }
        return validForm;
    };


    const resetForm = () => {
        setSMError(false);
        setSDError(false);
        setSYError(false);
        setEMError(false);
        setEDError(false);
        setEYError(false);
    }


    const submitForm = () => {
        if (validateForm()) {
            resetForm();
            setFormLoading(true);
            let startDate = `${startMonth}-${startDay}-${startYear}`;
            let endDate = `${endMonth}-${endDay}-${endYear}`;
            axios.get('/translationfeedback/export', {
                params: {
                    startDate: startDate,
                    endDate: endDate,
                    format: outFormat
                }
            }).then((res) => {
                if (res.headers['content-disposition'] && res.headers['content-disposition'].includes('attachment')) {
                    let fileName = res.headers['content-disposition'].replace('attachment; filename=', '').replaceAll("\"", '');
                    let url;
                    let didCreateObject = false;
                    if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
                        url = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.data));
                    } else if (res.headers['content-type'] && res.headers['content-type'].includes('text/csv')) {
                        didCreateObject = true;
                        url = window.URL.createObjectURL(new Blob([res.data]));
                    }
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', fileName);
                    link.click();
                    if (didCreateObject) {
                        window.URL.revokeObjectURL(url);
                    }
                    setFormLoading(false);
                } else {
                    if (!res.data.err) {
                        setFormLoading(false);
                    } else {
                        handleGlobalError(res.data.errMsg);
                        setFormLoading(false);
                    }
                }
            }).catch((err) => {
                handleGlobalError(err);
                setFormLoading(false);
            });
        }
    };


    return (
        <Grid centered={true} verticalAlign='middle' className='component-container'>
            <Grid.Row>
                <Grid.Column>
                    <Grid verticalAlign='middle' centered={true}>
                        <Grid.Row>
                            <Grid.Column>
                                <Image
                                    src="/transparent_logo.png"
                                    size='medium'
                                    centered
                                    className='cursor-pointer'
                                    onClick={() => {
                                        window.open('https://libretexts.org', '_blank', 'noopener');
                                    }}
                                />
                                <Header as='h1' textAlign='center'>Translation Feedback: Data Export</Header>
                            </Grid.Column>
                        </Grid.Row>
                    </Grid>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column mobile={16} computer={10}>
                    <Segment raised className='mb-4r '>
                        <p className='text-center'>LibreTexts collects feedback on the machine translation features enabled on some of our live libraries. This form enables interested parties to download this feedback in <code>json</code> or <code>csv</code> format.</p>
                        <p className='text-center'><strong>All data available here is submitted anonymously and contains no identifying information.</strong></p>
                        <p className='text-center'><em>Note that all submission timestamps are recorded in UTC/GMT.</em></p>
                        <Divider />
                        <Form noValidate>
                            <Form.Group widths='equal'>
                                <Form.Input
                                    fluid
                                    label='Start Month'
                                    placeholder='mm'
                                    type='number'
                                    onChange={(_e, { value }) => setStartMonth(value)}
                                    value={startMonth}
                                    min={1}
                                    max={12}
                                    error={smError}
                                    required
                                />
                                <Form.Input
                                    fluid
                                    label='Start Day'
                                    placeholder='dd'
                                    type='number'
                                    onChange={(_e, { value }) => setStartDay(value)}
                                    value={startDay}
                                    min={1}
                                    max={31}
                                    error={sdError}
                                    required
                                />
                                <Form.Input
                                    fluid
                                    label='Start Year'
                                    placeholder='yyyy'
                                    type='number'
                                    onChange={(_e, { value }) => setStartYear(value)}
                                    value={startYear}
                                    min={2021}
                                    max={2050}
                                    error={syError}
                                    required
                                />
                            </Form.Group>
                            <Form.Group widths='equal'>
                                <Form.Input
                                    fluid
                                    label='End Month'
                                    placeholder='mm'
                                    type='number'
                                    onChange={(_e, { value }) => setEndMonth(value)}
                                    value={endMonth}
                                    min={1}
                                    max={12}
                                    error={emError}
                                    required
                                />
                                <Form.Input
                                    fluid
                                    label='End Day'
                                    placeholder='dd'
                                    type='number'
                                    onChange={(_e, { value }) => setEndDay(value)}
                                    value={endDay}
                                    min={1}
                                    max={31}
                                    error={edError}
                                    required
                                />
                                <Form.Input
                                    fluid
                                    label='End Year'
                                    placeholder='yyyy'
                                    type='number'
                                    onChange={(_e, { value }) => setEndYear(value)}
                                    value={endYear}
                                    min={2021}
                                    max={2050}
                                    error={eyError}
                                    required
                                />
                            </Form.Group>
                            <Form.Group grouped>
                                <label>Output Format</label>
                                <Form.Radio
                                    label='JSON'
                                    value='json'
                                    checked={outFormat === 'json'}
                                    onChange={(_e, { value }) => setOutFormat(value)}
                                />
                                <Form.Radio
                                    label='CSV'
                                    value='csv'
                                    checked={outFormat === 'csv'}
                                    onChange={(_e, { value }) => setOutFormat(value)}
                                />
                            </Form.Group>
                            <Button
                                color='blue'
                                fluid
                                onClick={submitForm}
                                loading={formLoading}
                            >
                                <Icon name='download' />
                                Export and Download
                            </Button>
                        </Form>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default TranslationFeedbackExport;
