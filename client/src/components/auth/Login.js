import './Login.css';

import { Grid, Segment, Button, Form, Input, Image, Message } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import queryString from 'query-string';

import { useUserState } from '../../providers.js';
import useGlobalError from '../error/ErrorHooks.js';

const Login = (props) => {

    const { setError } = useGlobalError();

    const [, dispatch] = useUserState();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showExpiredAuth, setExpiredAuth] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Login";
        const queryValues = queryString.parse(props.location.search);
        const src = decodeURIComponent(queryValues.src);
        if (src === "expired") {
            setExpiredAuth(true);
        }
    }, [props.location.search]);

    const onChange = (e) => {
        if (e.target.id === 'email') {
            setEmail(e.target.value);
        }
        if (e.target.id === 'password') {
            setPassword(e.target.value);
        }
    };

    const onSubmit = (e) => {
        e.preventDefault();
        if (email.trim() !== '' && password.trim() !== '') {
            sendLogin(props);
        }
    };

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

    const sendLogin = (props) => {
        if (process.env.REACT_APP_DISABLE_CONDUCTOR !== 'true') {
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
    };

    return(
        <Grid centered={true} verticalAlign='middle' className="login-grid">
            <Grid.Column width={6}>
                <Grid columns={1} verticalAlign='middle' centered={true}>
                        <Grid.Column width={8}>
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
                    <Form onSubmit={onSubmit}>
                        <Form.Field>
                            <label htmlFor='email'>Email</label>
                            <Input fluid={true} id='email' type='email' name='email' placeholder='Email' required={true} value={email} onChange={onChange} icon='user' iconPosition='left' />
                        </Form.Field>
                        <Form.Field>
                            <label htmlFor='password'>Password</label>
                            <Input fluid={true} type='password' id='password' name='password' placeholder='********' required={true} value={password} onChange={onChange} icon='lock' iconPosition='left' />
                        </Form.Field>
                        <Button type='submit' color='blue' size='large' fluid={true} disabled={process.env.REACT_APP_DISABLE_CONDUCTOR === 'true'}>Login</Button>
                    </Form>
                </Segment>
            </Grid.Column>
        </Grid>
    );
};

export default Login;
