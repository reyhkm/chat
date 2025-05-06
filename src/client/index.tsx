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
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  console.log(`ChatInterface rendering for user: ${userName}, room: ${room}. Messages count: ${messages.length}`);

  const scrollToBottom = () => {
    // Sedikit penundaan mungkin membantu jika render belum selesai
    setTimeout(() => {
       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
      // Coba scroll saat pesan berubah atau saat baru terhubung
      if(messages.length > 0 || isConnected) {
          scrollToBottom();
      }
  }, [messages, isConnected]); // Tambahkan isConnected sebagai dependency

  const socket = usePartySocket({
    party: "Chat", // Sesuaikan dengan nama Class Durable Object Anda di wrangler.json
    room,
    onOpen: () => {
      console.log(`[WebSocket] Connected to room: ${room} as ${userName}`);
      setIsConnected(true);
    },
    onMessage: (evt) => {
      try {
        const message = JSON.parse(evt.data as string) as Message;
        console.log("[WebSocket] Received message:", message);

        if (message.type === "all") {
          console.log(`[WebSocket] Received 'all' messages (${message.messages.length}). Current state has ${messages.length}.`);
          setMessages(message.messages);
          console.log("[State] Messages updated with history.");
        } else if (message.type === "add") {
          setMessages((prevMessages) => {
            if (!prevMessages.find(m => m.id === message.id)) {
               console.log("[State] Adding new message:", message.id);
              return [
                ...prevMessages,
                {
                  id: message.id,
                  content: message.content,
                  user: message.user,
                  role: message.role,
                },
              ];
            } else {
              console.log("[State] Message already exists (likely echo), skipping:", message.id);
              return prevMessages;
            }
          });
        } else if (message.type === "update") {
           console.log("[State] Updating message:", message.id);
          setMessages((prevMessages) =>
            prevMessages.map((m) =>
              m.id === message.id
                ? { ...m, content: message.content, user: message.user, role: message.role }
                : m
            )
          );
        }
      } catch (error) {
        console.error("[WebSocket] Failed to parse message or update state:", error);
        console.error("[WebSocket] Raw message data:", evt.data);
      }
    },
    onClose: (event) => {
      console.log(`[WebSocket] Disconnected from room: ${room}. Code: ${event.code}, Reason: ${event.reason}`);
      setIsConnected(false);
    },
    onError: (err) => {
      console.error(`[WebSocket] Error in room ${room}:`, err);
      // onError tidak selalu berarti koneksi tertutup, tapi kita set false untuk aman
      setIsConnected(false);
    }
  });

  useEffect(() => {
    console.log("[Render] ChatInterface re-rendered. Current messages state length:", messages.length);
  }, [messages]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() === "" || !isConnected) return;

    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content: inputValue,
      user: userName,
      role: "user",
    };

    console.log("[Action] Sending message:", chatMessage.id);
    // Optimistic update: Tambahkan ke UI segera
    setMessages((prevMessages) => [...prevMessages, chatMessage]);
    console.log("[State] Optimistically added message:", chatMessage.id);

    socket.send(
      JSON.stringify({
        type: "add",
        ...chatMessage,
      } satisfies Message)
    );

    setInputValue("");
  };

  return (
    <>
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
              {/* Pastikan tag <p> tidak memiliki margin bawah default yang mengganggu */}
              <p className="message-content">{message.content}</p>
            </div>
          </div>
        ))}
        {/* Pesan status jika chat kosong atau tidak terhubung */}
         {messages.length === 0 && isConnected && (
             <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', paddingBottom: '10px' }}>No messages yet. Start chatting!</div>
        )}
         {!isConnected && (
             <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', paddingBottom: '10px' }}>Connecting...</div>
        )}
        {/* Anchor untuk scroll */}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="content"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isConnected ? `Chatting as ${userName}...` : 'Connecting...'}
          autoComplete="off"
          aria-label="Chat message input"
          disabled={!isConnected}
        />
        <button
          type="submit"
          disabled={inputValue.trim() === "" || !isConnected}
          aria-label="Send message"
         >
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </>
  );
}

// Komponen App Utama (mengatur logika input nama atau tampilkan chat)
function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    // Coba ambil nama dari localStorage saat komponen pertama kali mount
    const savedName = localStorage.getItem("chatUserName");
    console.log("[App Init] localStorage name:", savedName);
    return savedName;
  });
  const { room } = useParams();

  const handleNameSubmit = (name: string) => {
    console.log("[App Action] Name submitted:", name);
    localStorage.setItem("chatUserName", name);
    setCurrentUser(name);
  };

  // Render berdasarkan apakah currentUser sudah ada
  if (!currentUser) {
    console.log("[App Render] Rendering NameInput");
    return <NameInput onNameSubmit={handleNameSubmit} />;
  } else {
    console.log(`[App Render] Rendering ChatInterface for user: ${currentUser}, room: ${room}`);
    // Menggunakan key di sini bisa membantu me-reset state jika diperlukan, tapi mungkin tidak perlu untuk masalah refresh.
    // return <ChatInterface key={`${room}-${currentUser}`} userName={currentUser} room={room} />;
    return <ChatInterface userName={currentUser} room={room} />;
  }
}

// Logika Rendering Utama
const container = document.getElementById("root");
if (container) {
  console.log("[Main] Mounting React App");
  createRoot(container).render(
    // StrictMode dapat menyebabkan beberapa efek dijalankan dua kali dalam development,
    // perhatikan log jika ada perilaku ganda yang tidak diharapkan.
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
  console.error("[Main] Failed to find the root element to mount the React app.");
}
