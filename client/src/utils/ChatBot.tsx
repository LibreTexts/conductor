import React, { useState, useEffect } from "react";
import "./ChatBot.css";
import api from "../api";
import ReactMarkdown from "react-markdown";

interface AgentSource {
  number: number;
  title: string;
  url: string;
  source: 'kb' | 'web';
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  sources?: AgentSource[];
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  // Create a new session when component mounts
  useEffect(() => {
    if (isOpen && !sessionId && !creatingSession) {
      createNewSession();
    }
  }, [isOpen]);

  const createNewSession = async () => {
    setCreatingSession(true);
    try {
      const response = await api.createAgentSession();
      if (!response.err && response.sessionId) {
        setSessionId(response.sessionId);
      } else {
        throw new Error("Failed to create session");
      }
    } catch (error) {
      console.error("❌ Failed to create session:", error);
    }
    setCreatingSession(false);
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !sessionId || loading) return;

    const userMessage: Message = { 
      role: "user", 
      content: input 
    };
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    setInput("");
    setLoading(true);

    try {
      const response = await api.queryLangGraphAgent(currentInput, sessionId);

      if (!response.err) {
        const botMessage: Message = { 
          role: "agent", 
          content: response.response,
          sources: response.sources
        };
        setMessages((prev) => [...prev, botMessage]);
      } else {
        throw new Error("Error fetching chatbot response");
      }
    } catch (error) {
      console.error("❌ Error sending message:", error);
      const errorMessage: Message = { 
        role: "agent", 
        content: "Sorry, something went wrong. Please try again." 
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    createNewSession();
  };

  return (
    <div className="chatbot-container">
      {!isOpen && (
        <button className="chatbot-toggle" onClick={toggleChat}>
          <span className="chatbot-toggle-text">Ask Benny</span>
        </button>
      )}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="header-content">
              <div className="header-title-with-mascot">
                <img 
                  src="https://cdn.libretexts.net/Images/benny-mascot-white.png" 
                  alt="Benny" 
                  className="header-mascot-icon"
                />
                <h4>Ask Benny</h4>
              </div>
            </div>
            <div className="header-actions">
              <button 
                className="new-session-btn" 
                onClick={handleNewSession}
                title="Start new session"
                disabled={creatingSession}
              >
                🔄
              </button>
              <button className="close-btn" onClick={toggleChat}>✕</button>
            </div>
          </div>

          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <p>👋 Hi! I'm Benny, your AI assistant.</p>
                <p>I can search the LibreTexts Knowledge Base and the web to help you!</p>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`chatbot-message ${msg.role}`}>
                <div className="message-text">
                  <strong className="message-label">
                    {msg.role === "user" ? "You" : "Benny"}:
                  </strong>
                  {msg.role === "agent" ? (
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p style={{margin: '0.5em 0'}} {...props} />,
                        ul: ({node, ...props}) => <ul style={{margin: '0.5em 0', paddingLeft: '1.5em'}} {...props} />,
                        ol: ({node, ...props}) => <ol style={{margin: '0.5em 0', paddingLeft: '1.5em'}} {...props} />,
                        li: ({node, ...props}) => <li style={{margin: '0.25em 0', lineHeight: '1.6'}} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{margin: '1em 0 0.5em 0', fontSize: '1.2em', fontWeight: 600}} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{margin: '0.75em 0 0.5em 0', fontSize: '1.1em', fontWeight: 600}} {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    <div className="message-body">{msg.content}</div>
                  )}
                </div>

                {/* Show sources if available */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="message-sources">
                    <div className="sources-header">
                      📚 Sources ({msg.sources.length}):
                    </div>
                    <div className="sources-list">
                      {msg.sources.map((source) => (
                        <a
                          key={source.number}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`source-link ${source.source}`}
                          title={source.title}
                        >
                          {source.source === 'kb' ? '📖' : '🌐'} [{source.number}] {source.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chatbot-loading">
                <div className="loading-dots">
                  <span>.</span><span>.</span><span>.</span>
                </div>
                <span>Benny is thinking</span>
              </div>
            )}
          </div>

          <div className="chatbot-input">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={sessionId ? "Ask me anything..." : "Creating session..."}
              disabled={!sessionId || loading}
            />
            <button 
              onClick={handleSendMessage} 
              disabled={!sessionId || loading || !input.trim()}
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;