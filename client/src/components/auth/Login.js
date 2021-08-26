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
    Icon
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import axios from 'axios';
import Cookies from 'js-cookie';
import queryString from 'query-string';
import { isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const Login = (props) => {

    const dispatch = useDispatch();
    const { handleGlobalError } = useGlobalError();

    // UI
    const [showExpiredAuth, setExpiredAuth] = useState(false);
    const [submitLoading, setSubmitLoading] = useState(false);

    // Form Data
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Form Errors
    const [emailError, setEmailError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Login";
        const queryValues = queryString.parse(props.location.search);
        const src = decodeURIComponent(queryValues.src);
        if (src === "expired") {
            setExpiredAuth(true);
        }
    }, [props.location.search]);

    /** Form input handlers **/
    const onChange = (e) => {
        if (e.target.id === 'email') {
            setEmail(e.target.value);
        }
        if (e.target.id === 'password') {
            setPassword(e.target.value);
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
        if (isEmptyString(password)) {
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
        setPasswordError(false);
    };

    /**
     * Submit data via POST to the server, then
     * check cookie return and redirect
     * to dashboard.
     */
    const submitLogin = () => {
        setSubmitLoading(true);
        resetFormErrors();
        if (validateForm() && (process.env.REACT_APP_DISABLE_CONDUCTOR !== 'true')) {
            var userData = {
                email: email,
                password: password
            };
            axios.post('/auth/login', userData, {
                headers: {
                    'Content-Type': 'application/json'
                }
            }).then((res) => {
                if (!res.data.err) {
                    if (Cookies.get('access_token') !== undefined) {
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


    const initSSOLogin = () => {
        window.location = "https://github.com/login/oauth/authorize?client_id=386d7b666a18e89e09fa";
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
                    {showExpiredAuth &&
                        <Message warning>
                            <Message.Header>Please login again.</Message.Header>
                            <p>Your authentication method appears to have expired. Please login again.</p>
                        </Message>
                    }
                    {process.env.REACT_APP_DISABLE_CONDUCTOR === 'true' &&
                        <Message negative>
                            <Message.Header>Conductor is disabled</Message.Header>
                            <p>Sorry, access to Conductor is currently disabled.</p>
                        </Message>
                    }
                    <Button
                        disabled={process.env.REACT_APP_DISABLE_CONDUCTOR === 'true'}
                        fluid
                        color='teal'
                        onClick={initSSOLogin}
                    >
                        <Icon name='globe'/> Campus Login (SSO)
                    </Button>
                    <Button
                        disabled={process.env.REACT_APP_DISABLE_CONDUCTOR === 'true'}
                        fluid
                        color='green'
                        className='mt-1p'
                    >
                        <Icon name='add user'/> Register
                    </Button>
                    <Divider horizontal>Or</Divider>
                    <Form noValidate>
                        <Form.Field
                            error={emailError}
                        >
                            <label htmlFor='email'>Email</label>
                            <Input fluid={true} id='email' type='email' name='email' placeholder='Email' required={true} value={email} onChange={onChange} icon='user' iconPosition='left' />
                        </Form.Field>
                        <Form.Field
                            error={passwordError}
                        >
                            <label htmlFor='password'>Password</label>
                            <Input fluid={true} type='password' id='password' name='password' placeholder='********' required={true} value={password} onChange={onChange} icon='lock' iconPosition='left' />
                        </Form.Field>
                        <Button
                            type='submit'
                            color='blue'
                            size='large'
                            fluid
                            disabled={process.env.REACT_APP_DISABLE_CONDUCTOR === 'true'}
                            loading={submitLoading}
                            onClick={submitLogin}
                        >
                            Login
                        </Button>
                    </Form>
                </Segment>
            </Grid.Column>
        </Grid>
    );
};

export default Login;
