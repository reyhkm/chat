import React, { useState, useEffect, useRef, useCallback } from "react"; // Import useCallback
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

// Komponen untuk Input Nama (Tetap Sama)
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

// Komponen untuk Antarmuka Chat (Sekarang Menerima Socket dan Mengirim Pesan)
function ChatInterface({
  userName,
  room,
  initialMessages, // Terima initial messages
  isConnected,
  sendMessage, // Terima fungsi untuk mengirim pesan
  lastMessage // Terima pesan terakhir untuk memicu update
}: {
  userName: string;
  room: string | undefined;
  initialMessages: ChatMessage[];
  isConnected: boolean;
  sendMessage: (msg: Message) => void;
  lastMessage: Message | null; // Untuk memicu update state messages
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  console.log(`ChatInterface rendering for user: ${userName}, room: ${room}. Initial messages count: ${initialMessages.length}`);

  // Update state messages ketika ada pesan baru dari App component
  useEffect(() => {
    if (lastMessage) {
       console.log("[ChatInterface] Received new message prop:", lastMessage);
       if (lastMessage.type === "all") {
           setMessages(lastMessage.messages);
           console.log("[ChatInterface] State updated with 'all' messages.");
       } else if (lastMessage.type === "add") {
           setMessages((prevMessages) => {
               if (!prevMessages.find(m => m.id === lastMessage.id)) {
                   console.log("[ChatInterface] Adding new message:", lastMessage.id);
                   return [...prevMessages, lastMessage];
               }
               console.log("[ChatInterface] Message already exists, skipping:", lastMessage.id);
               return prevMessages;
           });
       } else if (lastMessage.type === "update") {
           console.log("[ChatInterface] Updating message:", lastMessage.id);
           setMessages((prevMessages) =>
                prevMessages.map((m) =>
                    m.id === lastMessage.id
                    ? { ...lastMessage } // Gunakan data dari pesan terakhir
                    : m
                )
           );
       }
    }
  }, [lastMessage]); // Hanya re-run ketika lastMessage berubah

  const scrollToBottom = useCallback(() => { // Gunakan useCallback
    setTimeout(() => {
       messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []); // Tidak ada dependensi, fungsi tetap sama

  useEffect(() => {
      if(messages.length > 0 || isConnected) {
          scrollToBottom();
      }
  }, [messages, isConnected, scrollToBottom]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (inputValue.trim() === "" || !isConnected) return;

    const chatMessage: ChatMessage = {
      id: nanoid(8),
      content: inputValue,
      user: userName,
      role: "user",
    };

    console.log("[Action] Sending message via prop:", chatMessage.id);
    // Optimistic update (tetap di sini)
    setMessages((prevMessages) => [...prevMessages, chatMessage]);
    console.log("[State] Optimistically added message:", chatMessage.id);

    // Kirim pesan menggunakan fungsi dari App component
    sendMessage({
      type: "add",
      ...chatMessage,
    });

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

// Komponen App Utama (Manajemen State & Socket)
function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    const savedName = localStorage.getItem("chatUserName");
    console.log("[App Init] localStorage name:", savedName);
    return savedName;
  });
  const { room } = useParams();

  // State untuk messages dan status koneksi di level App
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [lastReceivedMessage, setLastReceivedMessage] = useState<Message | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // --- Pindahkan usePartySocket ke sini ---
  const socket = usePartySocket({
    // Hanya konek jika currentUser sudah ada DAN room ada
    connect: !!currentUser && !!room,
    party: "Chat", // Sesuaikan dengan nama Class Durable Object Anda
    room,
    onOpen: () => {
      console.log(`[App WebSocket] Connected to room: ${room} as ${currentUser}`);
      setIsConnected(true);
    },
    onMessage: (evt) => {
      try {
        const message = JSON.parse(evt.data as string) as Message;
        console.log("[App WebSocket] Received message:", message);
        // Simpan pesan terakhir untuk diteruskan ke ChatInterface
        setLastReceivedMessage(message);
        // Juga update state allMessages di sini untuk persistensi state
        if (message.type === "all") {
            setAllMessages(message.messages);
        } else if (message.type === "add") {
            setAllMessages((prev) => {
                if (!prev.find(m => m.id === message.id)) {
                    return [...prev, message];
                }
                return prev;
            });
        } else if (message.type === "update") {
             setAllMessages((prev) =>
                prev.map((m) => (m.id === message.id ? { ...message } : m))
             );
        }

      } catch (error) {
        console.error("[App WebSocket] Failed to parse message:", error);
        console.error("[App WebSocket] Raw message data:", evt.data);
      }
    },
    onClose: (event) => {
      console.log(`[App WebSocket] Disconnected from room: ${room}. Code: ${event.code}, Reason: ${event.reason}`);
      setIsConnected(false);
      setLastReceivedMessage(null); // Reset pesan terakhir saat disconnect
      setAllMessages([]); // Mungkin reset messages saat disconnect? Atau biarkan? Tergantung UX.
    },
    onError: (err) => {
      console.error(`[App WebSocket] Error in room ${room}:`, err);
      setIsConnected(false);
    }
  });
  // --- Akhir usePartySocket ---

  // Fungsi untuk dikirim ke ChatInterface agar bisa mengirim pesan
  const sendMessage = useCallback((msg: Message) => {
      if (socket && isConnected) {
          console.log("[App Action] Sending message via socket:", msg.id ?? 'N/A');
          socket.send(JSON.stringify(msg));
      } else {
          console.warn("[App Action] Attempted to send message but socket not connected.");
      }
  }, [socket, isConnected]); // Dependensi socket dan isConnected

  const handleNameSubmit = (name: string) => {
    console.log("[App Action] Name submitted:", name);
    localStorage.setItem("chatUserName", name);
    setCurrentUser(name);
    // Reset state chat saat user baru login (opsional, tapi mungkin bagus)
    setAllMessages([]);
    setLastReceivedMessage(null);
  };

  // Render berdasarkan currentUser
  if (!currentUser) {
    console.log("[App Render] Rendering NameInput");
    return <NameInput onNameSubmit={handleNameSubmit} />;
  } else {
    console.log(`[App Render] Rendering ChatInterface for user: ${currentUser}, room: ${room}`);
    return (
      <ChatInterface
        userName={currentUser}
        room={room}
        initialMessages={allMessages} // Berikan state messages saat ini
        isConnected={isConnected}
        sendMessage={sendMessage} // Berikan fungsi kirim
        lastMessage={lastReceivedMessage} // Berikan pesan terakhir
      />
    );
  }
}

// Logika Rendering Utama (Tetap Sama)
const container = document.getElementById("root");
if (container) {
  console.log("[Main] Mounting React App");
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
  console.error("[Main] Failed to find the root element to mount the React app.");
}
