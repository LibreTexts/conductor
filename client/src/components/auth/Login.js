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
import axios from 'axios';
import Cookies from 'js-cookie';
import queryString from 'query-string';
import { isEmptyString } from '../util/HelperFunctions.js';

import { useUserState } from '../../providers.js';
import useGlobalError from '../error/ErrorHooks.js';

const Login = (props) => {

    const { setError } = useGlobalError();

    const [, dispatch] = useUserState();

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
                        handleErr("Oops, we're having trouble completing your login.");
                    }
                } else {
                    handleErr(res.data.errMsg)
                }
            }).catch((e) => {
                handleErr(e);
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
