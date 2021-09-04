import './Login.css';

import {
    Grid,
    Segment,
    Button,
    Form,
    Input,
    Image,
    Message,
    Divider,
    Icon,
    Header
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import Cookies from 'js-cookie';
import queryString from 'query-string';
import { isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const Register = (props) => {

    const dispatch = useDispatch();
    const { handleGlobalError } = useGlobalError();

    // UI
    const [submitLoading, setSubmitLoading] = useState(false);

    // Form Data
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    // Form Errors
    const [emailError, setEmailError] = useState(false);
    const [firstNameError, setFirstNameError] = useState(false);
    const [lastNameError, setLastNameError] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Register";
    }, []);

    /** Form input handlers **/
    const onChange = (e) => {
        if (e.target.id === 'email') {
            setEmail(e.target.value);
        }
        if (e.target.id === 'firstName') {
            setFirstName(e.target.value);
        }
        if (e.target.id === 'lastName') {
            setLastName(e.target.value);
        }
    };

    /**
     * Validate the form data, return
     * 'false' if validation errors exists,
     * 'true' otherwise
     */
    const validateForm = () => {
        var validForm = true;
        if (isEmptyString(email)) {
            validForm = false;
            setEmailError(true);
        }
        return validForm;
    };

    /**
     * Reset all form error states
     */
    const resetFormErrors = () => {
        setEmailError(false);
    };

    /**
     * Submit data via POST to the server, then
     * check cookie return and redirect
     * to dashboard.
     */
    const submitRegister = () => {
        setSubmitLoading(true);
        resetFormErrors();
        if (validateForm() && (process.env.REACT_APP_DISABLE_CONDUCTOR !== 'true')) {
            var userData = {
                email: email
            };
            axios.post('/auth/register', userData).then((res) => {
                if (!res.data.err) {
                    if (Cookies.get('conductor_access') !== undefined) {
                        dispatch({
                            type: 'SET_AUTH'
                        });
                        props.history.push('/dashboard');
                    } else {
                        handleGlobalError("Oops, we're having trouble completing your login.");
                    }
                } else {
                    handleGlobalError(res.data.errMsg)
                }
            }).catch((e) => {
                handleGlobalError(e);
            });
        }
        setSubmitLoading(false);
    };

    return(
        <Grid centered={true} verticalAlign='middle' className="login-grid">
            <Grid.Column computer={8} tablet={12} mobile={14}>
                <Grid columns={1} verticalAlign='middle' centered={true}>
                        <Grid.Column computer={8} tablet={10}>
                            <Image src="/libretexts_logo.png"/>
                        </Grid.Column>
                </Grid>
                <Segment raised>
                    <Message info icon>
                        <Icon name='info circle' />
                        <Message.Content>
                            <Message.Header>Conductor Accounts are Universal</Message.Header>
                            <p>Remember, Conductor accounts are universal: register one account and use it on any instance. If you already have an account, you can return to <Link to='/login'>Login.</Link></p>
                        </Message.Content>
                    </Message>
                    <Header size='large'>Register</Header>
                    <Form noValidate>
                        <Form.Field
                            error={emailError}
                        >
                            <label htmlFor='email'>Email</label>
                            <Input
                                fluid={true}
                                id='email'
                                type='email'
                                name='email'
                                placeholder='Email'
                                required={true}
                                value={email}
                                onChange={onChange}
                                icon='mail'
                                iconPosition='left'
                            />
                        </Form.Field>
                        <Form.Field
                            error={firstNameError}
                        >
                            <label htmlFor='firstName'>First Name</label>
                            <Input
                                fluid={true}
                                id='firstName'
                                type='text'
                                name='firstName'
                                placeholder='First Name'
                                required={true}
                                value={firstName}
                                onChange={onChange}
                                icon='user'
                                iconPosition='left'
                            />
                        </Form.Field>
                        <Form.Field
                            error={lastNameError}
                        >
                            <label htmlFor='lastName'>Last Name</label>
                            <Input
                                fluid={true}
                                id='lastName'
                                type='text'
                                name='lastName'
                                placeholder='Last Name'
                                required={true}
                                value={lastName}
                                onChange={onChange}
                                icon='user'
                                iconPosition='left'
                            />
                        </Form.Field>
                        <p className='text-center'><em>Your password will be auto-generated and sent via email.</em></p>
                        <Button
                            type='submit'
                            color='green'
                            size='large'
                            fluid
                            disabled={process.env.REACT_APP_DISABLE_CONDUCTOR === 'true'}
                            loading={submitLoading}
                            onClick={submitRegister}
                        >
                            Register
                        </Button>
                    </Form>
                </Segment>
            </Grid.Column>
        </Grid>
    );
};

export default Register;
