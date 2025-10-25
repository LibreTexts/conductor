import React, { useState } from "react";
import "./ChatBot.css"; // Add styles for the chatbot
import api from "../api";

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to the chat
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input field
    setInput("");

    // Call the backend API to get the chatbot response
    try {
      console.log("Chatbot user message:", userMessage);
      const response = await api.sendChatbotQuery(userMessage.content, "session_1761167818745_bb41dcvrd");

      const data = await response;
      console.log("Chatbot response data:", data);
      if (data.err) {
        throw new Error(data.msg || "Error fetching chatbot response");
      }

      // Add chatbot response to the chat
      const botMessage = { role: "agent", content: data.response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage = { role: "agent", content: "Sorry, something went wrong. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="chatbot-container">
    <button className="chatbot-toggle" onClick={toggleChat}>
      {isOpen ? "Close Chat" : "Chat with Us"}
    </button>

    {isOpen && (
      <div className="chatbot-window">
        <div className="chatbot-header">
          <h4>Chatbot</h4>
          <button onClick={toggleChat}>X</button>
        </div>
        <div className="chatbot-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`chatbot-message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
        </div>
        <div className="chatbot-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
          />
          <button onClick={handleSendMessage}>Send</button>
        </div>
      </div>
    )}
  </div>
  );
};

export default ChatBot;