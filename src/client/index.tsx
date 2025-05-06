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

import { type ChatMessage, type Message } from "../shared";

// Komponen untuk Input Nama
function NameInput({ onNameSubmit }: { onNameSubmit: (name: string) => void }) {
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name.trim() === "") {
      alert("Please enter your name.");
      return;
    }
    onNameSubmit(name.trim());
  };

  return (
    <div className="name-input-container">
      <form onSubmit={handleSubmit} className="name-input-form">
        <h2>Enter Your Name</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your Name"
          aria-label="Your Name"
          autoFocus
        />
        <button type="submit">Start Chatting</button>
      </form>
    </div>
  );
}

// Komponen untuk Antarmuka Chat
function ChatInterface({ userName, room }: { userName: string; room: string | undefined }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const socket = usePartySocket({
    party: "Chat", // Pastikan ini cocok dengan class_name Durable Object Anda di wrangler.json
    room,
    onOpen: () => {
      console.log(`Connected to room: ${room} as ${userName}`);
    },
    onMessage: (evt) => {
      const message = JSON.parse(evt.data as string) as Message;
      if (message.type === "all") {
        setMessages(message.messages);
      } else if (message.type === "add") {
        // Cek apakah pesan sudah ada untuk menghindari duplikasi dari echo server
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
      } else if (message.type === "update") {
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
      user: userName,
      role: "user",
    };

    // Optimistic update
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
    <> {/* Parent Fragment */}
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${
              message.user === userName ? "user-message" : "other-message"
            }`}
          >
            <div className="message-sender">
              {message.user === userName ? "You" : message.user}
            </div>
            <div className="message-bubble">
              <p className="message-content">{message.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} /> {/* Element untuk auto-scroll */}
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="content"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Chatting as ${userName}...`}
          autoComplete="off"
          aria-label="Chat message input"
        />
        <button type="submit" disabled={inputValue.trim() === ""} aria-label="Send message">
          <i className="fas fa-paper-plane"></i> {/* Ikon Font Awesome */}
        </button>
      </form>
    </>
  );
}

// Komponen App Utama (mengatur logika input nama atau tampilkan chat)
function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    return localStorage.getItem("chatUserName"); // Coba ambil nama dari localStorage
  });
  const { room } = useParams(); // Ambil room ID dari URL

  const handleNameSubmit = (name: string) => {
    localStorage.setItem("chatUserName", name); // Simpan nama ke localStorage
    setCurrentUser(name);
  };

  if (!currentUser) {
    // Jika tidak ada nama, tampilkan form input nama
    return <NameInput onNameSubmit={handleNameSubmit} />;
  }

  // Jika nama sudah ada, tampilkan antarmuka chat
  return <ChatInterface userName={currentUser} room={room} />;
}

// Logika Rendering Utama
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={`/${nanoid()}`} />} /> {/* Redirect ke room acak jika akses root */}
          <Route path="/:room" element={<App />} /> {/* Rute untuk room spesifik */}
          <Route path="*" element={<Navigate to="/" />} /> {/* Fallback redirect */}
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  console.error("Failed to find the root element to mount the React app.");
}
