import './Login.css';

import {
    Grid,
    Segment,
    Button,
    Form,
    Input,
    Image,
    Header
} from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import queryString from 'query-string';
import { isEmptyString } from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks';

const ResetPassword = (props) => {

    const { handleGlobalError } = useGlobalError();

    // UI
    const [submitLoading, setSubmitLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Form Data
    const [password, setPassword] = useState('');
    const [token, setToken] = useState('');

    // Form Errors
    const [passwordError, setPasswordError] = useState(false);

    useEffect(() => {
        document.title = "LibreTexts Conductor | Reset Password";
        const queryValues = queryString.parse(props.location.search);
        if (queryValues.token) {
            setToken(queryValues.token);
        } else {
            handleGlobalError("Missing required parameters. Check the original link you followed.");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.location.search]);

    /** Form input handlers **/
    const handlePasswordChange = (e) => {
        var passInput = e.target.value;
        if (passInput.length > 0) {
            if ((passInput.length < 9) || !(/\d/.test(passInput))) {
                setPasswordError(true);
            } else {
                setPasswordError(false);
            }
        }
        setPassword(passInput);
    };

    /**
     * Validate the form data, return
     * 'false' if validation errors exists,
     * 'true' otherwise
     */
    const validateForm = () => {
        var validForm = true;
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
        setPasswordError(false);
    };

    /**
     * Submit data via POST to the server, then
     * redirect to login if successful.
     */
    const submitReset = () => {
        setSubmitLoading(true);
        resetFormErrors();
        if (validateForm()) {
            var resetData = {
                token: token,
                password: password
            }
            axios.post('/auth/resetpassword/complete', resetData).then((res) => {
                if (!res.data.err) {
                    props.history.push('/login?resetsuccess=true');
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
                    <Header size='large'>Complete Password Reset</Header>
                    <Form noValidate>
                        <Form.Field
                            error={passwordError}
                        >
                            <label htmlFor='password'>
                                New Password
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
                            color='blue'
                            size='large'
                            fluid
                            loading={submitLoading}
                            onClick={submitReset}
                        >
                            Update Password
                        </Button>
                    </Form>
                </Segment>
            </Grid.Column>
        </Grid>
    );
};

export default ResetPassword;
