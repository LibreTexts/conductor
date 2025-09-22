import { useState, useEffect, useRef } from "react";

type EventFeedProps = {
  messages: string[]; // Array of message strings
  autoScroll?: boolean; // Whether to auto-scroll to the bottom on new messages
  showTimestamp?: boolean; // Whether to show timestamps next to messages
  className?: string; // Additional CSS classes for the container
  connected?: boolean; // Connection status indicator
};

type EventFeedMessage = {
  id: number;
  text: string;
  timestamp: Date;
};

const EventFeed: React.FC<EventFeedProps> = ({
  messages = [],
  autoScroll = true,
  showTimestamp = true,
  className = "",
  connected = false,
}) => {
  const [displayedMessages, setDisplayedMessages] = useState<
    EventFeedMessage[]
  >([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > displayedMessages.length) {
      const newMessage = messages[displayedMessages.length];
      const messageId = displayedMessages.length;

      setDisplayedMessages((prev) => [
        ...prev,
        {
          id: messageId,
          text: newMessage,
          timestamp: new Date(),
        },
      ]);
    }
  }, [messages, displayedMessages.length]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayedMessages, autoScroll]);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Remove surrounding quotes from messages if present
  const formatMessage = (text: string) => {
    let formatted = text;
    if (text.startsWith('"')) {
      formatted = text.slice(1);
    }
    if (text.endsWith('"')) {
      formatted = formatted.slice(0, -1);
    }

    return formatted;
  };

  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-lg overflow-hidden ${className}`}
    >
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900">Event Feed</h3>
          <span className="text-xs text-gray-500">
            {displayedMessages.length} events
          </span>
        </div>
      </div>

      {/* Feed Content */}
      <div ref={containerRef} className="min-h-24 max-h-96 overflow-y-auto bg-gray-50">
        <div className="divide-y divide-gray-100">
          {displayedMessages.map((message) => (
            <div
              key={message.id}
              className="px-4 py-3 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 font-mono leading-relaxed break-words">
                    {formatMessage(message.text)}
                  </p>
                </div>
                {showTimestamp && (
                  <div className="flex-shrink-0">
                    <span className="text-xs text-gray-500 font-mono">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {displayedMessages.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No events yet...</p>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">Live feed</span>
          <div className="flex items-center space-x-1">
            <div
              className={`w-2 h-2 ${
                connected ? "bg-green-500" : "bg-yellow-600"
              } rounded-full animate-pulse`}
            ></div>
            <span className="text-xs text-gray-500">
              {connected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventFeed;
