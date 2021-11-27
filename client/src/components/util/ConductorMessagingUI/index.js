//
// LibreTexts Conductor
// ConductorMessagingUI/index.js
// A reusable messaging (threads and chat window) interface for use in
// the Conductor UI.
//

import './ConductorMessagingUI.css';

import {
    Header,
    Button,
    Modal,
    Icon,
    Loader,
    Form,
    Input
} from 'semantic-ui-react';
import React, { useEffect, useState, useCallback, memo } from 'react';
import ConductorChatUI from '../ConductorChatUI';
import axios from 'axios';
import DOMPurify from 'dompurify';
import marked from 'marked';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';

import {
    isEmptyString,
    truncateString
} from '../HelperFunctions.js';

import useGlobalError from '../../error/ErrorHooks.js';


const ConductorMessagingUI = ({ projectID, user, kind }) => {

    // Global State and Eror Handling
    const { handleGlobalError } = useGlobalError();

    // New Thread Modal
    const [showNewThreadModal, setShowNewThreadModal] = useState(false);
    const [newThreadTitle, setNewThreadTitle] = useState('');
    const [newThreadLoading, setNewThreadLoading] = useState(false);

    // Delete Thread Modal
    const [showDelThreadModal, setShowDelThreadModal] = useState(false);
    const [delThreadLoading, setDelThreadLoading] = useState(false);

    // Discussion
    const [projectThreads, setProjectThreads] = useState([]);
    const [loadedProjThreads, setLoadedProjThreads] = useState(false);
    const [activeThread, setActiveThread] = useState('');
    const [activeThreadTitle, setActiveThreadTitle] = useState('');
    const [activeThreadMsgs, setActiveThreadMsgs] = useState([]);
    const [loadedThreadMsgs, setLoadedThreadMsgs] = useState(false);

    const getDiscussionThreads = useCallback(() => {
        setLoadedProjThreads(false);
        axios.get('/project/threads', {
            params: {
                projectID: projectID,
                kind: kind
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.threads && Array.isArray(res.data.threads)) {
                    setProjectThreads(res.data.threads);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedProjThreads(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedProjThreads(true);
        });
    }, [projectID, handleGlobalError, kind]);


    const getThreadMessages = useCallback(() => {
        setLoadedThreadMsgs(false);
        axios.get('/project/thread/messages', {
            params: {
                threadID: activeThread
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.messages && Array.isArray(res.data.messages)) {
                    setActiveThreadMsgs(res.data.messages);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedThreadMsgs(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedThreadMsgs(true);
        });
    }, [activeThread, handleGlobalError]);


    /** INITIALIZATION **/
    useEffect(() => {
        date.plugin(ordinal);
        date.plugin(day_of_week);
        // Hook to force message links to open in new window
        DOMPurify.addHook('afterSanitizeAttributes', function (node) {
          if ('target' in node) {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer')
          }
        });
        if (projectID !== null && user !== null && kind !== null) {
            getDiscussionThreads();
        }
    }, [projectID, user, kind, getDiscussionThreads]);

    useEffect(() => {
        if (!isEmptyString(activeThread)) {
            getThreadMessages();
        }
    }, [activeThread, getThreadMessages]);


    const activateThread = (thread) => {
        setActiveThread(thread.threadID);
        setActiveThreadTitle(thread.title);
    };


    const submitNewThread = () => {
        if (!isEmptyString(newThreadTitle)) {
            setNewThreadLoading(true);
            axios.post('/project/thread', {
                projectID: projectID,
                title: newThreadTitle,
                kind: kind
            }).then((res) => {
                if (!res.data.err) {
                    getDiscussionThreads();
                    closeNewThreadModal();
                } else {
                    handleGlobalError(res.data.errMsg);
                    setNewThreadLoading(false);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setNewThreadLoading(false);
            });
        }
    };


    const openNewThreadModal = () => {
        setNewThreadLoading(false);
        setNewThreadTitle('');
        setShowNewThreadModal(true);
    };


    const closeNewThreadModal = () => {
        setShowNewThreadModal(false);
        setNewThreadLoading(false);
        setNewThreadTitle('');
    };


    const submitDeleteThread = () => {
        if (!isEmptyString(activeThread)) {
            setDelThreadLoading(true);
            axios.delete('/project/thread', {
                data: {
                    threadID: activeThread
                }
            }).then((res) => {
                if (!res.data.err) {
                    setActiveThread('');
                    setActiveThreadTitle('');
                    setActiveThreadMsgs([]);
                    setLoadedThreadMsgs(false);
                    getDiscussionThreads();
                    closeDelThreadModal();
                } else {
                    setDelThreadLoading(false);
                    handleGlobalError(res.data.errMsg);
                }
            }).catch((err) => {
                handleGlobalError(err);
                setDelThreadLoading(false);
            });
        }
    };

    const openDelThreadModal = () => {
        setDelThreadLoading(false);
        setShowDelThreadModal(true);
    };

    const closeDelThreadModal = () => {
        setShowDelThreadModal(false);
        setDelThreadLoading(false);
    };


    return (
        <div id='project-discussion-container'>
            <div id='project-discussion-threads'>
                <div className='flex-col-div' id='project-threads-container'>
                    <div className='flex-row-div' id='project-threads-header-container'>
                        <div className='left-flex'>
                            <Header as='h3'>Threads</Header>
                        </div>
                        <div className='right-flex'>
                            <Button
                                circular
                                icon='trash'
                                color='red'
                                disabled={activeThread === ''}
                                onClick={openDelThreadModal}
                                className='mr-2p'
                            />
                            <Button
                                circular
                                icon='plus'
                                color='olive'
                                onClick={openNewThreadModal}
                            />
                        </div>
                    </div>
                    <div className='flex-col-div' id='project-threads-list-container'>
                        {(loadedProjThreads && projectThreads.length > 0) &&
                            projectThreads.map((item, idx) => {
                                let lastMessage = '*No messages yet*';
                                if (item.lastMessage && item.lastMessage.body) {
                                    lastMessage = `${item.lastMessage.author?.firstName} ${item.lastMessage.author?.lastName}: ${truncateString(item.lastMessage.body, 50)}`;
                                }
                                const readyLastMsg = {
                                    __html: DOMPurify.sanitize(marked.parseInline(lastMessage))
                                };
                                return (
                                    <div
                                        className={activeThread === item.threadID
                                            ? 'project-threads-list-item active'
                                            : 'project-threads-list-item'}
                                        key={item.threadID}
                                        onClick={() => activateThread(item)}
                                    >
                                        <p
                                            className={activeThread === item.threadID
                                                ? 'project-threads-list-title active'
                                                : 'project-threads-list-title'}
                                        >
                                            {item.title}
                                        </p>
                                        <p className='project-threads-list-descrip' dangerouslySetInnerHTML={readyLastMsg}>
                                        </p>
                                    </div>
                                )
                            })
                        }
                        {(loadedProjThreads && projectThreads.length === 0) &&
                            <p className='text-center muted-text mt-4r'><em>No threads yet. Create one above!</em></p>
                        }
                        {(!loadedProjThreads) &&
                            <Loader active inline='centered' className='mt-4r' />
                        }
                    </div>
                </div>
            </div>
            <ConductorChatUI
                projectID={projectID}
                user={user}
                kind={kind}
                activeThread={activeThread}
                activeThreadTitle={activeThreadTitle}
                activeThreadMsgs={activeThreadMsgs}
                loadedThreadMsgs={loadedThreadMsgs}
                getThreads={getDiscussionThreads}
                getMessages={getThreadMessages}
            />
            {/* New Discussion Thread Modal */}
            <Modal
                open={showNewThreadModal}
                onClose={closeNewThreadModal}
            >
                <Modal.Header>Create a Thread</Modal.Header>
                <Modal.Content>
                    <Form noValidate>
                        <Form.Field>
                            <label>Thread Title</label>
                            <Input
                                type='text'
                                icon='comments'
                                iconPosition='left'
                                placeholder='Enter thread title or topic...'
                                onChange={(e) => setNewThreadTitle(e.target.value)}
                                value={newThreadTitle}
                            />
                        </Form.Field>
                    </Form>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        onClick={closeNewThreadModal}
                    >
                        Cancel
                    </Button>
                    <Button
                        color='green'
                        loading={newThreadLoading}
                        onClick={submitNewThread}
                    >
                        <Icon name='add' />
                        Create Thread
                    </Button>
                </Modal.Actions>
            </Modal>
            {/* Delete Discussion Thread Modal */}
            <Modal
                open={showDelThreadModal}
                onClose={closeDelThreadModal}
            >
                <Modal.Header>Delete Thread</Modal.Header>
                <Modal.Content>
                    <p>Are you sure you want to delete the <strong>{activeThreadTitle}</strong> thread?</p>
                    <p><strong>This will delete all messages within the thread. This action is irreversible.</strong></p>
                </Modal.Content>
                <Modal.Actions>
                    <Button
                        onClick={closeDelThreadModal}
                    >
                        Cancel
                    </Button>
                    <Button
                        color='red'
                        loading={delThreadLoading}
                        onClick={submitDeleteThread}
                    >
                        <Icon name='trash' />
                        Delete Thread
                    </Button>
                </Modal.Actions>
            </Modal>
        </div>
    )
};

export default memo(ConductorMessagingUI);

/**
<div className='left-flex' id='project-messages-reply-inputcontainer'>
    <MentionsInput
        placeholder='Send a message...'
        onChange={(e, n, t) => {
            console.log(e);
            setMessageCompose(n);
            console.log(t);
        }}
        value={messageCompose}
        className='project-messages-reply-input'
    >
        <Mention
            trigger="@"
            data={[{id: '1', display: 'Ethan'}, {id:'2', display: 'Delmar'}]}
        />
    </MentionsInput>
</div>
<div className='right-flex' id='project-messages-reply-sendcontainer'>
    <Button
        color='blue'
        disabled={(activeThread === '') || (messageCompose === '')}
        onClick={sendMessage}
        loading={messageSending}
        id='project-messages-reply-send'
        fluid
    >
        <Icon name='send' />
        Send
    </Button>
</div>
**/
