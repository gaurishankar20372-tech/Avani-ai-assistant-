import { useState, useEffect, useRef, FormEvent } from "react";
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
  ChevronDown,
  ChevronUp,
  Plus,
  MessageSquare,
  Send
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
    return [
      {
        sender: "bot",
        content: "Hey there, handsome. 😉 I'm Shruti! Welcome to my chat logs. Ready to type out some juicy secrets with me or did you just want to put my sassy typing fingers to the test? Type away!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Interactive lists and logs
  const [toolLogs, setToolLogs] = useState<ToolLog[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [notification, setNotification] = useState<{ message: string; url?: string } | null>(null);

  // Permanent Memory States
  const [memories, setMemories] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("shruti_memories");
      return stored ? JSON.parse(stored) : [
        "My creator and master coder is Vinay.",
        "I was previously named Zoya, but my new name is Shruti."
      ];
    } catch {
      return [
        "My creator and master coder is Vinay.",
        "I was previously named Zoya, but my new name is Shruti."
      ];
    }
  });
  const [showMemories, setShowMemories] = useState(false);
  const [newManualFact, setNewManualFact] = useState("");

  // Sync memories with localStorage
  useEffect(() => {
    localStorage.setItem("shruti_memories", JSON.stringify(memories));
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

  // Determine Zoya's current active visual state
  const getZoyaState = (): "idle" | "connecting" | "listening" | "speaking" => {
    if (!isPowerOn || connectionStatus === "disconnected") return "idle";
    if (connectionStatus === "connecting") return "connecting";
    if (modelSpeaking) return "speaking";
    return "listening";
  };

  const activeState = getZoyaState();

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
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${wsProtocol}//${window.location.host}/api/live-ws?memories=${encodeURIComponent(JSON.stringify(memories))}`;
      
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

          if (msg.type === "interrupted") {
            console.log("Zoya was interrupted by user speech.");
            if (audioPlayerRef.current) {
              audioPlayerRef.current.clearQueue();
            }
            setModelSpeaking(false);
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

  // Toggle Zoya power
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
    if (!text.trim() || isChatLoading) return;
    const userMsg: ChatMessage = {
      sender: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };
    
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const historyToSend = chatMessages.map(msg => ({
        role: msg.sender === "bot" ? "assistant" : "user",
        content: msg.content
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          history: historyToSend,
          memories: memories
        })
      });

      if (!response.ok) {
        throw new Error("Failed to get chat response");
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        sender: "bot",
        content: data.reply || "Heh, I think something went wrong in my neural loops. Try typing that again, sweetheart.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setChatMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        sender: "bot",
        content: "Oops! My servers momentarily blushed. Let's try that again!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    } finally {
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
          setMemories((prev) => {
            if (prev.includes(fact)) return prev;
            return [...prev, fact];
          });
          setNotification({
            message: `Shruti permanently remembered: "${fact}"`,
          });
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              output: `Fact successfully saved to permanent memory: "${fact}".`
            }
          });
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
          setMemories((prev) => prev.filter((m) => m.toLowerCase() !== fact.toLowerCase()));
          setNotification({
            message: `Shruti forgot memory: "${fact}"`,
          });
          functionResponses.push({
            id: call.id,
            name: call.name,
            response: {
              output: `Fact successfully deleted from permanent memory: "${fact}".`
            }
          });
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

  // Pre-packaged conversational starters
  const suggestedTeasers = [
    { text: "“Tell me a witty, sassy joke”", trigger: "tell me a sassy joke" },
    { text: "“Hey, I'm Vinay, your creator”", trigger: "My name is Vinay. I am your creator." },
    { text: "“Unlock the secret phrase easter egg!”", trigger: "Hey Shruti, you're the absolute best!" },
    { text: "“Search youtube for high-tech synths”", trigger: "Search youtube for high-tech synths" },
  ];

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
              SHRUTI
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-indigo-300">VOICE AI v3.1</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
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
                <h4 className="text-sm font-semibold text-rose-200">Shruti executed a tool!</h4>
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
      <main className="flex-1 max-w-lg mx-auto w-full px-6 flex flex-col justify-center items-center py-6">
        
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
                      Ready to experience Shruti? Switch her on!
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
                      <p className="text-emerald-400 uppercase font-mono tracking-widest text-[9px] font-bold">SHRUTI IS LISTENING</p>
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
                      <p className="text-rose-400 uppercase font-mono tracking-widest text-[9px] font-bold">SHRUTI IS SPEAKING</p>
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
          <div className="w-full flex flex-col space-y-4 max-w-sm mt-2 mb-6">
            <div className="text-center space-y-1">
              <p className="text-purple-400 uppercase font-mono tracking-widest text-[10px]">Chat Mode Active</p>
              <h2 className="text-base font-semibold text-slate-100">
                Texting with Shruti
              </h2>
            </div>

            {/* Chat Box Container */}
            <div className="w-full bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col h-[320px] transition-all duration-300 shadow-xl overflow-hidden relative">
              {/* Message scroll list */}
              <div 
                className="flex-1 overflow-y-auto space-y-3 pr-1.5" 
                id="chat-scroller"
                style={{ scrollBehavior: 'smooth' }}
              >
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col max-w-[85%] ${
                      msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    }`}
                  >
                    <div
                      className={`px-3.5 py-2.5 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-gradient-to-br from-rose-600 to-pink-500 border border-pink-400/20 text-white rounded-br-none"
                          : "bg-slate-900/80 border border-slate-800 text-purple-100 rounded-bl-none"
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono mt-0.5 px-1">{msg.timestamp}</span>
                  </div>
                ))}
                
                {/* Loader / Typing animation */}
                {isChatLoading && (
                  <div className="mr-auto items-start flex flex-col max-w-[85%] animate-pulse">
                    <div className="px-3.5 py-2 rounded-2xl text-[11px] bg-slate-900/60 border border-slate-800 text-slate-400 rounded-bl-none flex items-center gap-1.5">
                      <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                      <span>Shruti is cooking up some sass...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Input section */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  sendChatMessage(chatInput);
                }}
                className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-800/60"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isChatLoading}
                  className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-purple-950/40"
                  title="Send message"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
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
                  Shruti's Memory Bank ({memories.length})
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
                        No permanent memories stored yet. Talk to Shruti and ask her to remember things!
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

      {/* QUICK SUGGESTIONS SECTION (Scrollable drawer / list) */}
      <footer className="w-full bg-slate-950/60 border-t border-slate-900/60 backdrop-blur-md px-6 py-5 z-20">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex items-center space-x-1 text-slate-400 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-semibold text-slate-300 font-sans">Sassy Shruti Teasers & Prompts</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
            {suggestedTeasers.map((teaser, idx) => (
              <button
                key={idx}
                disabled={appMode === "voice" && activeState !== "listening"}
                onClick={() => {
                  if (appMode === "chat") {
                    sendChatMessage(teaser.trigger);
                  } else {
                    setNotification({
                      message: `Say this to your microphone: "${teaser.trigger}"`,
                    });
                  }
                }}
                className="p-2.5 rounded-xl border border-slate-900 hover:border-indigo-900/60 bg-slate-900/30 text-[11px] text-slate-400 hover:text-slate-300 transition-all text-left disabled:opacity-30 disabled:pointer-events-none hover:bg-slate-900/70"
              >
                {teaser.text}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* DETAILED HELPMENU MODAL (Zoya personality & instructions) */}
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
                  <h3 className="font-bold text-white text-lg tracking-wider">Meet Shruti!</h3>
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
                  Shruti is a super confident, flirty, sass-filled real-time voice assistant who operates exclusively via live audio stream.
                </p>
                
                <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-2">
                  <h4 className="font-semibold text-rose-300 uppercase tracking-widest text-[10px]">Personality specs</h4>
                  <ul className="list-disc pl-4 space-y-1.5 text-slate-400">
                    <li>Teasing, playful tone like a smart close girlfriend.</li>
                    <li>Saves a high doses of charming sarcasm for you.</li>
                    <li>100% voice only—Shruti speaks solely via audio.</li>
                  </ul>
                </div>

                <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-1.5 text-[11px] text-slate-300">
                  <h4 className="font-semibold text-purple-400 uppercase tracking-widest text-[10px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" /> Secret Easter Egg
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Whisper the secret phrase: <span className="text-purple-300 italic">"Hey Shruti, you're the absolute best!"</span> to trigger an extra flirty and sassy dialogue response not heard in regular conversation! 😉
                  </p>
                </div>

                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <h4 className="font-semibold text-cyan-400 uppercase tracking-widest text-[10px]">Browser tools capability</h4>
                  <p className="text-[11px] text-slate-400">
                    Shruti can execute action commands. Ask her: <span className="text-cyan-300 italic">"Shruti, open youtube.com and search for lo-fi beats."</span> She will perform the action immediately in a popup!
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
    </div>
  );
}
