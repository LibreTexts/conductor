import './Login.css';

import { Grid, Segment, Button, Form, Input, Image, Modal, Message } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import queryString from 'query-string';

import { useUserState } from '../../providers.js';

const Login = (props) => {
    const [{ isAuthenticated }, dispatch] = useUserState();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showErrModal, setErrModal] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    const [showExpiredAuth, setExpiredAuth] = useState(false);
    const [showDisclaimer, setShowDisclaimer] = useState(false);

    useEffect(() => {
        if (localStorage.getItem('lbrtxts-pts-showndisc') != null) {
            setShowDisclaimer(false);
        } else {
            setShowDisclaimer(true);
        }
    }, []);

    useEffect(() => {
        const queryValues = queryString.parse(props.location.search);
        const src = decodeURIComponent(queryValues.src);
        if (src === "expired") {
            setExpiredAuth(true);
        }
    }, [props.location.search]);

    useEffect(() => {
        document.title = "LibreTexts PTS | Login";
        if (isAuthenticated && (localStorage.getItem('lbrtxts-pts-auth') != null)) {
            props.history.push('/');
        }
    }, [isAuthenticated, props.history]);

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
        setErrMsg('');
        setErrModal(false);
        if (email.trim() !== '' && password.trim() !== '') {
            sendLogin(props);
        }
    };

    const sendLogin = (props) => {
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
                dispatch({
                    type: 'SET_LOCAL_TOKEN',
                    token: res.data.token
                });
                dispatch({
                    type: 'SET_AUTH_TRUE',
                    isAuthenticated: true
                });
                props.history.push('/');
            } else {
                setErrMsg(res.data.errMsg);
                setErrModal(true);
            }
        }).catch((e) => {
            setErrMsg("Encountered an error sending your request.");
            setErrModal(true);
        })
    };

    const modalClosed = () => {
        setErrMsg('');
        setErrModal(false);
    };

    const closeDisclaimer = () => {
        localStorage.setItem('lbrtxts-pts-showndisc', "true");
        setShowDisclaimer(false);
    }

    return(
        <Grid centered={true} verticalAlign='middle' className="login-grid">
            <Grid.Column width={6}>
                <Grid columns={2} divided verticalAlign='middle' centered={true}>
                        <Grid.Column width={8}>
                            <Image src="/libretexts_logo.png"/>
                        </Grid.Column>
                        <Grid.Column width={8}>
                            <p className='pts-header'>PTS</p>
                            <span className='pts-subheader'>PROJECT TRACKING SYSTEM</span>
                        </Grid.Column>
                </Grid>
                <Segment raised>
                    {showExpiredAuth &&
                        <Message warning>
                            <Message.Header>Please login again.</Message.Header>
                            <p>Your authentication method appears to have expired. Please login again.</p>
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
                        <Button type='submit' color='blue' size='large' fluid={true}>Login</Button>
                    </Form>
                </Segment>
            </Grid.Column>
            <Modal
                onClose={modalClosed}
                open={showErrModal}
            >
                <Modal.Header>LibreTexts PTS: Error</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>{errMsg}</p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="black" onClick={modalClosed}>Okay</Button>
                </Modal.Actions>
            </Modal>
            <Modal
                onClose={closeDisclaimer}
                open={showDisclaimer}
            >
                <Modal.Header>NOTICE</Modal.Header>
                <Modal.Content>
                    <Modal.Description>
                        <p>LibreTexts PTS is <strong>NOT</strong> an official component of the LibreTexts Project. This system is for demonstration purposes only. The LibreTexts name and all relevant branding is the property of LibreTexts, a 501(c)(3) non-profit organization.</p>
                        <p><em>NOTE: </em>This system is not yet optimized for mobile and tablet screen sizes. <strong>Please view this site on a standard desktop-size screen.</strong></p>
                    </Modal.Description>
                </Modal.Content>
                <Modal.Actions>
                    <Button color="black" onClick={closeDisclaimer}>Okay</Button>
                </Modal.Actions>
            </Modal>
        </Grid>
    );
};

export default Login;
