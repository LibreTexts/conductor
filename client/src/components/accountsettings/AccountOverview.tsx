import { useRef, useState } from 'react';
import axios from 'axios';
import {
  Grid,
  Header,
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
import useGlobalError from '../error/ErrorHooks';
import { Account } from '../../types';

/**
 * The Account Overview pane displays general Conductor account information and allows
 * users to edit their name or avatar.
 */
const AccountOverview = ({ account, onDataChange }: {account: Account, onDataChange: Function}) => {

  const DEFAULT_AVATAR = '/mini_logo.png';

  // Global Error Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const [showAvatarLoading, setShowAvatarLoading] = useState(false);
  const avatarUploadRef = useRef(null);

  // Edit Name
  const [showEditName, setShowEditName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameErr, setFirstNameErr] = useState(false);
  const [lastNameErr, setLastNameErr] = useState(false);
  const [editNameLoading, setEditNameLoading] = useState(false);

  /**
   * Resets any error states in the Edit Name form.
   */
  function resetEditNameFormErrors() {
    setFirstNameErr(false);
    setLastNameErr(false);
  }

  /**
   * Validates all fields in the Edit Name form and sets error states if necessary.
   *
   * @returns {boolean} True if all valid, false otherwise.
   */
  function validateEditNameForm() {
    let validForm = true;
    if (!firstName || firstName.length < 2 || firstName.length > 100) {
      validForm = false;
      setFirstNameErr(true);
    }
    if (!lastName || lastName.length > 100) {
      validForm = false;
      setLastNameErr(true);
    }
    return validForm;
  }

  /**
   * Submits the user name change to the server, then closes the Edit Name modal.
   */
  async function submitEditName() {
    resetEditNameFormErrors();
    if (validateEditNameForm()) {
      setEditNameLoading(true);
      try {
        const editRes = await axios.put('/user/name', {
          firstName,
          lastName,
        });
        if (!editRes.data.err) {
          handleCloseEditName();
          onDataChange();
        } else {
          handleGlobalError(editRes.data.errMsg);
        }
      } catch (e) {
        handleGlobalError(e);
      }
      setEditNameLoading(false);
    }
  }

  /**
   * Updates state with changes to the First Name field.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler. 
   */
  function handleFirstNameChange(e: any) {
    setFirstName(e.target.value);
  }

  /**
   * Updates state with changes to the Last Name field.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Event that activated the handler. 
   */
  function handleLastNameChange(e: any) {
    setLastName(e.target.value);
  }

  /**
   * Opens the Edit Name modal.
   */
  function handleOpenEditName() {
    setFirstName(account.firstName);
    setLastName(account.lastName);
    setShowEditName(true);
  }

  /**
   * Closes the Edit Name modal.
   */
  function handleCloseEditName() {
    setShowEditName(false);
  }

  /**
   * Closes the 'Uploading Avatar' modal/dimmer.
   */
  function handleCloseAvatarLoading() {
    setShowAvatarLoading(false);
  }

  /**
   * Starts the new avatar upload process by activating the hidden file input.
   */
  function handleUploadAvatar() {
    if (avatarUploadRef.current) {
      (avatarUploadRef.current as HTMLInputElement).click();
    }
  }

  /**
   * Process the uploaded avatar and send it to the server.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event - Event that activated the handler.
   */
  async function handleAvatarUploadFileChange(event: any) {
    const validFileTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!event.target || typeof (event?.target?.files) !== 'object') {
      return;
    }

    if (event.target.files.length !== 1) {
      handleGlobalError('Only one file can be uploaded at a time.');
      return;
    }

    const newAvatar = event.target.files[0];
    if (!(newAvatar instanceof File) || !validFileTypes.includes(newAvatar.type)) {
      handleGlobalError('Sorry, that file type is not supported.');
    }

    setShowAvatarLoading(true);
    const formData = new FormData();
    formData.append('avatarFile', newAvatar);

    try {
      const uploadRes = await axios.post(
        '/user/avatar',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      if (!uploadRes.data.err) {
        window.location.reload();
      } else {
        throw (new Error(uploadRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setShowAvatarLoading(false);
  }


  return (
    <Segment basic className="pane-segment">
      <h2>Account Overview</h2>
      <Divider />
      <Grid divided="vertically">
        <Grid.Row>
          <Grid.Column width={4}>
            <Image
              src={account?.avatar || DEFAULT_AVATAR}
              size="medium"
              circular
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif"
              id="conductor-userprofile-avatar-upload"
              hidden
              ref={avatarUploadRef}
              onChange={handleAvatarUploadFileChange}
            />
            <Button.Group
              color="blue"
              vertical
              labeled
              icon
              fluid
              className="mt-2r"
            >
              <Button
                fluid
                disabled={account?.authType !== 'Traditional'}
                onClick={handleOpenEditName}
                icon="male"
                content="Edit Name"
              />
              <Button
                fluid
                onClick={handleUploadAvatar}
                icon="image"
                content="Edit Avatar"
              />
            </Button.Group>
            <span className="muted-text small-text">Max file size: 5 MB</span>
          </Grid.Column>
          <Grid.Column width={12}>
            <Header as="h2">
              {account?.firstName} {account?.lastName}
            </Header>
            <Header sub>Email</Header>
            {(account?.email)
              ? <p>{account.email}</p>
              : <p><em>Unknown</em></p>
            }
            <Header sub>Authentication Method</Header>
            {(account?.authType)
              ? <p>{account.authType}</p>
              : <p><em>Unknown</em></p>
            }
            <Header sub>Account Creation Date</Header>
            {(account?.createdAt)
              ? <p>{account.createdAt}</p>
              : <p><em>Unknown</em></p>
            }
            <Header sub>Roles</Header>
            {Array.isArray(account?.roles)
              ? (
                <List verticalAlign="middle" celled relaxed>
                  {account.roles.map((item, idx) => {
                    let org = 'Unknown Organization';
                    if (item.org) {
                      if (item.org.shortName) {
                        org = item.org.shortName;
                      } else if (item.org.name) {
                        org = item.org.name;
                      }
                    }
                    return (
                      <List.Item key={idx}>
                        <List.Icon name="building" />
                        <List.Content>
                          <List.Header>{org}</List.Header>
                          <List.Description>
                            {item.role || 'Unknown Role'}
                          </List.Description>
                        </List.Content>
                      </List.Item>
                    );
                  })}
                </List>
              )
              : <p><em>No roles available.</em></p>
            }
          </Grid.Column>
        </Grid.Row>
      </Grid>
      {/* Edit Name Modal */}
      <Modal open={showEditName} onClose={handleCloseEditName}>
        <Modal.Header>Edit Name</Modal.Header>
        <Modal.Content scrolling>
          <Form noValidate>
            <Form.Field error={firstNameErr}>
              <label htmlFor="enFirstName">First Name</label>
              <Form.Input
                id="enFirstName"
                name="enFirstName"
                type="text"
                placeholder="First Name..."
                icon="user"
                iconPosition="left"
                onChange={handleFirstNameChange}
                value={firstName}
              />
            </Form.Field>
            <Form.Field error={lastNameErr}>
              <label htmlFor="enLastName">Last Name</label>
              <Form.Input
                id="enLastName"
                name="enLastName"
                type="text"
                placeholder="Last Name..."
                icon="users"
                iconPosition="left"
                onChange={handleLastNameChange}
                value={lastName}
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseEditName}>Cancel</Button>
          <Button
            color="green"
            loading={editNameLoading}
            onClick={submitEditName}
          >
            <Icon name="save" />
            Save
          </Button>
        </Modal.Actions>
      </Modal>
      {/* Uploading Avatar Modal */}
      <Modal
        open={showAvatarLoading}
        onClose={handleCloseAvatarLoading}
        basic
      >
        <Modal.Content>
          <Loader active inline="centered">Uploading Avatar</Loader>
        </Modal.Content>
      </Modal>
    </Segment>
  );
};

export default AccountOverview;
