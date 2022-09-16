import './Login.css';

import {
    Grid,
    Segment,
    Button,
    Form,
    Input,
    Image,
    Message,
    Icon,
    Header
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useHistory } from 'react-router-dom';
import axios from 'axios';
import {
    isEmptyString,
    validatePassword
} from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const Register = () => {

    const history = useHistory();
    const location = useLocation();
    const { handleGlobalError } = useGlobalError();

    // UI
    const [submitLoading, setSubmitLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [redirectURI, setRedirectURI] = useState('');

    // Form Data
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Form Errors
    const [firstNameError, setFirstNameError] = useState(false);
    const [lastNameError, setLastNameError] = useState(false);
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Register";
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('redirect_uri')) {
            setRedirectURI(searchParams.get('redirect_uri'));
        }
    }, [location.search]);

    const genBackToLoginLink = () => {
        const redirectBase = '/login';
        if (redirectURI) {
            return `${redirectBase}?redirect_uri=${encodeURIComponent(redirectURI)}`;
        }
        return redirectBase;
    };

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



    const handlePasswordChange = (e) => {
        if (validatePassword(e.target.value)) {
            setPasswordError(false);
        } else {
            setPasswordError(true);
        }
        setPassword(e.target.value);
    };

    /**
     * Validate the form data, return
     * 'false' if validation errors exists,
     * 'true' otherwise
     */
    const validateForm = () => {
        var validForm = true;
        if (isEmptyString(firstName)) {
            validForm = false;
            setFirstNameError(true);
        }
        if (isEmptyString(lastName)) {
            validForm = false;
            setLastNameError(true);
        }
        if (isEmptyString(email)) {
            validForm = false;
            setEmailError(true);
        }
        if (!validatePassword(password)) {
            validForm = false;
            setPasswordError(true);
        }
        return validForm;
    };

    /**
     * Reset all form error states
     */
    const resetFormErrors = () => {
        setEmailError(false);
        setFirstNameError(false);
        setLastNameError(false);
    };

    /**
     * Submit data via POST to the server, then
     * check return status and redirect
     * to login.
     */
    const submitRegister = () => {
        resetFormErrors();
        if (validateForm() && (process.env.REACT_APP_DISABLE_CONDUCTOR !== 'true') && (process.env.REACT_APP_RESTRICT_CONDUCTOR !== 'true')) {
            setSubmitLoading(true);
            var userData = {
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: password
            };
            axios.post('/auth/register', userData).then((res) => {
                if (!res.data.err) {
                    setSubmitLoading(false);
                    const newSearchParams = new URLSearchParams({ newregister: true });
                    if (redirectURI) {
                        newSearchParams.set('redirect_uri', redirectURI);
                    }
                    history.push(`/login?${newSearchParams.toString()}`);
                } else {
                    handleGlobalError(res.data.errMsg)
                    setSubmitLoading(false);
                }
            }).catch((e) => {
                handleGlobalError(e);
                setSubmitLoading(false);
            });
        }
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
                    <Header size='large'>Register</Header>
                    <Message info icon>
                        <Icon name='info circle' />
                        <Message.Content>
                            <Message.Header>Conductor Accounts are Universal</Message.Header>
                            <p>
                                {'Remember, Conductor accounts are universal: register one account and use it on any instance. If you already have an account, you can return to '}
                                <Link to={genBackToLoginLink}>Login.</Link>
                            </p>
                        </Message.Content>
                    </Message>
                    <Form noValidate>
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
                                icon='users'
                                iconPosition='left'
                            />
                        </Form.Field>
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
                            error={passwordError}
                        >
                            <label htmlFor='password'>
                                Password
                                <span
                                    className='text-link float-right'
                                    onClick={() => {
                                        setShowPassword(!showPassword)
                                    }}
                                >
                                    {showPassword
                                        ? 'Hide'
                                        : 'Show'
                                    }
                                </span>
                            </label>
                            <Input
                                fluid={true}
                                id='password'
                                type={showPassword ? 'text' : 'password'}
                                name='password'
                                placeholder='Password'
                                required={true}
                                value={password}
                                onChange={handlePasswordChange}
                                icon='lock'
                                iconPosition='left'
                            />
                            <p className='mt-2p mb-4p'><em>Password must be longer than 8 characters and must contain at least one number. Never reuse passwords between sites.</em></p>
                        </Form.Field>
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
