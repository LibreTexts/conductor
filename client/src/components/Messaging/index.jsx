import React, { useEffect, useState, useCallback, memo } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import date from 'date-and-time';
import ordinal from 'date-and-time/plugin/ordinal';
import day_of_week from 'date-and-time/plugin/day-of-week';
import { Button, Heading, IconButton, Input, Modal, Text } from '@libretexts/davis-react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import Chat from '../Chat';
import SkeletonBone from '../SkeletonBone';
import {
    isEmptyString,
    truncateString
} from '../util/HelperFunctions.js';
import useGlobalError from '../error/ErrorHooks';
import './Messaging.css';

/**
 * A reusable messaging (threads and chat window) interface.
 */
const Messaging = ({ projectID, user, kind, isProjectAdmin, defaultNotificationSetting, className }) => {

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
    const [threads, setThreads] = useState([]);
    const [loadedThreads, setLoadedThreads] = useState(false);
    const [activeThread, setActiveThread] = useState('');
    const [activeThreadTitle, setActiveThreadTitle] = useState('');
    const [activeThreadMsgs, setActiveThreadMsgs] = useState([]);
    const [loadedThreadMsgs, setLoadedThreadMsgs] = useState(false);

    const getDiscussionThreads = useCallback(() => {
        setLoadedThreads(false);
        axios.get('/project/threads', {
            params: {
                projectID: projectID,
                kind: kind
            }
        }).then((res) => {
            if (!res.data.err) {
                if (res.data.threads && Array.isArray(res.data.threads)) {
                    setThreads(res.data.threads);
                }
            } else {
                handleGlobalError(res.data.errMsg);
            }
            setLoadedThreads(true);
        }).catch((err) => {
            handleGlobalError(err);
            setLoadedThreads(true);
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

    // Open the first thread whenever none is selected (initial load, after a delete),
    // so the composer always has a target.
    useEffect(() => {
        if (!loadedThreads || threads.length === 0) return;
        if (!threads.some((t) => t.threadID === activeThread)) {
            activateThread(threads[0]);
        }
    }, [loadedThreads, threads, activeThread]);


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
        <div id='conductor-messaging-container' className={className}>
            <div id='conductor-messaging-threads'>
                <div id='conductor-messaging-threads-header-container'>
                    <Heading as='h3' level={6} className='m-0!'>Threads</Heading>
                    <div className='flex items-center gap-1'>
                        <IconButton
                            icon={<IconTrash size={16} />}
                            variant="ghost"
                            size="sm"
                            className='text-danger-600! hover:bg-danger-50!'
                            onClick={openDelThreadModal}
                            disabled={activeThread === ''}
                            aria-label='Delete Thread'
                        />
                        <IconButton
                            icon={<IconPlus size={16} />}
                            variant="outline"
                            size="sm"
                            onClick={openNewThreadModal}
                            aria-label='Add Thread'
                        />
                    </div>
                </div>
                <div id='conductor-messaging-threads-list-container' aria-busy={!loadedThreads || undefined}>
                    {(loadedThreads && threads.length > 0) &&
                        <ul className='m-0 list-none p-0'>
                            {threads.map((item) => {
                                let lastMessage = '*No messages yet*';
                                if (item.lastMessage && item.lastMessage.body) {
                                    lastMessage = `${item.lastMessage.author?.firstName} ${item.lastMessage.author?.lastName}: ${truncateString(item.lastMessage.body, 50)}`;
                                }
                                // Links would nest an interactive element inside the thread button.
                                const readyLastMsg = {
                                    __html: DOMPurify.sanitize(marked.parseInline(lastMessage), { FORBID_TAGS: ['a'] })
                                };
                                const isActive = activeThread === item.threadID;
                                return (
                                    <li key={item.threadID}>
                                        <button
                                            type='button'
                                            className={isActive
                                                ? 'conductor-messaging-threads-list-item active'
                                                : 'conductor-messaging-threads-list-item'}
                                            aria-current={isActive || undefined}
                                            onClick={() => activateThread(item)}
                                        >
                                            <span className='conductor-messaging-threads-list-title'>
                                                {item.title}
                                            </span>
                                            <span className='conductor-messaging-threads-list-descrip' dangerouslySetInnerHTML={readyLastMsg}>
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    }
                    {(loadedThreads && threads.length === 0) &&
                        <Text as='p' size='sm' color='muted' align='center' className='m-0 px-4 py-6'>No threads yet. Create one above!</Text>
                    }
                    {(!loadedThreads) &&
                        <>
                            <p role='status' className='sr-only'>Loading threads…</p>
                            <div aria-hidden='true' className='flex flex-col gap-5 px-4 py-3'>
                                {['w-40', 'w-28', 'w-36'].map((w) => (
                                    <div key={w} className='flex flex-col gap-2'>
                                        <SkeletonBone className={`h-3 ${w}`} />
                                        <SkeletonBone className='h-2.5 w-full' />
                                    </div>
                                ))}
                            </div>
                        </>
                    }
                </div>
            </div>
            <Chat
                projectID={projectID}
                user={user}
                kind={kind}
                activeThread={activeThread}
                activeThreadTitle={activeThreadTitle}
                activeThreadMsgs={activeThreadMsgs}
                loadedThreadMsgs={loadedThreadMsgs}
                getThreads={getDiscussionThreads}
                getMessages={getThreadMessages}
                isProjectAdmin={isProjectAdmin}
                defaultNotificationSetting={defaultNotificationSetting}
            />
            {/* New Discussion Thread Modal */}
            <Modal open={showNewThreadModal} onClose={closeNewThreadModal}>
                <Modal.Header>
                    <Modal.Title>Create a Thread</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Input
                        name="thread-title"
                        label="Thread Title"
                        type='text'
                        placeholder='Enter thread title or topic...'
                        onChange={(e) => setNewThreadTitle(e.target.value)}
                        value={newThreadTitle}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={closeNewThreadModal}>Cancel</Button>
                        <Button
                            variant="primary"
                            loading={newThreadLoading}
                            onClick={submitNewThread}
                            icon={<IconPlus size={15} />}
                        >
                            Create Thread
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
            {/* Delete Discussion Thread Modal */}
            <Modal open={showDelThreadModal} onClose={closeDelThreadModal}>
                <Modal.Header>
                    <Modal.Title>Delete Thread</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Are you sure you want to delete the <strong>{activeThreadTitle}</strong> thread?</p>
                    <p><strong>This will delete all messages within the thread. This action is irreversible.</strong></p>
                </Modal.Body>
                <Modal.Footer>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={closeDelThreadModal}>Cancel</Button>
                        <Button
                            variant="destructive"
                            loading={delThreadLoading}
                            onClick={submitDeleteThread}
                            icon={<IconTrash size={15} />}
                        >
                            Delete Thread
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </div>
    )
};

Messaging.propTypes = {
    projectID: PropTypes.string.isRequired,
    user: PropTypes.object.isRequired,
    kind: PropTypes.string.isRequired,
    isProjectAdmin: PropTypes.bool,
    defaultNotificationSetting: PropTypes.string,
    className: PropTypes.string
};

Messaging.defaultProps = {
    projectID: '',
    user: {},
    kind: 'project',
    isProjectAdmin: false,
};

export default memo(Messaging);

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
