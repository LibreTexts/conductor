import React, { memo, useCallback, useEffect, useMemo, useRef, useState,FC } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { Button, Comment, Modal, Select, Spinner } from '@libretexts/davis-react';
import { IconSend } from '@tabler/icons-react';
import TextArea from '../TextArea';
import { isEmptyString } from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks';
import './Chat.css';
import {User} from "../../types";
import { format } from 'date-fns';
import { CHAT_NOTIFY_OPTS } from '../../utils/constants';

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
  defaultNotificationSetting?: string;
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
  defaultNotificationSetting: defaultNotificationSettingProp
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
    if (kind === 'task') {
      return [
        { key: 'assigned', text: 'Notify assignees', value: 'assigned' },
        ...CHAT_NOTIFY_OPTS(false, handleOpenNotifyPicker)
      ]
    }
    return CHAT_NOTIFY_OPTS(false, handleOpenNotifyPicker);
  }, [kind, handleOpenNotifyPicker]);

  const defaultNotificationSetting = useMemo(() => {
    if (kind === 'task') {
      return 'assigned';
    }
    if(defaultNotificationSettingProp){
      return defaultNotificationSettingProp;
    }
    return 'all';
  }, [kind]);

  const [notifySetting, setNotifySetting] = useState(defaultNotificationSetting);

  const notificationSelectOptions = useMemo(() =>
    notificationOptions.map((opt) => ({ value: opt.value, label: opt.text })),
    [notificationOptions]
  );

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
  function handleChangeTeamToNotify(e: React.ChangeEvent<HTMLSelectElement>) {
    const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
    setTeamToNotify(values as any);
  }

  /**
   * Saves changes in the selected notification setting to state. If the new setting
   * is `specific`, the Notify People Picker is opened.
   *
   * @param {object} e - Event that activated the handler.
   * @param {object} data - Data passed from the UI component.
   * @param {string} data.value - The new notification setting. 
   */
  function handleNotifySettingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === 'specific') {
      handleOpenNotifyPicker();
    } else {
      setNotifySetting(value);
    }
  };

  return (
    <div id="conductor-chat">
      <div id="conductor-chat-msgs-header-container">
        <div className="left-flex">
          <span className="font-semibold text-base text-gray-800">
            {activeThreadTitle !== '' ? <em>{activeThreadTitle}</em> : 'Messages'}
          </span>
        </div>
        <div className="right-flex" id="conductor-chat-msgs-header-options"></div>
      </div>
      <div id="conductor-chat-window">
        {(loadedThreadMsgs && activeThreadMsgs.length > 0) && (
          <div id="conductor-chat-msgs">
            {activeThreadMsgs.map((item) => {
              const today = new Date();
              const itemDate = new Date(item.createdAt);
              if (today.getDate() === itemDate.getDate()) {
                item.date = 'Today';
              } else {
                item.date = format(itemDate, 'MMM do, yyyy');
              }
              item.time = format(itemDate, 'h:mm a');
              const readyMsgBody = {
                __html: DOMPurify.sanitize(marked(item.body, { breaks: true }))
              };
              return (
                <Comment key={item.messageID} className="conductor-chat-msg">
                  <Comment.Header
                    avatar={{ src: item.author?.avatar || '/mini_logo.png', name: `${item.author?.firstName} ${item.author?.lastName}` }}
                    name={`${item.author?.firstName} ${item.author?.lastName}`}
                  >
                    <span className="text-xs text-gray-500 ml-2">{item.date} at {item.time}</span>
                    {((item.author?.uuid === user.uuid) || isProjectAdmin) && (
                      <button
                        className="conductor-chat-del text-xs text-gray-400 ml-2"
                        onClick={() => handleOpenDeleteMessage(item.messageID)}
                      >
                        Delete
                      </button>
                    )}
                  </Comment.Header>
                  <Comment.Body>
                    <div
                      className="conductor-chat-msg-body !prose prose-code:before:hidden prose-code:after:hidden !max-w-none"
                      dangerouslySetInnerHTML={readyMsgBody}
                    />
                  </Comment.Body>
                </Comment>
              );
            })}
          </div>
        )}
        {(loadedThreadMsgs && activeThreadMsgs.length === 0) && (
          <p className="text-center muted-text mt-4r"><em>No messages yet. Send one below!</em></p>
        )}
        {(!loadedThreadMsgs && activeThread !== '') && (
          <div className="flex justify-center mt-8"><Spinner /></div>
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
        <TextArea
          placeholder="Send a message..."
          textValue={messageCompose}
          onTextChange={(value) => setMessageCompose(value)}
          contentType="message"
          hideFormatMsg
          rows={1}
          maxLength={2000}
        />
        <div id="replycontainer-actions">
          <Select
            id="replycontainer-notifydropdown"
            name="chat-notification-setting"
            label="Notification setting"
            labelClassName="sr-only"
            placeholder="Notify..."
            options={notificationSelectOptions}
            value={notifySetting}
            onChange={handleNotifySettingChange}
            selectClassName="text-sm"
          />
          <Button
            id="replycontainer-sendbutton"
            variant="primary"
            disabled={activeThread === '' || messageCompose === '' || messageCompose.length > 2000}
            loading={messageSending}
            onClick={sendMessage}
            icon={<IconSend size={15} />}
          >
            Send
          </Button>
        </div>
      </div>
      {/* Notify People Picker */}
      <Modal open={showNotifyPicker} onClose={handleCloseNotifyPicker}>
        <Modal.Header>
          <Modal.Title>Choose People to Notify</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">Choose which team members to notify</p>
          {loadingTeam ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <select
              multiple
              size={5}
              className="w-full border border-gray-300 rounded p-2 text-sm"
              onChange={handleChangeTeamToNotify}
              value={teamToNotify as string[]}
            >
              {(projectTeam as any[]).map((item) => (
                <option key={item.key} value={item.value}>{item.text}</option>
              ))}
            </select>
          )}
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end">
            <Button variant="primary" loading={loadingTeam} onClick={handleSetTeamToNotify}>Done</Button>
          </div>
        </Modal.Footer>
      </Modal>
      {/* Delete Discussion Message Modal */}
      <Modal open={showDelMsgModal} onClose={handleCloseDeleteMessage}>
        <Modal.Header>
          <Modal.Title>Delete Message</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            {'Are you sure you want to delete this message? '}
            <span className="muted-text">(MessageID: {delMsgID})</span>
          </p>
          <p><strong>This action is irreversible.</strong></p>
        </Modal.Body>
        <Modal.Footer>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseDeleteMessage}>Cancel</Button>
            <Button variant="destructive" loading={delMsgLoading} onClick={submitDeleteMessage}>
              Delete Message
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </div>
  )
};


export default memo(Chat);
