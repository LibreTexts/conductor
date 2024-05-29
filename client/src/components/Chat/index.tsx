import React, { memo, useCallback, useEffect, useMemo, useRef, useState,FC } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import {
  Header,
  Button,
  Modal,
  Icon,
  Loader,
  Comment,
  Dropdown
} from 'semantic-ui-react';
import TextArea from '../TextArea';
import { isEmptyString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks';
import './Chat.css';
import {User} from "../../types";
import { format } from 'date-fns';
interface Chatinterface {
  projectID: string;
  user: User; 
  mode: string;
  kind: string;
  activeThread: string; 
  activeThreadTitle: string;
  activeThreadMsgs: any[];
  loadedThreadMsgs: boolean;
  getThreads?: () => void | null;
  getMessages: () => void;
  isProjectAdmin: boolean;
}
/**
 * A reusable chat/message thread interface.
 */
const Chat: FC<Chatinterface>= ({
  projectID,
  user,
  mode,
  kind,
  activeThread,
  activeThreadTitle,
  activeThreadMsgs,
  loadedThreadMsgs,
  getThreads,
  getMessages,
  isProjectAdmin,
}) => {

  // Global State and Eror Handling
  const { handleGlobalError } = useGlobalError();

  // UI
  const chatWindowBottom = useRef<HTMLDivElement>(null);

  // Delete Message Modal
  const [showDelMsgModal, setShowDelMsgModal] = useState(false);
  const [delMsgID, setDelMsgID] = useState('');
  const [delMsgLoading, setDelMsgLoading] = useState(false);

  // Chat
  const [messageCompose, setMessageCompose] = useState('');
  const [messageSending, setMessageSending] = useState(false);

  // Notify Settings
  const [showNotifyPicker, setShowNotifyPicker] = useState(false);
  const [projectTeam, setProjectTeam] = useState([]);
  const [teamToNotify, setTeamToNotify] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  /**
   * Retrieves a list of team members in the current Project from the server and saves it to state.
   */
  const getProjectTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const teamRes = await axios.get(`/project/${projectID}/team`, {
        params: { combine: true, excludeCurrent: true },
      });
      if (!teamRes.data.err) {
        if (Array.isArray(teamRes.data.team)) {
          const shaped = teamRes.data.team.map((item:any) => ({
            key: item.uuid,
            text: `${item.firstName} ${item.lastName}`,
            value: item.uuid,
          }));
          setProjectTeam(shaped);
        }
      } else {
        throw (new Error(teamRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setLoadingTeam(false);
  }, [projectID, setProjectTeam, setLoadingTeam, handleGlobalError]);

  /**
   * Opens the Notify People Picker and loads team members from the server.
   */
  const handleOpenNotifyPicker = useCallback(() => {
    getProjectTeam();
    setShowNotifyPicker(true);
  }, [getProjectTeam]);

  const notificationOptions = useMemo(() => {
    const NOTIFY_OPTIONS = [
      {
        key: 'all',
        text: 'Notify entire team',
        value: 'all',
      },
      {
        key: 'specific',
        text: 'Notify specific people...',
        value: 'specific',
        onClick: handleOpenNotifyPicker,
      },
      {
        key: 'support',
        text: 'Notify LibreTexts Support',
        value: 'support',
      },
      {
        key: 'none',
        text: `Don't notify anyone`,
        value: 'none',
      },
    ];
    if (kind === 'task') {
      return [
        { key: 'assigned', text: 'Notify assignees', value: 'assigned' },
        ...NOTIFY_OPTIONS,
      ]
    }
    return NOTIFY_OPTIONS;
  }, [kind, handleOpenNotifyPicker]);

  const defaultNotificationSetting = useMemo(() => {
    if (kind === 'task') {
      return 'assigned';
    }
    return 'all';
  }, [kind]);

  const [notifySetting, setNotifySetting] = useState(defaultNotificationSetting);

  const notifySettingDropdownText = useMemo(() => {
    if (notifySetting === 'specific') {
      const modifier = teamToNotify.length > 1 ? 'people' : 'person';
      return `Notify ${teamToNotify.length} ${modifier}`;
    }
    const foundOption = notificationOptions.find((item) => item.value === notifySetting);
    return foundOption?.text;
  }, [notifySetting, notificationOptions, teamToNotify]);

  /**
   * Register plugins on load.
   */
  useEffect(() => {
    // Hook to force message links to open in new window
    DOMPurify.addHook('afterSanitizeAttributes', function (node) {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer')
      }
    });
  }, []);

  useEffect(() => {
    if (loadedThreadMsgs && activeThreadMsgs.length > 0) {
      chatWindowBottom.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [loadedThreadMsgs, activeThreadMsgs]);

  /**
   * Submits the new message and notification settings to the server, then
   * refreshes available data.
   */
  async function sendMessage() {
    setMessageSending(true);
    try {
      if (!isEmptyString(messageCompose)) {
        const msgData = {
          message: messageCompose,
          notify: notifySetting,
          notifyUsers: [] as string []
        };
        let postURL = `/project/thread/${activeThread}/message`;
        if (kind !== 'project' && kind !== 'a11y' && kind !== 'peerreview') {
          postURL = `/project/task/${activeThread}/message`;
        }
        if (notifySetting === 'specific') {
          msgData.notifyUsers = teamToNotify;
        }
        const sendRes = await axios.post(postURL, msgData);
        if (!sendRes.data.err) {
          if (typeof (getThreads) === 'function') {
            getThreads();
          }
          getMessages();
          setMessageCompose('');
        } else {
          throw (new Error(sendRes.data.errMsg));
        }
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setMessageSending(false);
  }

  /**
   * Opens the Delete Message modal.
   *
   * @param {string} msgID - Identifier of the message to delete.
   */
  function handleOpenDeleteMessage(msgID:string) {
    if (msgID) {
      setDelMsgID(msgID);
      setDelMsgLoading(false);
      setShowDelMsgModal(true);
    }
  }

  /**
   * Closes the Delete Message modal and resets state.
   */
  function handleCloseDeleteMessage() {
    setShowDelMsgModal(false);
    setDelMsgID('');
    setDelMsgLoading(false);
  }

  /**
   * Submits the message deletion request to the server, then refreshes available data.
   */
  async function submitDeleteMessage() {
    setDelMsgLoading(true);
    try {
      const deleteURL = kind === 'project' ? '/project/thread/message' : '/project/task/message';
      const deleteRes = await axios.delete(deleteURL, { data: { messageID: delMsgID } });
      if (!deleteRes.data.err) {
        if (typeof (getThreads) === 'function') {
          getThreads();
        }
        getMessages();
        handleCloseDeleteMessage();
      } else {
        throw (new Error(deleteRes.data.errMsg));
      }
    } catch (e) {
      handleGlobalError(e);
    }
    setDelMsgLoading(false);
  }

  /**
   * Closes the Notify People Picker and resets its state.
   */
  function handleCloseNotifyPicker() {
    setShowNotifyPicker(false);
    setProjectTeam([]);
  }

  /**
   * Saves the selected team members to notify to state and closes the Notify People Picker.
   */
  function handleSetTeamToNotify() {
    if (teamToNotify.length > 0) {
      setNotifySetting('specific');
    } else {
      setNotifySetting('none');
    }
    handleCloseNotifyPicker();
  }

  /**
   * Saves changes in the selected team members to notify to state.
   *
   * @param {object} e - Event that activated the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string[]} data.value - The updated list of selected team members. 
   */
  function handleChangeTeamToNotify(_e:React.SyntheticEvent<HTMLElement, Event>, { value }: any) {
    setTeamToNotify(value);
  }

  /**
   * Saves changes in the selected notification setting to state. If the new setting
   * is `specific`, the Notify People Picker is opened.
   *
   * @param {object} e - Event that activated the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string} data.value - The new notification setting. 
   */
  function handleNotifySettingChange(_e:React.SyntheticEvent<HTMLElement, Event>, { value }:any) {
    if (value !== 'specific') {
      setNotifySetting(value);
    }
  };

  return (
    <div id="conductor-chat">
      <div id="conductor-chat-msgs-header-container">
        <div className="left-flex">
          <Header as="h3">
            {(activeThreadTitle !== '')
              ? <em>{activeThreadTitle}</em>
              : <span>Messages</span>
            }
          </Header>
        </div>
        <div className="right-flex" id="conductor-chat-msgs-header-options"></div>
      </div>
      <div id="conductor-chat-window">
        {(loadedThreadMsgs && activeThreadMsgs.length > 0) && (
          <Comment.Group id="conductor-chat-msgs">
            {activeThreadMsgs.map((item) => {
              const today = new Date();
              const itemDate = new Date(item.createdAt);
              if (today.getDate() === itemDate.getDate()) { // today
                item.date = 'Today';
              } else {
               item.date = format(itemDate, 'MMM do, yyyy')
              }
              item.time = format(itemDate, 'h:mm a');
              const readyMsgBody = {
                __html: DOMPurify.sanitize(marked(item.body, { breaks: true }))
              };
              return (
                <Comment className="conductor-chat-msg" key={item.messageID}>
                  <Comment.Avatar src={item.author?.avatar || '/mini_logo.png'} />
                  <Comment.Content>
                    <Comment.Author as="span">
                      {item.author?.firstName} {item.author?.lastName}
                    </Comment.Author>
                    <Comment.Metadata>
                      <div><span>{item.date} at {item.time}</span></div>
                    </Comment.Metadata>
                    <Comment.Text
                      className="conductor-chat-msg-body !prose prose-code:before:hidden prose-code:after:hidden !max-w-none"
                      dangerouslySetInnerHTML={readyMsgBody}
                    />
                    {((item.author?.uuid === user.uuid) || isProjectAdmin) && (
                      <Comment.Actions>
                        <Comment.Action className="conductor-chat-del"
                          
                          onClick={() => handleOpenDeleteMessage(item.messageID)}
                        >
                          Delete
                        </Comment.Action>
                      </Comment.Actions>
                    )}
                  </Comment.Content>
                </Comment>
              )
            })}
          </Comment.Group>
        )}
        {(loadedThreadMsgs && activeThreadMsgs.length === 0) && (
          <p className="text-center muted-text mt-4r"><em>No messages yet. Send one below!</em></p>
        )}
        {(!loadedThreadMsgs && activeThread !== '') && (
          <Loader active inline="centered" className="mt-4r" />
        )}
        {(activeThread === '' && activeThreadMsgs.length === 0) && (
          <p className="text-center muted-text mt-4r">
            <em>
              {mode === 'standalone'
                ? 'No chat identifier specified!'
                : 'No thread selected. Select one from the list on the left or create one using the + button!'
              }
            </em>
          </p>
        )}
        <div ref={chatWindowBottom} />
      </div>
      <div id="conductor-chat-reply-container">
        <div id="replycontainer-left">
          <TextArea
            placeholder="Send a message..."
            textValue={messageCompose}
            onTextChange={(value) => setMessageCompose(value)}
          />
        </div>
        <div id="replycontainer-right">
          <Button
            id="replycontainer-sendbutton"
            color="blue"
            disabled={activeThread === '' || messageCompose === ''}
            loading={messageSending}
            onClick={sendMessage}
            fluid
          >
            <Icon name="send" />
            Send
          </Button>
          <Dropdown
            id="replycontainer-notifydropdown"
            options={notificationOptions}
            selection
            value={notifySetting}
            onChange={(e,data)=>handleNotifySettingChange(e,data)}
            text={notifySettingDropdownText}
          />
        </div>
      </div>
      {/* Notify People Picker */}
      <Modal open={showNotifyPicker} onClose={handleCloseNotifyPicker}>
        <Modal.Header>Choose People to Notify</Modal.Header>
        <Modal.Content>
          <p>Choose which team members to notify</p>
          <Dropdown
            placeholder="Team members..."
            fluid
            multiple
            search
            selection
            options={projectTeam}
            onChange={(e,data)=>handleChangeTeamToNotify(e,data)}
            value={teamToNotify}
            loading={loadingTeam}
          />
        </Modal.Content>
        <Modal.Actions>
          <Button color="blue" loading={loadingTeam} onClick={handleSetTeamToNotify}>Done</Button>
        </Modal.Actions>
      </Modal>
      {/* Delete Discussion Message Modal */}
      <Modal open={showDelMsgModal} onClose={handleCloseDeleteMessage}>
        <Modal.Header>Delete Message</Modal.Header>
        <Modal.Content>
          <p>
            {'Are you sure you want to this message? '}
            <span className="muted-text">(MessageID: {delMsgID})</span>
          </p>
          <p><strong>This action is irreversible.</strong></p>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={handleCloseDeleteMessage}>
            Cancel
          </Button>
          <Button color="red" loading={delMsgLoading} onClick={submitDeleteMessage}>
            <Icon name="trash" />
            Delete Message
          </Button>
        </Modal.Actions>
      </Modal>
    </div>
  )
};


export default memo(Chat);
