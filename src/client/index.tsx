import React, { useState, useEffect, useRef, useCallback } from "react";
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

// Kembalikan import names dan gunakan lagi
import { names, type ChatMessage, type Message } from "../shared";

// Komponen App Utama
function App() {
  const { room } = useParams(); // Ambil room ID dari URL
  // Gunakan nama acak lagi
  const [name] = useState(names[Math.floor(Math.random() * names.length)]);

  // State untuk messages, input, dan status koneksi
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  console.log(`App rendering for user: ${name}, room: ${room}. Messages count: ${messages.length}`);

  // Fungsi scroll ke bawah
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
      if(messages.length > 0 || isConnected) {
          scrollToBottom();
      }
  }, [messages, isConnected, scrollToBottom]);

  // --- usePartySocket langsung di sini ---
  const socket = usePartySocket({
    party: "Chat", // Pastikan ini cocok dengan class_name Durable Object
    room, // Gunakan room dari URL
    onOpen: () => {
      console.log(`[WebSocket] Connected to room: ${room} as ${name}`);
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
          // Cek duplikasi dari echo server
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
      // Log error ini PENTING jika masalah koneksi kembali
      console.error(`[WebSocket] Error in room ${room}:`, err);
      setIsConnected(false);
    }
  });
  // --- Akhir usePartySocket ---

  useEffect(() => {
    console.log("[Render] App re-rendered. Current messages state length:", messages.length);
  }, [messages]);

  // Fungsi submit form
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() === "" || !isConnected) return;

    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content: inputValue,
      user: name, // Gunakan nama acak yang digenerate
      role: "user",
    };

    console.log("[Action] Sending message:", chatMessage.id);
    // Optimistic update
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

  // Render UI Chat
  return (
    <>
      <div className="chat-messages">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-item ${
              message.user === name ? "user-message" : "other-message" // Bandingkan dengan nama acak
            }`}
          >
            <div className="message-sender">
              {message.user === name ? "You" : message.user}
            </div>
            <div className="message-bubble">
              <p className="message-content">{message.content}</p>
            </div>
          </div>
        ))}
         {messages.length === 0 && isConnected && (
             <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', paddingBottom: '10px' }}>No messages yet. Start chatting!</div>
        )}
         {!isConnected && (
             <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', paddingBottom: '10px' }}>Connecting...</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="content"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={isConnected ? `Chatting as ${name}...` : 'Connecting...'}
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

// Logika Rendering Utama (Tetap Sama)
const container = document.getElementById("root");
if (container) {
  console.log("[Main] Mounting React App");
  createRoot(container).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          {/* Rute root akan redirect ke room acak */}
          <Route path="/" element={<Navigate to={`/${nanoid()}`} />} />
          {/* Rute ini akan menangkap room ID dan merender App */}
          <Route path="/:room" element={<App />} />
          {/* Fallback jika rute tidak cocok */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  console.error("[Main] Failed to find the root element to mount the React app.");
}
