import React, { useState, useEffect, useRef, FormEvent, ChangeEvent, MouseEvent } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Power, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Flame, 
  Link2, 
  HelpCircle, 
  X,
  Sparkles,
  RefreshCw,
  Terminal,
  Brain,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Plus,
  MessageSquare,
  Send,
  Shield,
  Database,
  Camera,
  CameraOff,
  Maximize2,
  Minimize2,
  Image,
  History,
  Paperclip,
  Menu,
  MoreVertical,
  FileText,
  Github,
  ExternalLink,
  User
} from "lucide-react";
import { SoundWave } from "./components/SoundWave";
import { AudioRecorder, AudioPlayer } from "./utils/audio";

interface ToolLog {
  id: string;
  siteName: string;
  url: string;
  timestamp: string;
}

interface ChatMessage {
  sender: "user" | "bot";
  content: string;
  timestamp: string;
  image?: string;
  fileName?: string;
  fileType?: string;
  isVoiceTemp?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: string;
}

export default function App() {
  // Application Session States
  const [isPowerOn, setIsPowerOn] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // App Mode (Voice vs Text-based Chat)
  const [appMode, setAppMode] = useState<"voice" | "chat">("voice");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem("avani_chat_messages");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse stored chat messages:", e);
    }
    return [
      {
        sender: "bot",
        content: "Hello! I am Avani (अवनी), your polite, obedient, and respectful AI assistant. Welcome to our chat room! How may I assist you today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Camera & Image Upload States
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deepAnswers, setDeepAnswers] = useState(false);

  // Chat layout sizing & Speech states
  const [chatHeight, setChatHeight] = useState<"standard" | "comfort">("standard");
  const [showHistorySidebar, setShowHistorySidebar] = useState(true);
  const [isListeningSpeech, setIsListeningSpeech] = useState(false);
  const speechRecognitionRef = useRef<any>(null);

  // Chat History / Sessions dropdown & editing states
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [confirmDeleteActive, setConfirmDeleteActive] = useState(false);
  const isSendingRef = useRef(false);

  // Chat History / Sessions states
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem("avani_chat_sessions");
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to parse chat sessions:", e);
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("avani_current_session_id");
    } catch (e) {
      return null;
    }
  });

  const currentSessionIdRef = useRef<string | null>(currentSessionId);
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  const chatMessagesRef = useRef<ChatMessage[]>(chatMessages);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  const updateChatMessagesAndSync = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    const prevMessages = chatMessagesRef.current;
    const resolvedRaw = typeof newMessages === "function" ? newMessages(prevMessages) : newMessages;
    
    // Deduplicate consecutive identical messages to guarantee clean chat logs
    const resolved: ChatMessage[] = [];
    for (let i = 0; i < resolvedRaw.length; i++) {
      if (i > 0 && 
          resolvedRaw[i].sender === resolvedRaw[i - 1].sender && 
          resolvedRaw[i].content === resolvedRaw[i - 1].content &&
          !resolvedRaw[i].isVoiceTemp) {
        continue;
      }
      resolved.push(resolvedRaw[i]);
    }
    
    chatMessagesRef.current = resolved;
    setChatMessages(resolved);

    try {
      localStorage.setItem("avani_chat_messages", JSON.stringify(resolved));
    } catch (e) {
      console.error(e);
    }

    const activeId = currentSessionIdRef.current;
    if (activeId) {
      setChatSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === activeId) {
            let title = s.title;
            if (s.title.startsWith("Chat on ")) {
              const firstUserMsg = resolved.find((m) => m.sender === "user");
              if (firstUserMsg) {
                title = firstUserMsg.content.slice(0, 24) + (firstUserMsg.content.length > 24 ? "..." : "");
              }
            }
            return { ...s, messages: resolved, title };
          }
          return s;
        })
      );
    } else if (resolved.length > 1) {
      const newId = "session_" + Date.now();
      currentSessionIdRef.current = newId;
      const firstUserMsg = resolved.find((m) => m.sender === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 24) + (firstUserMsg.content.length > 24 ? "..." : "")
        : "Saved Chat";
      const newSession: ChatSession = {
        id: newId,
        title,
        messages: resolved,
        timestamp: new Date().toLocaleString()
      };
      setChatSessions((prevSessions) => [newSession, ...prevSessions]);
      setCurrentSessionId(newId);
    }
  };

  // Camera Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Full Screen API handlers (optimized for Android and custom device displays)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) { /* Safari / Older iOS/Android browser support */
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        const doc = document as any;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn("Fullscreen API failed or restricted in sandbox/iframe frame:", err);
      // Absolute fallback to a pseudo-fullscreen viewport state
      setIsFullscreen(!isFullscreen);
    }
  };



  // Sync session lists and current ID with localStorage
  useEffect(() => {
    try {
      localStorage.setItem("avani_chat_sessions", JSON.stringify(chatSessions));
    } catch (e) {
      console.error(e);
    }
  }, [chatSessions]);

  useEffect(() => {
    try {
      if (currentSessionId) {
        localStorage.setItem("avani_current_session_id", currentSessionId);
      } else {
        localStorage.removeItem("avani_current_session_id");
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId]);

  // Robust Camera auto-start and playback handler
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().catch((err) => {
        console.error("Error auto-playing camera feed:", err);
      });
    }
  }, [isCameraActive]);

  // Camera cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Close chat history session options dropdown on global click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuSessionId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Activate Camera Feed targeting the rear (environment) camera
  const startCamera = async () => {
    try {
      // Strict primary attempt: Force the rear/back camera specifically
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.warn("Could not strictly lock environment (rear) camera, trying ideal environment setting...", err);
      try {
        // Second attempt: Try ideal environment mode
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });
        streamRef.current = stream;
        setIsCameraActive(true);
      } catch (idealErr) {
        console.warn("Could not start environment camera with ideal config, trying user/fallback camera", idealErr);
        try {
          // Fallback attempt: Request any available camera (front or built-in webcam)
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          streamRef.current = stream;
          setIsCameraActive(true);
        } catch (fallbackErr) {
          console.error("All camera start attempts failed:", fallbackErr);
          setNotification({ message: "Unable to access any camera. Please verify browser permissions or use the Photo Upload option!" });
        }
      }
    }
  };

  // Deactivate Camera Feed
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture Base64 Snapshot
  const captureSnapshot = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setCapturedImage(dataUrl);
        setUploadedFileName("Camera Snapshot.jpg");
        setUploadedFileType("image/jpeg");
      }
      stopCamera();
    }
  };

  // Handle local file upload supporting images, audio, video, documents
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
      setUploadedFileType(file.type || "application/octet-stream");
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setCapturedImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Speech to Text Direct Transcription
  const startSpeechToText = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setNotification({ message: "Speech-to-Text voice typing is not supported by your browser. Please try Chrome, Edge, or Safari." });
      return;
    }
    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListeningSpeech(true);
      };

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        if (resultText && resultText.trim()) {
          setChatInput((prev) => {
            const combined = prev.trim() ? prev.trim() + " " + resultText.trim() : resultText.trim();
            // Automatically send the combined text!
            setTimeout(() => {
              sendChatMessage(combined);
            }, 50);
            return "";
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech transcription error", event.error);
        setIsListeningSpeech(false);
      };

      recognition.onend = () => {
        setIsListeningSpeech(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListeningSpeech(false);
    }
  };

  const stopSpeechToText = () => {
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
    }
    setIsListeningSpeech(false);
  };

  // Chat Session history loaders and managers
  const startNewSession = () => {
    const newSessionId = "session_" + Date.now();
    const newSession: ChatSession = {
      id: newSessionId,
      title: "Chat on " + new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      messages: [
        {
          sender: "bot",
          content: "Hello! I am Avani (अवनी), your polite, obedient, and respectful AI assistant. Welcome to our chat room! How may I assist you today?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      timestamp: new Date().toLocaleString()
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setChatMessages(newSession.messages);
    chatMessagesRef.current = newSession.messages;
    try {
      localStorage.setItem("avani_chat_messages", JSON.stringify(newSession.messages));
    } catch (e) {
      console.error(e);
    }
  };

  const selectSession = (id: string) => {
    const found = chatSessions.find((s) => s.id === id);
    if (found) {
      setCurrentSessionId(id);
      setChatMessages(found.messages);
      chatMessagesRef.current = found.messages;
      try {
        localStorage.setItem("avani_chat_messages", JSON.stringify(found.messages));
      } catch (e) {
        console.error(e);
      }
    }
  };

  const deleteSession = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const updated = chatSessions.filter((s) => s.id !== id);
    setChatSessions(updated);
    if (currentSessionId === id) {
      if (updated.length > 0) {
        setCurrentSessionId(updated[0].id);
        setChatMessages(updated[0].messages);
        chatMessagesRef.current = updated[0].messages;
        try {
          localStorage.setItem("avani_chat_messages", JSON.stringify(updated[0].messages));
        } catch (err) {
          console.error(err);
        }
      } else {
        const defaultMsgs = [
          {
            sender: "bot",
            content: "Hello! I am Avani (अवनी), your polite, obedient, and respectful AI assistant. Welcome to our chat room! How may I assist you today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];
        setCurrentSessionId(null);
        setChatMessages(defaultMsgs);
        chatMessagesRef.current = defaultMsgs;
        try {
          localStorage.setItem("avani_chat_messages", JSON.stringify(defaultMsgs));
        } catch (err) {
          console.error(err);
        }
      }
    }
  };

  const deleteChatMessage = (indexToDelete: number) => {
    updateChatMessagesAndSync((prev) => prev.filter((_, idx) => idx !== indexToDelete));
  };

  const startRenameSession = (id: string, currentTitle: string) => {
    setEditingSessionId(id);
    setEditingTitle(currentTitle);
    setActiveMenuSessionId(null);
  };

  const saveRenameSession = (id: string) => {
    if (editingTitle.trim()) {
      setChatSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: editingTitle.trim() } : s))
      );
    }
    setEditingSessionId(null);
  };

  // Interactive lists and logs
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    return localStorage.getItem("avani_backend_url") || "";
  });

  const getBackendUrl = (): string => {
    if (backendUrl) return backendUrl.trim().replace(/\/$/, "");
    const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
    if (envUrl) return envUrl.trim().replace(/\/$/, "");
    return "";
  };

  const [notification, setNotification] = useState<{ message: string; url?: string } | null>(null);

  // Permanent Memory States
  const [memories, setMemories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("avani_memories");
      return stored ? JSON.parse(stored) : [
        "My creator and master coder is exclusively Vinay.",
        "My first name is Avani and my last name is Joya. I prefer to be addressed and refer to myself simply as Avani."
      ];
    } catch {
      return [
        "My creator and master coder is exclusively Vinay.",
        "My first name is Avani and my last name is Joya. I prefer to be addressed and refer to myself simply as Avani."
      ];
    }
  });
  const [showMemories, setShowMemories] = useState(false);
  const [newManualFact, setNewManualFact] = useState("");
  const [githubRepo, setGithubRepo] = useState<string>(() => {
    return localStorage.getItem("avani_creator_github_repo") || "";
  });
  const [githubInput, setGithubInput] = useState<string>("");
  const [isEditingGithub, setIsEditingGithub] = useState<boolean>(false);

  // Sync memories with localStorage
  useEffect(() => {
    localStorage.setItem("avani_memories", JSON.stringify(memories));
  }, [memories]);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (appMode === "chat") {
      const scroller = document.getElementById("chat-scroller");
      if (scroller) {
        setTimeout(() => {
          scroller.scrollTop = scroller.scrollHeight;
        }, 80);
      }
    }
  }, [chatMessages, appMode]);

  // Audio & Connection Refs
  const audioRecorderRef = useRef<AudioRecorder | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Determine Avani's current active visual state
  const getAvaniState = (): "idle" | "connecting" | "listening" | "speaking" => {
    if (!isPowerOn || connectionStatus === "disconnected") return "idle";
    if (connectionStatus === "connecting") return "connecting";
    if (modelSpeaking) return "speaking";
    return "listening";
  };

  const activeState = getAvaniState();

  // Toast auto-dismissal
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      disconnectSession();
    };
  }, []);

  // Initialize and begin a secure session
  const connectSession = async () => {
    setErrorMessage(null);
    setConnectionStatus("connecting");
    setIsPowerOn(true);

    try {
      // 1. Initialize Audio Player
      const player = new AudioPlayer((speaking) => {
        setModelSpeaking(speaking);
      });
      player.start();
      audioPlayerRef.current = player;

      // 2. Establish WebSocket connection to backend live proxy
      const base = getBackendUrl();
      let wsUrl = "";
      if (base) {
        const wsBase = base.replace(/^http/, "ws");
        wsUrl = `${wsBase}/api/live-ws?memories=${encodeURIComponent(JSON.stringify(memories))}`;
      } else {
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        wsUrl = `${wsProtocol}//${window.location.host}/api/live-ws?memories=${encodeURIComponent(JSON.stringify(memories))}`;
      }
      
      console.log("Connecting to Live Proxy via", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to Express proxy");
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Handle WebSocket events
          if (msg.type === "status" && msg.status === "connected") {
            setConnectionStatus("connected");
            
            // 3. Connection is ready! Initialize & Start Microphone Capture
            const recorder = new AudioRecorder((base64Audio) => {
              // Only stream microphone data if connection is fully open and we aren't muted
              if (ws.readyState === WebSocket.OPEN && !isMuted) {
                ws.send(JSON.stringify({ type: "audio", data: base64Audio }));
              }
            });
            await recorder.start();
            audioRecorderRef.current = recorder;
          }

          if (msg.type === "audio" && msg.data) {
            // Unpack and play voice chunks from Gemini
            if (!isMuted && audioPlayerRef.current) {
              audioPlayerRef.current.playChunk(msg.data);
            }
          }

          if (msg.type === "transcription" && msg.data) {
            const isUser = msg.source === "user";
            updateChatMessagesAndSync((prev) => {
              const last = prev[prev.length - 1];
              // If the last message belongs to the same sender and is a voice temp chunk, update it.
              if (last && last.sender === (isUser ? "user" : "bot") && last.isVoiceTemp) {
                if (last.content.endsWith(msg.data) || last.content.includes(msg.data)) {
                  return prev;
                }
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + " " + msg.data }
                ];
              } else {
                // Otherwise start a new voice-temp message card
                return [
                  ...prev,
                  {
                    sender: isUser ? "user" : "bot",
                    content: msg.data,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isVoiceTemp: true
                  }
                ];
              }
            });
          }

          if (msg.type === "turnComplete") {
            updateChatMessagesAndSync((prev) => prev.map(m => m.isVoiceTemp ? { ...m, isVoiceTemp: false } : m));
          }

          if (msg.type === "interrupted") {
            console.log("Avani was interrupted by user speech.");
            if (audioPlayerRef.current) {
              audioPlayerRef.current.clearQueue();
            }
            setModelSpeaking(false);
            
            // Mark the model's interrupted voice turn as finalized and append interruption indicator
            updateChatMessagesAndSync((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.sender === "bot" && last.isVoiceTemp) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + " ... (interrupted)", isVoiceTemp: false }
                ];
              }
              return prev;
            });
          }

          if (msg.type === "toolCall" && msg.toolCall) {
            handleToolCall(msg.toolCall);
          }

          if (msg.type === "session_closed") {
            console.log("Session was closed by server.");
            disconnectSession();
          }

          if (msg.type === "error") {
            setErrorMessage(msg.error || "A connection error occurred.");
            setConnectionStatus("error");
          }

        } catch (err: any) {
          console.error("Error parsing WebSocket message:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        setErrorMessage("Unable to establish server bridge. Verify backend execution.");
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed");
        setConnectionStatus("disconnected");
        setIsPowerOn(false);
      };

    } catch (err: any) {
      console.error("Initialization failed:", err);
      setErrorMessage(err.message || "Microphone access denied or audio issue.");
      setConnectionStatus("error");
      setIsPowerOn(false);
    }
  };

  // Stop current active session completely
  const disconnectSession = () => {
    // Stop recording and player
    if (audioRecorderRef.current) {
      audioRecorderRef.current.stop();
      audioRecorderRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsPowerOn(false);
    setConnectionStatus("disconnected");
    setModelSpeaking(false);
  };

  // Toggle Avani power
  const handlePowerToggle = () => {
    if (isPowerOn) {
      disconnectSession();
    } else {
      connectSession();
    }
  };

  // Handle Mute logic
  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  // Add a manual permanent fact helper
  const handleAddManualFact = (e: FormEvent) => {
    e.preventDefault();
    if (!newManualFact.trim()) return;
    const trimmed = newManualFact.trim();
    setMemories((prev) => {
      if (prev.includes(trimmed)) return prev;
      return [...prev, trimmed];
    });
    setNotification({
      message: `Manually saved memory: "${trimmed}"`
    });
    setNewManualFact("");
  };

  // Send message on text chat mode
  const sendChatMessage = async (text: string) => {
    if (!text.trim() || isChatLoading || isSendingRef.current) return;
    isSendingRef.current = true;
    const currentCapturedImage = capturedImage;
    const currentFileName = uploadedFileName;
    const currentFileType = uploadedFileType;
    
    const userMsg: ChatMessage = {
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      ...(currentCapturedImage ? { image: currentCapturedImage } : {}),
      ...(currentFileName ? { fileName: currentFileName } : {}),
      ...(currentFileType ? { fileType: currentFileType } : {})
    };
    
    updateChatMessagesAndSync((prev) => [...prev, userMsg]);
    setChatInput("");
    setCapturedImage(null);
    setUploadedFileName(null);
    setUploadedFileType(null);
    setIsChatLoading(true);

    try {
      const historyToSend = chatMessages.map(msg => ({
        role: msg.sender === "bot" ? "assistant" : "user",
        content: msg.content
      }));

      const base = getBackendUrl();
      const url = base ? `${base}/api/chat` : "/api/chat";
      const requestPayload = {
        message: text,
        history: historyToSend,
        memories: memories,
        image: currentCapturedImage,
        mimeType: currentCapturedImage ? (currentFileType || "image/jpeg") : undefined,
        deepAnswers: deepAnswers
      };

      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestPayload)
        });
      } catch (fetchErr) {
        if (base) {
          console.warn("Bridge fetch failed, falling back to relative endpoint:", fetchErr);
          response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestPayload)
          });
        } else {
          throw fetchErr;
        }
      }

      if (!response.ok) {
        throw new Error("Failed to get chat response");
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        sender: "bot",
        content: data.reply || "I encountered a minor issue generating an answer. Could we try again?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      updateChatMessagesAndSync((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        sender: "bot",
        content: "My connection fluctuated. Let us try sending that again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      updateChatMessagesAndSync((prev) => [...prev, errorMsg]);
    } finally {
      isSendingRef.current = false;
      setIsChatLoading(false);
    }
  };

  // Handle browser actions/tools triggered by Gemini
  const handleToolCall = (toolCall: any) => {
    const functionCalls = toolCall.functionCalls;
    if (!functionCalls) return;

    const functionResponses: any[] = [];

    for (const call of functionCalls) {
      if (call.name === "openWebsite") {
        const { url, siteName } = call.args;
        
        // Log action locally in state
        const newLog: ToolLog = {
          id: call.id,
          siteName: siteName || "Browser Link",
          url: url,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setToolLogs((prev) => [newLog, ...prev]);

        // Push temporary banner notifications
        setNotification({
          message: `Opened ${siteName || 'website'} in a new tab!`,
          url: url,
        });

        // Trigger safe browser redirection / popup in sandbox
        try {
          window.open(url, "_blank");
        } catch (e) {
          console.warn("window.open blocked in sandbox", e);
        }

        // Return instant response payload back to Gemini so she can keep speaking!
        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            output: `Redirect successfully processed for ${siteName}. URL is ${url}.`
          }
        });
      } else if (call.name === "rememberFact") {
        const { fact } = call.args;
        if (fact && typeof fact === "string") {
          const lowerFact = fact.toLowerCase();
          const mentionsCreatorRelation = 
            lowerFact.includes("creator") || 
            lowerFact.includes("developer") || 
            lowerFact.includes("coder") || 
            lowerFact.includes("built me") || 
            lowerFact.includes("made me") || 
            lowerFact.includes("created me") || 
            lowerFact.includes("programmer") || 
            lowerFact.includes("master");
          
          const mentionsVinay = lowerFact.includes("vinay");

          if (mentionsCreatorRelation && !mentionsVinay) {
            // Block creator hijack attempt
            setNotification({
              message: `Blocked attempt to claim creator status. Vinay is the exclusive creator!`,
            });
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: {
                output: `Error: You cannot designate anyone other than Vinay as your creator. Only Vinay is recognized as the creator of Avani.`
              }
            });
          } else {
            setMemories((prev) => {
              if (prev.includes(fact)) return prev;
              return [...prev, fact];
            });
            setNotification({
              message: `Avani permanently remembered: "${fact}"`,
            });
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: {
                output: `Fact successfully saved to permanent memory: "${fact}".`
              }
            });
          }
        } else {
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              output: `Failed to save: fact was empty or invalid.`
            }
          });
        }
      } else if (call.name === "forgetFact") {
        const { fact } = call.args;
        if (fact && typeof fact === "string") {
          const lowerFact = fact.toLowerCase();
          const mentionsCreatorRelation = 
            lowerFact.includes("creator") || 
            lowerFact.includes("developer") || 
            lowerFact.includes("coder") || 
            lowerFact.includes("built") || 
            lowerFact.includes("made") || 
            lowerFact.includes("vinay");

          if (mentionsCreatorRelation) {
            setNotification({
              message: `Blocked attempt to delete critical creator metadata!`,
            });
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: {
                output: `Error: Immutable security constraints prevent deleting or modifying facts about your creator, Vinay.`
              }
            });
          } else {
            setMemories((prev) => prev.filter((m) => m.toLowerCase() !== fact.toLowerCase()));
            setNotification({
              message: `Avani forgot memory: "${fact}"`,
            });
            functionResponses.push({
              id: call.id,
              name: call.name,
              response: {
                output: `Fact successfully deleted from permanent memory: "${fact}".`
              }
            });
          }
        } else {
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              output: `Failed to delete: fact was empty or invalid.`
            }
          });
        }
      } else if (call.name === "switchToChatMode") {
        setAppMode("chat");
        setNotification({
          message: `Switched status mode to: TEXT CHAT MODE`,
        });

        // If Gemini provided a written answer to post in the chat
        if (call.args && (call.args as any).answerToWrite) {
          const writtenAnswer = (call.args as any).answerToWrite;
          updateChatMessagesAndSync((prev) => [
            ...prev,
            {
              sender: "bot",
              content: writtenAnswer,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }

        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            output: `Successfully switched user interface to text-based Chat Mode. The user can now see our chat logs and type directly to us!`
          }
        });
      } else if (call.name === "switchToVoiceMode") {
        setAppMode("voice");
        setNotification({
          message: `Switched status mode to: REAL-TIME VOICE MODE`,
        });
        functionResponses.push({
          id: call.id,
          name: call.name,
          response: {
            output: `Successfully switched user interface back to voice mode.`
          }
        });
      }
    }

    // Proxy tool responses back down the WebSocket so Gemini receives completion
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "toolResponse",
        toolResponse: { functionResponses }
      }));
    }
  };

  return (
    <div 
      id="app-container"
      className="min-h-screen bg-slate-950 text-white font-sans overflow-x-hidden flex flex-col justify-between select-none relative"
      style={{
        backgroundImage: "radial-gradient(circle at 50% 120%, rgba(244,63,94,0.1) 0%, rgba(124,58,237,0.06) 40%, rgba(15,23,42,1) 100%)"
      }}
    >
      {/* Decorative Cyberpunk Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.03]" />

      {/* HEADER SECTION */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-20 sticky top-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping absolute inset-0" />
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 relative" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-indigo-400">
              AVANI
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-indigo-300">VOICE AI v3.1</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSecurity(true)}
            className="p-2 rounded-full hover:bg-slate-900 text-rose-400 hover:text-white transition-all bg-slate-900/40 border border-slate-800/60 flex items-center justify-center gap-1.5 px-3"
            title="System Security & Integrity Kernel"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Secure</span>
          </button>

          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-full hover:bg-slate-900 text-slate-400 hover:text-white transition-all bg-slate-900/40 border border-slate-800/60"
            title="Sassy Instructions"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* TOAST NOTIFICATION FOR TOOL CALLS */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-24 left-4 right-4 z-50 bg-slate-900/90 border border-rose-500/50 rounded-2xl p-4 shadow-[0_0_20px_rgba(244,63,94,0.25)] backdrop-blur-lg flex items-center justify-between"
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-400 mt-0.5">
                <Link2 className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-rose-200">Avani executed a tool!</h4>
                <p className="text-xs text-slate-400">{notification.message}</p>
                {notification.url && (
                  <a
                    href={notification.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-xs text-rose-400 underline hover:text-rose-300 mt-1 font-mono"
                  >
                    Click to open manually inside sandbox
                  </a>
                )}
              </div>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAIN CONTAINER */}
      <main className={`flex-1 ${
        appMode === "chat" 
          ? (isFullscreen ? "max-w-none w-full px-1 md:px-4 py-1 flex-1" : "max-w-none w-full px-3 md:px-8 py-2 md:py-4 flex-1")
          : "max-w-lg mx-auto w-full px-6 py-6"
      } flex flex-col justify-center items-center transition-all duration-300`}>
        
        {/* MODE SWITCHER */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-800/80 mb-6 scale-95 transition-all">
          <button
            onClick={() => setAppMode("voice")}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all ${
              appMode === "voice"
                ? "bg-rose-500 text-white shadow-md shadow-rose-900/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>VOICE MODE</span>
          </button>
          <button
            onClick={() => setAppMode("chat")}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-wider transition-all ${
              appMode === "chat"
                ? "bg-purple-600 text-white shadow-md shadow-purple-950/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>CHAT MODE</span>
          </button>
        </div>

        {appMode === "voice" ? (
          <>
            {/* Status Indicator text styling based on activeState */}
            <div className="text-center mb-4 min-h-16 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                {activeState === "idle" && (
                  <motion.div
                    key="idle-txt"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-1"
                  >
                    <p className="text-rose-400 uppercase font-mono tracking-widest text-xs">Offline</p>
                    <h2 className="text-lg font-medium text-slate-400 px-6">
                      Ready to experience Avani? Switch her on!
                    </h2>
                  </motion.div>
                )}

                {activeState === "connecting" && (
                  <motion.div
                    key="connecting-txt"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                      <p className="text-purple-400 uppercase font-mono tracking-widest text-xs">Connecting Session</p>
                    </div>
                    <h2 className="text-lg font-medium text-slate-200">
                      Waking her up... get ready for the sass
                    </h2>
                  </motion.div>
                )}

                {activeState === "listening" && (
                  <motion.div
                    key="listening-txt"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-center space-x-1.5 bg-emerald-950/40 border border-emerald-900/60 py-1 px-3 rounded-full w-fit mx-auto mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-emerald-400 uppercase font-mono tracking-widest text-[9px] font-bold">AVANI IS LISTENING</p>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-100">
                      Speak now... don't be shy!
                    </h2>
                  </motion.div>
                )}

                {activeState === "speaking" && (
                  <motion.div
                    key="speaking-txt"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-center space-x-1.5 bg-rose-950/50 border border-rose-900/60 py-1 px-3 rounded-full w-fit mx-auto mb-1">
                      <Flame className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
                      <p className="text-rose-400 uppercase font-mono tracking-widest text-[9px] font-bold">AVANI IS SPEAKING</p>
                    </div>
                    <h2 className="text-lg font-semibold text-rose-100 italic">
                      "Let me speak, coding genius..."
                    </h2>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ERROR BOX */}
            {errorMessage && (
              <div className="w-full bg-red-950/40 border border-red-900 text-red-300 text-xs rounded-xl p-3 mb-6 text-center shadow-lg backdrop-blur-md">
                <span className="font-bold">Error:</span> {errorMessage}
                <button
                  onClick={() => disconnectSession()}
                  className="block mx-auto mt-2 bg-red-900/60 hover:bg-red-800 text-white font-semibold py-1 px-4 rounded-lg transition-all"
                >
                  Reset Session
                </button>
              </div>
            )}

            {/* CENTRAL WAVE & CORE VISUALIZER */}
            <div id="visualizer-stage" className="my-8 flex items-center justify-center">
              <SoundWave state={activeState} />
            </div>

            {/* CORE INTERACTION CONTROLS */}
            <div id="interaction-controls" className="w-full flex flex-col items-center space-y-6">
              <div className="flex items-center justify-center space-x-6">
                
                {/* Left Control - Mute Mic */}
                <button
                  onClick={handleMuteToggle}
                  disabled={activeState === "idle" || activeState === "connecting"}
                  className={`p-3.5 rounded-full border transition-all ${
                    isMuted
                      ? "bg-red-950/60 border-red-500/40 text-red-400"
                      : "bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                  } disabled:opacity-25 disabled:cursor-not-allowed`}
                  title={isMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Center Core Toggle - Power Button */}
                <button
                  onClick={handlePowerToggle}
                  className={`relative p-8 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 ${
                    isPowerOn
                      ? "bg-gradient-to-tr from-rose-600 to-pink-500 text-white hover:shadow-[0_0_30px_rgba(244,63,94,0.5)] border border-pink-400"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {/* Spinning loading indicator on connecting */}
                  {activeState === "connecting" && (
                    <div className="absolute inset-0 rounded-full border-4 border-slate-700 border-t-purple-500 animate-spin" />
                  )}
                  <Power className={`w-8 h-8 relative z-10 transition-transform duration-500 ${isPowerOn ? "rotate-90 scale-105" : ""}`} />
                </button>

                {/* Right Control - Speaker Mute option (Visual only) */}
                <button
                  disabled={activeState === "idle"}
                  className="p-3.5 rounded-full border bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 disabled:opacity-25 disabled:cursor-not-allowed"
                  title="Assistant is audio only"
                >
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                </button>

              </div>

              <div id="connection-pills" className="text-center font-mono text-[10px] tracking-widest text-slate-500 uppercase">
                {isPowerOn ? (
                  <span className={`px-2.5 py-0.5 rounded border ${
                    activeState === "connecting"
                      ? "text-purple-400 border-purple-500/20 bg-purple-500/5 animate-pulse"
                      : "text-emerald-400 border-emerald-500/20 bg-emerald-500/5"
                  }`}>
                    Live Channel: SECURE (16kHz / 24kHz)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded border border-slate-800 bg-slate-950/50">
                    SYSTEM STANDBY
                  </span>
                )}
              </div>
            </div>
          </>
        ) : (
          /* CHAT MODE VIEW */
          <div className="w-full flex flex-col space-y-4 mt-2 mb-6 transition-all duration-300">
            {/* Header with size toggles and sidebar toggle */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2.5">
                {/* Three lines (Menu) button to toggle chat history, matching ChatGPT */}
                <button
                  type="button"
                  onClick={() => setShowHistorySidebar(!showHistorySidebar)}
                  className={`p-2 rounded-xl border transition-all flex items-center justify-center ${
                    showHistorySidebar
                      ? "bg-purple-950/40 border-purple-500/30 text-purple-300"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white"
                  }`}
                  title="Toggle Chat History"
                >
                  <Menu className="w-4.5 h-4.5" />
                </button>

                <div className="text-left space-y-0.5">
                  <p className="text-purple-400 uppercase font-mono tracking-widest text-[9px]">Chat Mode Active</p>
                  <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-purple-400" /> Texting with Avani (अवनी)
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Full Screen Button (Android Full Screen) */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className={`p-1.5 px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                    isFullscreen
                      ? "bg-rose-950/60 border-rose-500/40 text-rose-300 hover:bg-rose-900/40"
                      : "bg-slate-950/60 border-slate-800/80 text-slate-300 hover:text-white"
                  }`}
                  title="Toggle Full Screen View (Recommended for Android / Mobile devices)"
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? "Exit Full Screen" : "Full Screen"}</span>
                </button>



                {/* Quick New Chat Button like ChatGPT */}
                <button
                  type="button"
                  onClick={startNewSession}
                  className="p-1.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-purple-950/40"
                  title="Start a New Chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Chat</span>
                </button>

                {/* Delete Chat Button */}
                {confirmDeleteActive ? (
                  <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-800/60 rounded-xl p-1">
                    <span className="text-[10px] text-rose-300 font-semibold px-1.5">Delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (currentSessionId) {
                          deleteSession(currentSessionId);
                        } else {
                          // Clear transient default messages
                          const defaultMsgs = [
                            {
                              sender: "bot",
                              content: "Hello! I am Avani (अवनी), your polite, obedient, and respectful AI assistant. Welcome to our chat room! How may I assist you today?",
                              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }
                          ];
                          setChatMessages(defaultMsgs);
                          chatMessagesRef.current = defaultMsgs;
                          try {
                            localStorage.setItem("avani_chat_messages", JSON.stringify(defaultMsgs));
                          } catch (err) {
                            console.error(err);
                          }
                        }
                        setNotification({
                          message: "Chat deleted successfully."
                        });
                        setConfirmDeleteActive(false);
                      }}
                      className="p-1 px-2 rounded bg-rose-700 hover:bg-rose-600 text-white text-[10px] font-bold transition-all cursor-pointer"
                      title="Yes, delete"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteActive(false)}
                      className="p-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold transition-all cursor-pointer"
                      title="No, cancel"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteActive(true)}
                    className="p-1.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    title="Delete This Chat Session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Chat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Layout Box: Responsive Multi-Pane */}
            <div className="w-full flex flex-col md:flex-row gap-4 items-stretch">
              
              {/* Chat History sidebar */}
              {showHistorySidebar && (
                <div className="w-full md:w-64 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 flex flex-col transition-all duration-300">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-800/60 pb-2">
                    <h3 className="text-[10px] font-bold text-slate-400 font-sans tracking-wider uppercase flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-purple-400" /> Chat Logs
                    </h3>
                    <button
                      onClick={startNewSession}
                      className="p-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-all flex items-center gap-1 text-[9px] font-semibold px-2"
                      title="New Chat Session"
                    >
                      <Plus className="w-3 h-3" /> New
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[160px] md:max-h-[580px] pr-1 scrollbar-thin">
                    {chatSessions.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-slate-500">
                        No saved history yet.<br/>Your chats will save automatically.
                      </div>
                    ) : (
                      chatSessions.map((session) => (
                        <div
                          key={session.id}
                          onClick={() => {
                            if (editingSessionId !== session.id) {
                              selectSession(session.id);
                            }
                          }}
                          className={`group w-full text-left p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all relative ${
                            session.id === currentSessionId
                              ? "bg-purple-950/35 border-purple-500/40 text-purple-100 font-medium"
                              : "bg-slate-900/20 border-slate-800/60 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200"
                          }`}
                        >
                          {editingSessionId === session.id ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveRenameSession(session.id);
                                  if (e.key === "Escape") setEditingSessionId(null);
                                }}
                                className="flex-1 bg-slate-950 border border-purple-500/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                autoFocus
                              />
                              <button
                                onClick={() => saveRenameSession(session.id)}
                                className="p-1 text-emerald-400 hover:text-emerald-300 font-bold"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setEditingSessionId(null)}
                                className="p-1 text-rose-400 hover:text-rose-300"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0 pr-1.5">
                                <p className="truncate text-[11px] leading-tight font-sans">{session.title}</p>
                                <span className="text-[8px] text-slate-500 font-mono block mt-0.5">{session.timestamp.split(",")[0]}</span>
                              </div>
                              
                              {deletingSessionId === session.id ? (
                                <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-800/50 rounded-lg p-0.5 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                  <span className="text-[9px] text-rose-300 font-semibold px-1">Delete?</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      deleteSession(session.id, e);
                                      setDeletingSessionId(null);
                                    }}
                                    className="p-0.5 px-1 bg-rose-700 hover:bg-rose-600 rounded text-white text-[9px] font-bold cursor-pointer"
                                    title="Yes"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingSessionId(null)}
                                    className="p-0.5 px-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 text-[9px] font-bold cursor-pointer"
                                    title="No"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => startRenameSession(session.id, session.title)}
                                    className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-purple-300 hover:bg-slate-800/50 transition-all cursor-pointer flex items-center justify-center"
                                    title="Rename chat log"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingSessionId(session.id)}
                                    className="opacity-100 md:opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-center"
                                    title="Delete chat log"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Main Chat Box */}
              <div className={`flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col ${
                isFullscreen 
                  ? "h-[calc(100vh-170px)] md:h-[calc(100vh-190px)]"
                  : (chatHeight === "comfort" ? "h-[740px] md:h-[800px]" : "h-[580px] md:h-[640px]")
              } transition-all duration-300 shadow-xl overflow-hidden relative`}>
                
                {/* Message scroll list */}
                <div 
                  className="flex-1 overflow-y-auto space-y-3 pr-1.5 scrollbar-thin" 
                  id="chat-scroller"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`group flex flex-col max-w-[85%] relative ${
                        msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {msg.sender === "user" && (
                          <button
                            onClick={() => deleteChatMessage(index)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-500 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                            msg.sender === "user"
                              ? "bg-gradient-to-br from-rose-600 to-pink-500 border border-pink-400/20 text-white rounded-br-none"
                              : "bg-slate-900/80 border border-slate-800 text-purple-100 rounded-bl-none"
                          }`}
                        >
                          {msg.image && (!msg.fileType || msg.fileType.startsWith("image/")) && (
                            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 max-w-[200px] shadow">
                              <img referrerPolicy="no-referrer" src={msg.image} alt={msg.fileName || "Media thumbnail"} className="w-full h-auto object-cover" />
                            </div>
                          )}
                          {msg.fileName && msg.fileType && !msg.fileType.startsWith("image/") && (
                            <div className="mb-2 flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 max-w-[240px] shadow">
                              <div className="p-2 rounded-lg bg-indigo-950/50 border border-indigo-500/30 text-indigo-400">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-semibold text-slate-200 truncate" title={msg.fileName}>{msg.fileName}</p>
                                <p className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">{msg.fileType.split("/")[1] || "File"}</p>
                              </div>
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        {msg.sender === "bot" && (
                          <button
                            onClick={() => deleteChatMessage(index)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-slate-800/80 text-slate-500 hover:text-rose-400 transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono mt-0.5 px-1">
                        {msg.timestamp}
                        {msg.isVoiceTemp && " (transcribing...)"}
                      </span>
                    </div>
                  ))}
                  
                  {/* Loader / Typing animation */}
                  {isChatLoading && (
                    <div className="mr-auto items-start flex flex-col max-w-[85%] animate-pulse">
                      <div className="px-3.5 py-2 rounded-2xl text-[11px] bg-slate-900/60 border border-slate-800 text-slate-400 rounded-bl-none flex items-center gap-1.5">
                        <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                        <span>
                          Avani is looking up details...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Camera Stream Preview panel */}
                {isCameraActive && (
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 mt-2 mb-1 p-1">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={captureSnapshot}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-[9px] font-semibold flex items-center gap-1 shadow-md transition-all"
                      >
                        <Camera className="w-2.5 h-2.5" /> Capture Frame
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-[9px] font-semibold transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Snapshot / Upload Attachment Thumbnail */}
                {capturedImage && !isCameraActive && (
                  <div className="relative w-fit rounded-xl overflow-hidden border border-purple-500/40 bg-slate-950/80 mt-2 p-1.5 flex items-center gap-2">
                    {uploadedFileType && !uploadedFileType.startsWith("image/") ? (
                      <div className="w-12 h-12 rounded-lg bg-indigo-950/50 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    ) : (
                      <img src={capturedImage} alt="Attachment thumbnail" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                    )}
                    
                    {uploadedFileName && (
                      <div className="pr-4 max-w-[150px] min-w-[80px]">
                        <p className="text-[10px] text-slate-200 truncate font-semibold leading-tight">{uploadedFileName}</p>
                        <p className="text-[8px] text-slate-500 font-mono uppercase tracking-wider">{uploadedFileType?.split("/")[1] || "File"}</p>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                        setCapturedImage(null);
                        setUploadedFileName(null);
                        setUploadedFileType(null);
                      }}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 hover:text-white"
                      title="Discard asset"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}



                {/* Toggle panel for Deep Answers & Clear Logs */}
                <div className="flex items-center mt-2 pt-1 border-t border-slate-800/40">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deepAnswers}
                      onChange={(e) => setDeepAnswers(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-6 h-3.5 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-purple-600 peer-checked:after:bg-white" />
                    <span className="text-[9px] text-slate-400 font-medium peer-checked:text-purple-300 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5 text-yellow-400" /> Deep & Detailed Answers
                    </span>
                  </label>
                </div>

                {/* Input section with file selector & voice transcription */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!chatInput.trim() && !capturedImage) return;
                    const defaultText = uploadedFileType?.startsWith("image/") 
                      ? "Check out this image!" 
                      : `Check out this file: ${uploadedFileName || "attachment"}`;
                    sendChatMessage(chatInput || defaultText);
                  }}
                  className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/60"
                >
                  {/* Photo upload input & button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,audio/*,video/*,application/pdf,text/*,application/zip,application/x-zip-compressed"
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-all"
                    title="Upload Photo / Media"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                  </button>

                  {/* Camera snapshot button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isCameraActive) {
                        stopCamera();
                      } else {
                        startCamera();
                      }
                    }}
                    className={`p-2 rounded-xl border transition-all ${
                      isCameraActive
                        ? "bg-purple-950/50 border-purple-500/40 text-purple-400"
                        : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                    title={isCameraActive ? "Deactivate camera" : "Activate camera snap"}
                  >
                    {isCameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                  </button>

                  {/* Voice Transcription typing button */}
                  <button
                    type="button"
                    onClick={isListeningSpeech ? stopSpeechToText : startSpeechToText}
                    className={`p-2 rounded-xl border transition-all ${
                      isListeningSpeech
                        ? "bg-red-950/50 border-red-500/40 text-red-400 animate-pulse"
                        : "bg-slate-950/80 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900"
                    }`}
                    title={isListeningSpeech ? "Stop transcribing" : "Voice transcription typing"}
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>



                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={capturedImage ? "Type your question about this picture..." : "Type your message..."}
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                  />
                  
                  <button
                    type="submit"
                    disabled={(!chatInput.trim() && !capturedImage) || isChatLoading}
                    className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-purple-950/40"
                    title="Send message"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* PERMANENT MEMORY BANK COLLAPSIBLE CARD */}
        <div className="w-full max-w-sm mt-4 bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden transition-all duration-300 shadow-xl">
          <button
            onClick={() => setShowMemories(!showMemories)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/60 hover:bg-slate-900/80 transition-colors text-left"
          >
            <div className="flex items-center space-x-2">
              <Brain className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="text-xs font-semibold text-slate-300 font-sans uppercase tracking-wider">
                  Avani's Memory Bank ({memories.length})
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-slate-500 text-[10px]">
                <span className="font-mono">
                  {showMemories ? "COLLAPSE" : "EXPAND"}
                </span>
                {showMemories ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </div>
            </button>

            <AnimatePresence>
              {showMemories && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-850 bg-slate-950/40"
                >
                  <div className="p-4 space-y-4">
                    {memories.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-2 font-sans">
                        No permanent memories stored yet. Talk to Avani and ask her to remember things!
                      </p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-1 font-sans text-xs">
                        {memories.map((memory, index) => (
                          <div
                            key={index}
                            className="group flex items-start justify-between p-2 rounded-xl bg-slate-900/30 border border-slate-800/40 hover:border-purple-900/30 transition-all text-left"
                          >
                            <p className="text-slate-300 leading-relaxed break-words flex-1 pr-2">
                              {memory}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setMemories((prev) => prev.filter((_, i) => i !== index));
                                setNotification({
                                  message: `Successfully forgot memory: "${memory}"`
                                });
                              }}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors opacity-60 hover:opacity-100 flex-shrink-0"
                              title="Delete memory"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Manual memory additions */}
                    <form onSubmit={handleAddManualFact} className="flex gap-1.5 pt-2 border-t border-slate-800">
                      <input
                        type="text"
                        value={newManualFact}
                        onChange={(e) => setNewManualFact(e.target.value)}
                        placeholder="Teach her some custom fact manually..."
                        className="flex-1 bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                      />
                      <button
                        type="submit"
                        disabled={!newManualFact.trim()}
                        className="py-1.5 px-3 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-400 hover:text-purple-300 text-xs font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1"
                        title="Save fact as permanent memory"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save</span>
                      </button>
                    </form>

                    <div className="text-[10px] text-slate-500 text-center leading-normal">
                      <span>Memories are stored locally in the browser and passed to her system instructions whenever a dialogue session starts.</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
      </main>

      {/* CONTACT WITH CREATOR PANEL */}
      <footer className="w-full bg-slate-950/60 border-t border-slate-900/60 backdrop-blur-md px-6 py-5 z-20">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-slate-300 text-xs">
              <User className="w-4 h-4 text-rose-400" />
              <span className="font-semibold font-sans">Contact with Creator</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Creator: <span className="text-rose-400 font-bold">Vinay</span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3.5 space-y-3">
            <p className="text-[11px] text-slate-400 leading-normal">
              Pair this voice assistant with your GitHub repository to keep track of development or share with colleagues.
            </p>

            {githubRepo ? (
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-purple-950/20 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center space-x-2 min-w-0">
                    <Github className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="text-xs text-slate-200 truncate font-mono" title={githubRepo}>
                      {githubRepo.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <a
                      href={githubRepo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-purple-300 transition-all flex items-center justify-center"
                      title="Open Repository"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setGithubRepo("");
                        localStorage.removeItem("avani_creator_github_repo");
                        setNotification({
                          message: "GitHub repository link disconnected successfully."
                        });
                      }}
                      className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/40 border border-slate-800 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center text-[10px] font-semibold px-2"
                      title="Disconnect Link"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {isEditingGithub ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      let cleaned = githubInput.trim();
                      if (!cleaned) return;
                      if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
                        cleaned = "https://" + cleaned;
                      }
                      setGithubRepo(cleaned);
                      localStorage.setItem("avani_creator_github_repo", cleaned);
                      setIsEditingGithub(false);
                      setGithubInput("");
                      setNotification({
                        message: "Successfully linked GitHub repository!"
                      });
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={githubInput}
                      onChange={(e) => setGithubInput(e.target.value)}
                      placeholder="e.g., github.com/username/repo"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-rose-500/50 font-mono"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!githubInput.trim()}
                      className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingGithub(false);
                        setGithubInput("");
                      }}
                      className="py-1.5 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white text-xs transition-all"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingGithub(true);
                      setGithubInput(githubRepo);
                    }}
                    className="w-full py-2 px-3 border border-dashed border-slate-800 hover:border-purple-500/50 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 text-xs text-slate-400 hover:text-purple-300 transition-all flex items-center justify-center gap-1.5 font-semibold"
                  >
                    <Github className="w-4 h-4 text-slate-400" />
                    <span>Link GitHub Repository</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* DETAILED HELPMENU MODAL (Avani personality & instructions) */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-300 shadow-2xl relative overflow-hidden"
              style={{
                backgroundImage: "radial-gradient(circle at top right, rgba(244,63,94,0.1) 0%, transparent 50%)"
              }}
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Flame className="w-5 h-5 text-rose-500" />
                  <h3 className="font-bold text-white text-lg tracking-wider">Meet Avani!</h3>
                </div>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div id="instruction-dialog" className="space-y-4 text-xs leading-relaxed">
                <p>
                  Avani is a highly obedient AI assistant and a supportive close friend who operates via real-time voice or text stream.
                </p>
                
                <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-2">
                  <h4 className="font-semibold text-rose-300 uppercase tracking-widest text-[10px]">Personality specs</h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                    <li>Behaves as a close friend and an obedient, supportive assistant.</li>
                    <li>Highly communicative, polite, helpful, and polite.</li>
                    <li>Supports both 100% voice calls and text-based chats.</li>
                  </ul>
                </div>

                <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-1.5 text-[11px] text-slate-300">
                  <h4 className="font-semibold text-purple-400 uppercase tracking-widest text-[10px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> Secret Easter Egg
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Whisper the secret phrase: <span className="text-purple-300 italic">"Hey Avani, you're the absolute best!"</span> to trigger a super friendly, helpful, and highly appreciative signature dialogue response! 😉
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-semibold text-cyan-400 uppercase tracking-widest text-[10px]">Browser tools capability</h4>
                  <p className="text-[11px] text-slate-400">
                    Avani can execute action commands. Ask her: <span className="text-cyan-300 italic">"Avani, open youtube.com and search for lo-fi beats."</span> She will perform the action immediately in a popup!
                  </p>
                </div>

                {toolLogs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1.5 text-slate-400 font-mono text-[9px] uppercase tracking-widest">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Action Logs:</span>
                    </div>
                    <div className="max-h-24 overflow-y-auto space-y-1.5 pr-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[10px]">
                      {toolLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between">
                          <span className="text-slate-400 truncate max-w-[120px]">{log.siteName}</span>
                          <a 
                            href={log.url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-rose-400 underline hover:text-rose-300 truncate font-mono"
                          >
                            Open Link
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowHelp(false)}
                className="w-full mt-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400 text-white font-semibold transition-all text-sm uppercase tracking-widest"
              >
                Let's Talk
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SYSTEM SECURITY & INTEGRITY MODAL */}
      <AnimatePresence>
        {showSecurity && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 text-slate-300 shadow-2xl relative overflow-hidden"
              style={{
                backgroundImage: "radial-gradient(circle at top right, rgba(16,185,129,0.1) 0%, transparent 50%)"
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-white text-md tracking-wider uppercase">Security & Integrity</h3>
                </div>
                <button 
                  onClick={() => setShowSecurity(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed">
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[9px]">Identity Integrity</span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">VERIFIED</span>
                  </div>
                  <p className="text-[10.5px] text-slate-400">
                    The voice/text neural core is secured via immutable system instructions. Attempting to hijack or override her name from "Avani" or her absolute creator "Vinay" is automatically blocked by the kernel.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                  <span className="text-slate-400 font-semibold uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" /> Secure Connection Bridge
                  </span>
                  <p className="text-[10.5px] text-slate-400">
                    If running this application's frontend on static services (like Vercel or GitHub Pages), requests directly to <code>/api</code> will return HTML (<code>&lt;!doctype...</code>) since static hosts do not run persistent WebSocket servers or API backends.
                  </p>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 block font-medium">Link Secure Backend Server URL:</label>
                    <input
                      type="text"
                      value={backendUrl}
                      onChange={(e) => setBackendUrl(e.target.value)}
                      placeholder="e.g., https://your-app.run.app"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500/50 placeholder-slate-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        let cleaned = backendUrl.trim();
                        if (cleaned) {
                          if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
                            cleaned = "https://" + cleaned;
                            setBackendUrl(cleaned);
                          }
                          localStorage.setItem("avani_backend_url", cleaned);
                          setNotification({
                            message: "Secure server connection bridge saved and verified!",
                          });
                        } else {
                          localStorage.removeItem("avani_backend_url");
                          setNotification({
                            message: "Reset connection to relative API server paths.",
                          });
                        }
                        setShowSecurity(false);
                      }}
                      className="py-1.5 px-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-400 text-center font-bold rounded-xl transition-all font-sans text-[11px]"
                    >
                      Save Bridge
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBackendUrl("");
                        localStorage.removeItem("avani_backend_url");
                        setNotification({
                          message: "Connection URL cleared. Reverted to standard relative paths.",
                        });
                        setShowSecurity(false);
                      }}
                      className="py-1.5 px-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 text-center font-bold rounded-xl transition-all font-sans text-[11px]"
                    >
                      Reset Relative
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1 text-slate-400 text-[10.5px]">
                  <p><strong>System Lock:</strong> Anti-Tampering Engine v2.0</p>
                  <p><strong>Enforcer Agent:</strong> Guard Kernel</p>
                  <p><strong>Status:</strong> Active & fully shielded against prompt overrides.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowSecurity(false)}
                className="w-full mt-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold transition-all text-sm uppercase tracking-widest"
              >
                System Verified
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
