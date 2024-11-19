import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Comment,
  CommentGroup,
  Dropdown,
  Header,
  Icon,
  Loader,
} from "semantic-ui-react";
import useProjectDiscussions from "../../../../hooks/projects/useProjectDiscussions";
import useProjectDiscussionThread from "../../../../hooks/projects/useProjectDiscussionThread";
import DOMPurify from "dompurify";
import { useModals } from "../../../../context/ModalContext";
import DeleteThreadModal from "./DeleteThreadModal";
import NewThreadModal from "./NewThreadModal";
import { truncateString } from "../../../util/HelperFunctions";
import { marked } from "marked";
import DeleteMessageModal from "./DeleteMessageModal";
import { format } from "date-fns";
import { useTypedSelector } from "../../../../state/hooks";
import useProjectTeam from "../../../../hooks/projects/useProjectTeam";
import TextArea from "../../../TextArea";
import { CHAT_NOTIFY_OPTS } from "../../../../utils/constants";
import NotifyPickerModal from "./NotifyPickerModal";

interface ProjectDiscussionPaneProps {
  id: string;
}

const ProjectDiscussionPane: React.FC<ProjectDiscussionPaneProps> = ({
  id,
}) => {
  const chatWindowBottom = useRef<HTMLDivElement>(null);
  const [activeThread, setActiveThread] = useState<string>("");

  const user = useTypedSelector((state) => state.user);
  const { openModal, closeAllModals } = useModals();
  const { isProjectAdmin } = useProjectTeam({ id, user });
  const { threads, loading } = useProjectDiscussions({ id });
  const {
    messages,
    loading: messagesLoading,
    createMessage,
  } = useProjectDiscussionThread({
    id: activeThread,
  });

  // New message data
  const [messageCompose, setMessageCompose] = useState<string>("");
  const [notifySetting, setNotifySetting] = useState<string>("none");
  const [teamToNotify, setTeamToNotify] = useState<string[]>([]);

  const activeThreadTitle = useMemo(() => {
    if (threads && activeThread !== "") {
      const thread = threads.find((t) => t.threadID === activeThread);
      return thread ? thread.title : "";
    }
    return "";
  }, [threads, activeThread]);

  /** INITIALIZATION **/
  useEffect(() => {
    // Hook to force message links to open in new window
    DOMPurify.addHook("afterSanitizeAttributes", function (node) {
      if ("target" in node) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }, []);

  const openNewThreadModal = () => {
    openModal(<NewThreadModal projectID={id} onClose={closeAllModals} />);
  };

  const openDelThreadModal = () => {
    if (!activeThread) return;
    openModal(
      <DeleteThreadModal
        projectID={id}
        threadID={activeThread}
        onClose={closeAllModals}
      />
    );
  };

  const openDelMessageModal = (messageID: string) => {
    if (!activeThread || !messageID) return;
    openModal(
      <DeleteMessageModal
        threadID={activeThread}
        messageID={messageID}
        onClose={closeAllModals}
      />
    );
  };

  const openNotifyPickerModal = () => {
    openModal(
      <NotifyPickerModal
        projectID={id}
        onClose={closeAllModals}
        onSetNotify={setTeamToNotify}
      />
    );
  };

  const handleNotifySettingChange = (newSetting: string) => {
    setNotifySetting(newSetting);
    setTeamToNotify([]); // Reset team to notify when setting changes
  };

  const notifySettingDropdownText = useMemo(() => {
    if (notifySetting === "specific") {
      const modifier = teamToNotify.length > 1 ? "people" : "person";
      return `Notify ${teamToNotify.length} ${modifier}`;
    }
    const foundOption = CHAT_NOTIFY_OPTS(false, () => {}).find(
      (item) => item.value === notifySetting
    );
    return foundOption?.text;
  }, [notifySetting, CHAT_NOTIFY_OPTS, teamToNotify]);

  return (
    <div className="flex w-full min-h-96 max-h-[45%]">
      <div className="flex basis-1/4 shrink-0 flex-col h-fit overflow-y-auto border-r border-r-slate-200">
        <div
          className="flex-row-div"
          id="conductor-messaging-threads-header-container"
        >
          <div className="left-flex">
            <Header as="h3">Threads</Header>
          </div>
          <div className="right-flex">
            <Button
              icon
              color="red"
              onClick={openDelThreadModal}
              disabled={activeThread === ""}
              className="mr-2p"
              fluid
              aria-label="Delete Thread"
            >
              <Icon name="trash" />
            </Button>
            <Button
              color="green"
              onClick={openNewThreadModal}
              fluid
              icon
              aria-label="Add Thread"
            >
              <Icon name="add" />
            </Button>
          </div>
        </div>
        <div className="flex flex-col flex-grow overflow-y-auto max-h-full">
          {threads &&
            threads.length > 0 &&
            threads.map((item, idx) => {
              let lastMessage = "*No messages yet*";
              if (item.lastMessage && item.lastMessage.body) {
                lastMessage = `${item.lastMessage.author?.firstName} ${
                  item.lastMessage.author?.lastName
                }: ${truncateString(item.lastMessage.body, 50)}`;
              }
              const readyLastMsg = {
                __html: DOMPurify.sanitize(marked.parseInline(lastMessage)),
              };
              return (
                <div
                  className={
                    activeThread === item.threadID
                      ? "conductor-messaging-threads-list-item active"
                      : "conductor-messaging-threads-list-item"
                  }
                  key={item.threadID}
                  onClick={() => setActiveThread(item.threadID)}
                >
                  <p
                    className={
                      activeThread === item.threadID
                        ? "conductor-messaging-threads-list-title active"
                        : "conductor-messaging-threads-list-title"
                    }
                  >
                    {item.title}
                  </p>
                  <p
                    className="conductor-messaging-threads-list-descrip prose prose-code:before:hidden prose-code:after:hidden"
                    dangerouslySetInnerHTML={readyLastMsg}
                  ></p>
                </div>
              );
            })}
          {threads && threads.length === 0 && (
            <p className="text-center muted-text mt-4r pa-2p">
              <em>No threads yet. Create one above!</em>
            </p>
          )}
          {(!threads || loading) && (
            <Loader active inline="centered" className="mt-4r" />
          )}
        </div>
      </div>
      <div id="conductor-chat">
        <div id="conductor-chat-msgs-header-container">
          <div className="left-flex">
            <Header as="h3">
              {activeThreadTitle !== "" ? (
                <em>{activeThreadTitle}</em>
              ) : (
                <span>Messages</span>
              )}
            </Header>
          </div>
          <div
            className="right-flex"
            id="conductor-chat-msgs-header-options"
          ></div>
        </div>
        <div id="conductor-chat-window">
          {messages && messages.length > 0 && (
            <CommentGroup id="conductor-chat-msgs">
              {messages.map((item) => {
                const today = new Date();
                const itemDate = new Date(item.createdAt);
                const formattedDate = `${format(
                  itemDate,
                  "MMM do, yyyy"
                )} at ${format(itemDate, "h:mm a")}`;
                const readyMsgBody = {
                  __html: DOMPurify.sanitize(
                    marked(item.body, { breaks: true })
                  ),
                };
                return (
                  <Comment className="conductor-chat-msg" key={item.messageID}>
                    <Comment.Avatar
                      src={item.author?.avatar || "/mini_logo.png"}
                    />
                    <Comment.Content>
                      <Comment.Author as="span">
                        {item.author?.firstName} {item.author?.lastName}
                      </Comment.Author>
                      <Comment.Metadata>
                        <div>
                          <span>
                            {today.getDate() === itemDate.getDate()
                              ? "Today"
                              : formattedDate}
                          </span>
                        </div>
                      </Comment.Metadata>
                      <Comment.Text
                        className="conductor-chat-msg-body !prose prose-code:before:hidden prose-code:after:hidden !max-w-none"
                        dangerouslySetInnerHTML={readyMsgBody}
                      />
                      {(item.author?.uuid === user.uuid || isProjectAdmin) && (
                        <Comment.Actions>
                          <Comment.Action
                            className="conductor-chat-del"
                            onClick={() => openDelMessageModal(item.messageID)}
                          >
                            Delete
                          </Comment.Action>
                        </Comment.Actions>
                      )}
                    </Comment.Content>
                  </Comment>
                );
              })}
            </CommentGroup>
          )}
          {messages && messages.length === 0 && (
            <p className="text-center muted-text mt-4r">
              <em>No messages yet. Send one below!</em>
            </p>
          )}
          {messagesLoading && activeThread && (
            <Loader active inline="centered" className="mt-4r" />
          )}
          {activeThread === "" && messages && messages.length === 0 && (
            <p className="text-center muted-text mt-4r">
              <em>
                No thread selected. Select one from the list on the left or
                create one using the + button!
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
              contentType="message"
              rows={1}
            />
          </div>
          <div id="replycontainer-right">
            <Button
              id="replycontainer-sendbutton"
              color="blue"
              fluid
              disabled={!activeThread || !messageCompose}
              loading={createMessage.isLoading}
              onClick={async () => {
                await createMessage.mutateAsync({
                  message: messageCompose,
                  notify: notifySetting,
                  notifyUsers: teamToNotify,
                });
                setMessageCompose("");
              }}
            >
              <Icon name="send" />
              Send
            </Button>
            <Dropdown
              id="replycontainer-notifydropdown"
              options={CHAT_NOTIFY_OPTS(false, openNotifyPickerModal)}
              selection
              value={notifySetting}
              onChange={(e, { value }) =>
                handleNotifySettingChange(value as string)
              }
              text={notifySettingDropdownText}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDiscussionPane;
