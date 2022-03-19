import './Login.css';

import {
    Grid,
    Header,
    Menu,
    Image,
    Segment,
    Divider,
    Form,
    Button,
    List,
    Icon,
    Modal,
    Loader,
} from 'semantic-ui-react';
import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';

import AuthHelper from '../util/AuthHelper.js';

import {
    isEmptyString,
    validatePassword
} from '../util/HelperFunctions.js';

import useGlobalError from '../error/ErrorHooks.js';

const AccountSettings = (props) => {

    // Global State and Error Handling
    const dispatch = useDispatch();
    const { handleGlobalError } = useGlobalError();
    const user = useSelector((state) => state.user);

    // UI
    const [activeItem, setActiveItem] = useState('overview');
    const [loadedData, setLoadedData] = useState(false);

    // Edit Name Modal
    const [showENModal, setShowENModal] = useState(false);
    const [enFirstName, setENFirstName] = useState('');
    const [enLastName, setENLastName] = useState('');
    const [enFirstErr, setENFirstErr] = useState(false);
    const [enLastErr, setENLastErr] = useState(false);
    const [enLoading, setENLoading] = useState(false);

    // Edit Avatar
    const avatarUploadRef = useRef(null);
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    // Security Pane
    const [email, setEmail] = useState('');
    const [emailErr, setEmailErr] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [showEUSModal, setShowEUSModal] = useState(false);
    const [currPassword, setCurrPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [currPassErr, setCurrPassErr] = useState(false);
    const [newPassErr, setNewPassErr] = useState(false);
    const [passLoading, setPassLoading] = useState(false);

    // Data
    const [accountData, setAccountData] = useState({
        email: '',
        firstName: '',
        lastName: '',
        roles: [],
        avatar: '/favicon-96x96.png',
        authMethod: '',
        createdAt: ''
    });


    /**
     * Set page title & retrieve account info.
     */
    useEffect(() => {
        document.title = "LibreTexts Conductor | Account Settings";
        getAccountInfo();
    }, []);


    /**
     * Keep global User Name in sync if updated.
     */
    useEffect(() => {
        if (accountData.firstName !== '' && accountData.lastName !== '') {
            if ((user.firstName !== accountData.firstName) || (user.lastName !== accountData.lastName)) {
                dispatch({
                    type: 'SET_USER_NAME',
                    payload: {
                        firstName: accountData.firstName,
                        lastName: accountData.lastName
                    }
                });
            }
        }
    }, [user, accountData.firstName, accountData.lastName]);


    /**
     * Retrieve account information
     * from the server.
     */
    const getAccountInfo = () => {
        setLoadedData(false);
        axios.get('/user/accountinfo').then((res) => {
            if (!res.data.err) {
                if (res.data.account) {
                    const createdDate = new Date(res.data.account.createdAt);
                    setAccountData({
                        ...res.data.account,
                        createdAt: createdDate.toDateString()
                    });
                } else {
                    handleGlobalError(res.data.errMsg);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedData(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedData(true);
        });
    };


    /**
     * Open the Edit Name modal and
     * set the form fields accordingly.
     */
    const openEditNameModal = () => {
        setENFirstName(accountData.firstName);
        setENLastName(accountData.lastName);
        setENFirstErr(false);
        setENLastErr(false);
        setENLoading(false);
        setShowENModal(true);
    };


    /**
     * Close the Edit Name modal and
     * reset the form fields.
     */
    const closeEditNameModal = () => {
        setShowENModal(false);
        setENFirstName('');
        setENLastName('');
        setENFirstErr(false);
        setENLastErr(false);
        setENLoading(false);
    };


    /**
     * Validate the Edit Name form
     * and submit the update to the
     * server, then close and
     * reset the Modal.
     */
    const submitEditName = () => {
        var validForm = true;
        setENFirstErr(false);
        setENLastErr(false);
        if (isEmptyString(enFirstName) || enFirstName.length < 2 || enFirstName.length > 100) {
            validForm = false;
            setENFirstErr(true);
        }
        if (isEmptyString(enLastName) || enLastName.length > 100) {
            validForm = false;
            setENLastErr(true);
        }
        if (validForm) {
            setENLoading(true);
            var nameData = {
                firstName: enFirstName,
                lastName: enLastName
            };
            axios.put('/user/name', nameData).then((res) => {
                if (!res.data.err) {
                    closeEditNameModal();
                    getAccountInfo();
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setENLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setENLoading(false);
            });
        }
    };


    /**
     * Reset the forms in the Security
     * pane, then mark it as active.
     */
    const openSecurityPane = () => {
        setEmail(accountData.email);
        setEmailErr(false);
        setCurrPassword('');
        setNewPassword('');
        setCurrPassErr(false);
        setNewPassErr(false);
        setEmailLoading(false);
        setPassLoading(false);
        setActiveItem('security');
    };


    /**
     * Validate the Update Email form,
     * then submit the change to the
     * server and open the Email Update
     * Success Modal if successful.
     */
    const submitEmailChange = () => {
        setEmailErr(false);
        if (!isEmptyString(email)) {
            setEmailLoading(true);
            axios.put('/user/email', {
                email: email
            }).then((res) => {
                if (!res.data.err) {
                    setShowEUSModal(true);
                } else {
                    handleGlobalError(res.data.errMsg);
                }
                setEmailLoading(false);
            }).catch((err) => {
                handleGlobalError(err);
                setEmailLoading(false);
            });
        } else {
            setEmailErr(true);
        }
    };


    /**
     * Handle changes to the New Password
     * field and validate it live.
     */
    const handleNewPassChange = (e) => {
        if (validatePassword(e.target.value)) {
            setNewPassErr(false);
        } else {
            setNewPassErr(true);
        }
        setNewPassword(e.target.value);
    };


    /**
     * Validate the Change Password form,
     * then submit the change to the server
     * and logout if successful.
     */
    const submitPasswordChange = () => {
        var validForm = true;
        setCurrPassErr(false);
        setNewPassErr(false);
        if (isEmptyString(currPassword)) {
            validForm = false;
            setCurrPassErr(true);
        }
        if (!validatePassword(newPassword)) {
            validForm = false;
            setNewPassErr(true);
        }
        if (validForm) {
            setPassLoading(true);
            axios.put('/auth/changepassword', {
                currentPassword: currPassword,
                newPassword: newPassword
            }).then((res) => {
                if (!res.data.err) {
                    AuthHelper.logout();
                    window.location.assign('/login?passchange=true');
                } else {
                    handleGlobalError(res.data.errMsg);
                    setPassLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setPassLoading(false);
            });
        }
    };


    /**
     * Open the file input dialog when the 'Edit Avatar' button is clicked.
     */
    const handleUploadAvatar = () => {
        if (avatarUploadRef.current) avatarUploadRef.current.click();
    };


    /**
     * Process the uploaded avatar and send it to the server.
     * @param {object} event - The browser input event.
     */
    const handleAvatarUploadFileChange = (event) => {
        const validFileTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (event.target && typeof (event.target.files) === 'object') {
            if (event.target.files.length === 1) {
                let newAvatar = event.target.files[0];
                if (newAvatar instanceof File && validFileTypes.includes(newAvatar.type)) {
                    let formData = new FormData();
                    formData.append('avatarFile', newAvatar);
                    setShowAvatarModal(true);
                    axios.post('/user/avatar', formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data'
                        }
                    }).then((res) => {
                        setShowAvatarModal(false);
                        if (!res.data.err) {
                            window.location.reload();
                        } else {
                            handleGlobalError(res.data.errMsg); 
                        }
                    }).catch((err) => {
                        setShowAvatarModal(false);
                        handleGlobalError(err);
                    });
                } else {
                    handleGlobalError('Sorry, that file type is not supported.');
                }
            } else if (event.target.files.length > 1) {
                handleGlobalError('Only one file can be uploaded at a time.');
            }
        }
    };


    return (
        <Grid className='component-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Account Settings</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment>

                        <Grid>
                            <Grid.Row>
                                <Grid.Column width={4}>
                                    <Menu fluid vertical color='blue' secondary pointing className='fullheight-menu'>
                                        <Menu.Item
                                            name='overview'
                                            active={activeItem === 'overview'}
                                            onClick={() => { setActiveItem('overview') }}
                                        >Account Overview</Menu.Item>
                                        <Menu.Item
                                            name='security'
                                            active={activeItem === 'security'}
                                            onClick={openSecurityPane}
                                        >Security</Menu.Item>
                                    </Menu>
                                </Grid.Column>
                                <Grid.Column stretched width={12}>
                                    {(activeItem === 'overview') &&
                                        <Segment basic className='pane-segment' loading={!loadedData}>
                                            <h2>Account Overview</h2>
                                            <Divider />
                                            <Grid divided='vertically'>
                                                <Grid.Row>
                                                    <Grid.Column width={4}>
                                                        <Image
                                                            src={`${accountData.avatar}`}
                                                            size='medium'
                                                            circular
                                                        />
                                                        <input
                                                            type='file'
                                                            accept='image/jpeg,image/png,image/gif'
                                                            id='conductor-userprofile-avatar-upload'
                                                            hidden
                                                            ref={avatarUploadRef}
                                                            onChange={handleAvatarUploadFileChange}
                                                        />
                                                        <Button.Group
                                                            color='blue'
                                                            vertical
                                                            labeled
                                                            icon
                                                            fluid
                                                            className='mt-2r'
                                                        >
                                                            <Button
                                                                fluid
                                                                disabled={accountData.authMethod !== 'Traditional'}
                                                                onClick={openEditNameModal}
                                                                icon='male'
                                                                content='Edit Name'
                                                            />
                                                            <Button
                                                                fluid
                                                                onClick={handleUploadAvatar}
                                                                icon='image'
                                                                content='Edit Avatar'
                                                            />
                                                        </Button.Group>
                                                        <span className='muted-text small-text'>Max file size: 5 MB</span>
                                                    </Grid.Column>
                                                    <Grid.Column width={12}>
                                                        <Header as='h2'>
                                                            {accountData.firstName} {accountData.lastName}
                                                        </Header>
                                                        <Header sub>Email</Header>
                                                        {(accountData.email)
                                                            ? (<p>{accountData.email}</p>)
                                                            : (<p><em>Unknown</em></p>)
                                                        }
                                                        <Header sub>Authentication Method</Header>
                                                        {(accountData.authMethod)
                                                            ? (<p>{accountData.authMethod}</p>)
                                                            : (<p><em>Unknown</em></p>)
                                                        }
                                                        <Header sub>Account Creation Date</Header>
                                                        {(accountData.createdAt)
                                                            ? (<p>{accountData.createdAt}</p>)
                                                            : (<p><em>Unknown</em></p>)
                                                        }
                                                        <Header sub>Roles</Header>
                                                        {(accountData.roles && accountData.roles.length > 0)
                                                            ? (
                                                                <List verticalAlign='middle' celled relaxed>
                                                                    {accountData.roles.map((item, idx) => {
                                                                        var org = 'Unknown Organization';
                                                                        var role = 'Unknown Role';
                                                                        if (item.org) {
                                                                            if (item.org.shortName) org = item.org.shortName;
                                                                            else if (item.org.name) org = item.org.name;
                                                                        }
                                                                        if (item.role) role = item.role;
                                                                        return (
                                                                            <List.Item key={idx}>
                                                                                <List.Icon name='building' />
                                                                                <List.Content>
                                                                                    <List.Header>{org}</List.Header>
                                                                                    <List.Description>
                                                                                        {role}
                                                                                    </List.Description>
                                                                                </List.Content>
                                                                            </List.Item>
                                                                        )
                                                                    })}
                                                                </List>
                                                            )
                                                            : (<p><em>No roles available.</em></p>)
                                                        }
                                                    </Grid.Column>
                                                </Grid.Row>
                                            </Grid>
                                        </Segment>
                                    }
                                    {(activeItem === 'security') &&
                                        <Segment basic className='pane-segment'>
                                            <h2>Security</h2>
                                            <Divider />
                                            {(accountData.authMethod !== 'Traditional') &&
                                                <p><em>Your account information is managed by an external identity provider. To update these values, please use your SSO provider's methods.</em></p>
                                            }
                                            <Segment
                                                raised
                                                disabled={accountData.authMethod !== 'Traditional'}
                                            >
                                                <h3>Update Email</h3>
                                                <p>
                                                    <strong>Caution: </strong> Updating your email here will change the email you use to login to Conductor.
                                                </p>
                                                <Form noValidate>
                                                    <Form.Field
                                                        error={emailErr}
                                                    >
                                                        <label htmlFor='updateEmail'></label>
                                                        <Form.Input
                                                            id='updateEmail'
                                                            name='updateEmail'
                                                            type='email'
                                                            placeholder='Email...'
                                                            icon='mail'
                                                            iconPosition='left'
                                                            onChange={(e) => { setEmail(e.target.value) }}
                                                            value={email}
                                                        />
                                                    </Form.Field>
                                                    <Button
                                                        color='green'
                                                        fluid
                                                        onClick={submitEmailChange}
                                                        loading={emailLoading}
                                                    >
                                                        <Icon name='save' />
                                                        Save
                                                    </Button>
                                                </Form>
                                            </Segment>
                                            <Segment
                                                raised
                                                disabled={accountData.authMethod !== 'Traditional'}
                                            >
                                                <h3>Change Password</h3>
                                                <Form noValidate>
                                                    <Form.Field
                                                        error={currPassErr}
                                                    >
                                                        <label htmlFor='currentPassword'>Current Password</label>
                                                        <Form.Input
                                                            id='currentPassword'
                                                            name='currentPassword'
                                                            type='password'
                                                            placeholder='Current Password...'
                                                            icon='unlock'
                                                            iconPosition='left'
                                                            onChange={(e) => { setCurrPassword(e.target.value) }}
                                                            value={currPassword}
                                                        />
                                                    </Form.Field>
                                                    <Form.Field
                                                        error={newPassErr}
                                                    >
                                                        <label htmlFor='newPassword'>
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
                                                        <Form.Input
                                                            id='newPassword'
                                                            name='newPassword'
                                                            type={showPassword ? 'text' : 'password'}
                                                            placeholder='New Password...'
                                                            icon='lock'
                                                            iconPosition='left'
                                                            onChange={handleNewPassChange}
                                                            value={newPassword}
                                                        />
                                                        <p className='mt-2p mb-2p text-center'><em>Password must be longer than 8 characters and must contain at least one number. Never reuse passwords between sites.</em></p>
                                                        <p className='mt-2p mb-2p text-center'>
                                                            <strong>You will need to log in again after updating.</strong>
                                                        </p>
                                                    </Form.Field>
                                                    <Button
                                                        color='green'
                                                        fluid
                                                        onClick={submitPasswordChange}
                                                        loading={passLoading}
                                                    >
                                                        <Icon name='save' />
                                                        Save
                                                    </Button>
                                                </Form>
                                            </Segment>
                                        </Segment>
                                    }
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Segment>
                    {/* Edit Name Modal */}
                    <Modal
                        open={showENModal}
                        onClose={closeEditNameModal}
                    >
                        <Modal.Header>Edit Name</Modal.Header>
                        <Modal.Content scrolling>
                            <Form noValidate>
                                <Form.Field
                                    error={enFirstErr}
                                >
                                    <label htmlFor='enFirstName'>First Name</label>
                                    <Form.Input
                                        id='enFirstName'
                                        name='enFirstName'
                                        type='text'
                                        placeholder='First Name...'
                                        icon='user'
                                        iconPosition='left'
                                        onChange={(e) => { setENFirstName(e.target.value) }}
                                        value={enFirstName}
                                    />
                                </Form.Field>
                                <Form.Field
                                    error={enLastErr}
                                >
                                    <label htmlFor='enLastName'>Last Name</label>
                                    <Form.Input
                                        id='enLastName'
                                        name='enLastName'
                                        type='text'
                                        placeholder='Last Name...'
                                        icon='users'
                                        iconPosition='left'
                                        onChange={(e) => { setENLastName(e.target.value) }}
                                        value={enLastName}
                                    />
                                </Form.Field>
                            </Form>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                onClick={closeEditNameModal}
                            >
                                Cancel
                            </Button>
                            <Button
                                color='green'
                                loading={enLoading}
                                onClick={submitEditName}
                            >
                                <Icon name='save' />
                                Save
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Update Email Success Modal */}
                    <Modal
                        open={showEUSModal}
                        onClose={() => { setShowEUSModal(false) }}
                    >
                        <Modal.Header>Email Updated</Modal.Header>
                        <Modal.Content scrolling>
                            <p>Your email was updated succesfully!</p>
                            <p>You can now use it to login to Conductor. Email notifications will now be sent to this address.</p>
                        </Modal.Content>
                        <Modal.Actions>
                            <Button
                                color='blue'
                                onClick={() => { setShowEUSModal(false) }}
                            >
                                Done
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    {/* Uploading Avatar Modal */}
                    <Modal
                        open={showAvatarModal}
                        onClose={() => setShowAvatarModal(false)}
                        basic
                    >
                        <Modal.Content>
                            <Loader active inline='centered'>Uploading Avatar</Loader>
                        </Modal.Content>
                    </Modal>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    );
};

export default AccountSettings;
