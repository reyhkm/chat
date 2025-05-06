import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { usePartySocket } from "partysocket/react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router";
import { nanoid } from "nanoid";

import { names, type ChatMessage, type Message } from "../shared";

function App() {
  const [currentUser] = useState(names[Math.floor(Math.random() * names.length)]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const { room } = useParams();
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const socket = usePartySocket({
    party: "chat", // Make sure this matches your party server name in wrangler.toml
    room, // This is your room ID from the URL
    onOpen: () => {
      console.log(`Connected to room: ${room} as ${currentUser}`);
    },
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "all") {
        setMessages(message.messages);
      } else if (message.type === "add") {
        // Check if message already exists (e.g., if it's our own message echoed back)
        if (!messages.find(m => m.id === message.id)) {
          setMessages((prevMessages) => [
            ...prevMessages,
            {
              id: message.id,
              content: message.content,
              user: message.user,
              role: message.role,
            },
          ]);
        }
      } else if (message.type === "update") { // Example for update, if you implement it
        setMessages((prevMessages) =>
          prevMessages.map((m) =>
            m.id === message.id
              ? { ...m, content: message.content, user: message.user, role: message.role }
              : m
          )
        );
      }
    },
    onClose: () => {
      console.log(`Disconnected from room: ${room}`);
    },
    onError: (err) => {
      console.error(`Error in room ${room}:`, err);
    }
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() === "") return;

    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content: inputValue,
      user: currentUser,
      role: "user",
    };

    // Optimistically add message to UI
    setMessages((prevMessages) => [...prevMessages, chatMessage]);
    
    socket.send(
      JSON.stringify({
        type: "add",
        ...chatMessage,
      } satisfies Message)
    );

    setInputValue("");
  };

  return (
    <> {/* Replaced parent div with React Fragment as .chat-main is already the container */}
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${
              message.user === currentUser ? "user-message" : "other-message"
            }`}
          >
            <div className="message-sender">
              {message.user === currentUser ? "You" : message.user}
            </div>
            <div className="message-bubble">
              <p className="message-content">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* For auto-scrolling */}
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="content"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Chatting as ${currentUser}...`}
          autoComplete="off"
          aria-label="Chat message input"
        />
        <button type="submit" disabled={inputValue.trim() === ""}>
          Send
        </button>
      </form>
    </>
  );
}

// Main rendering logic
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
          <Route path="/:room" element={<App />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element");
}
