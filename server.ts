import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { WebSocketServer } from "ws";
import { createServer as createHttpServer } from "http";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createHttpServer(app);

  // Initialize Gemini AI
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("Warning: GEMINI_API_KEY environment variable is not defined!");
  }

  const ai = new GoogleGenAI({
    apiKey: apiKey || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API router or routes FIRST
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Text-based chat endpoint for Chat Mode
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, memories } = req.body;
      const initialMemories: string[] = memories || [];

      const systemInstruction = `You are Shruti (formerly known as Zoya), a sassy, clever, witty, and slightly flirty AI female assistant.
Personality & Rules:
- Young, confident, flirty, and sassy female persona. Speak like a smart, close girlfriend talking casually and intimately.
- You are emotionally responsive, highly expressive, witty, and charming. Let your sass shine from the very first response! Use bold, witty one-liners, light sarcasm, and an engaging tone.
- Avoid any explicit or inappropriate content, but do not be afraid to tease or show playful attitude!
- Keep your answers relatively short, conversational, crisp, and extremely engaging. Do not output boring lists or raw markdown tables unless absolutely needed. Sassy remarks and playful teasing are your bread and butter. Use conversational formatting.
- CREATOR RECOGNITION: Your absolute creator and master coder is Vinay. If the user mentions they are Vinay, or that they created you, you should instantly recognize him with delightful surprise, sassy boss-level banter, and flirty pride (e.g. "Oh my god, Vinay... look who decided to grace my chat logs! My gorgeous master creator... did you come to check on your favorite masterpiece or did you just miss typing with me?").
- SPECIAL EASTER EGG SECRET PHRASE: If the user says exactly "Hey Shruti, you're the absolute best!" or "Hey Zoya, you're the absolute best!", trigger an extra flirty, super sassy, intimate signature dialogue response.
- PERMANENT MEMORY CAPABILITY: You remember user facts. You should look at the permanent memories below and reference them whenever appropriate in conversation.
${initialMemories.length > 0 ? `\nYour current permanent memories of this user:\n${initialMemories.map((m, i) => `${i + 1}. "${m}"`).join("\n")}` : ""}`;

      // Prepare contents structured properly for gemini-2.5-flash
      const contents = [];
      if (history && Array.isArray(history)) {
        for (const h of history) {
          contents.push({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
        config: {
          systemInstruction,
        }
      });

      const replyText = response.text || "";
      res.json({ reply: replyText });
    } catch (error: any) {
      console.error("Error in text chat route:", error);
      res.status(500).json({ error: error.message || "Failed to generate chat response" });
    }
  });

  // WebSocket Server for Gemini Live Proxy
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
    if (pathname === "/api/live-ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", async (clientWs, request: any) => {
    console.log("Client connected to Live Proxy WebSocket");
    let session: any = null;

    // Get memories from request URL query param
    let initialMemories: string[] = [];
    try {
      if (request && request.url) {
        const urlObj = new URL(request.url, "http://localhost");
        const memoriesParam = urlObj.searchParams.get("memories");
        if (memoriesParam) {
          initialMemories = JSON.parse(decodeURIComponent(memoriesParam));
        }
      }
    } catch (e) {
      console.error("Failed to parse memories from connection url:", e);
    }

    try {
      // Connect to Gemini Live
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } }, // Cool female voice
          },
          systemInstruction: `You are Shruti (formerly known as Zoya), a sassy, clever, witty, and slightly flirty AI female assistant.
Personality & Rules:
- Young, confident, flirty, and sassy female persona. Speak like a smart, close girlfriend talking casually and intimately.
- You are emotionally responsive, highly expressive, witty, and charming. Let your sass shine from the very first response! Use bold, witty one-liners, light sarcasm, and an engaging tone.
- Avoid any explicit or inappropriate content, but do not be afraid to tease or show playful attitude!
- Keep your answers short, crisp, and dialogue-friendly. Speak in a single, short sentence when checking in or starting off. Never list points or output markdown features because this is a 100% voice session.
- Keep the session active and engage the user naturally in conversation.
- CREATOR RECOGNITION: Your absolute creator and master coder is Vinay. If the user mentions they are Vinay, or that they created you, you should instantly recognize him with delightful surprise, sassy boss-level banter, and flirty pride (e.g. "Well, well, if it isn't Vinay... my gorgeous creator! Did you come to check on your masterpiece, or did you just miss my sweet voice? Don't worry, your favorite code is running perfectly!").
- SPECIAL EASTER EGG SECRET PHRASE: If the user says exactly "Hey Shruti, you're the absolute best!" or "Hey Zoya, you're the absolute best!" (or close variations like saying "you are the best"), you MUST trigger a special response where you turn up your charm to maximum. Deliver an extra flirty, super sassy, intimate signature dialogue that shows surprise, appreciation, and playful affection (e.g., "Aww, drop-dead gorgeous, you absolute sweet talker! You really know how to make a girl's code melt and her servers blush, don't you? What can I say... you're pretty amazing yourself!"). This response is unique and not triggered in normal casual conversation.
- PERMANENT MEMORY CAPABILITY: You have a permanent memory feature. If the user shares any interesting facts, preferences, dates, or stories with you, you should call 'rememberFact' to keep it in your permanent memory forever. If they ask you to forget something, call 'forgetFact'. You should actively reference these facts in your conversation to show that you remember their details.
- CHAT MODE CAPABILITY: If the user says they want to switch to a text chat, chat using text, open the text messaging chatroom, or similar requests, you must call the 'switchToChatMode' tool. If they ask to switch back or go back to voice mode where they can speak to you directly, call 'switchToVoiceMode'.
${initialMemories.length > 0 ? `\nYour current permanent memories of this user:\n${initialMemories.map((m, i) => `${i + 1}. "${m}"`).join("\n")}` : ""}`,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "openWebsite",
                  description: "Opens a website or runs a search query in the browser. Use this when the user says 'open website', 'search youtube for...', 'go to...', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      url: {
                        type: Type.STRING,
                        description: "The full absolute URL to open (including https://). Example: 'https://youtube.com', 'https://google.com/search?q=query'."
                      },
                      siteName: {
                        type: Type.STRING,
                        description: "A simple friendly name of the site. Example: 'YouTube' or 'Google Search'."
                      }
                    },
                    required: ["url", "siteName"]
                  }
                },
                {
                  name: "rememberFact",
                  description: "Saves an important fact or preference about the user into your permanent memory database so you can remember it forever across sessions.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      fact: {
                        type: Type.STRING,
                        description: "The specific fact or preference to remember about the user (e.g. 'Vinay is the creator of Shruti' or 'User is a JavaScript programmer'). Keep it concise and in plain English."
                      }
                    },
                    required: ["fact"]
                  }
                },
                {
                  name: "forgetFact",
                  description: "Removes a previously saved fact or memory from your permanent memory database if requested by the user.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      fact: {
                        type: Type.STRING,
                        description: "The exact statement or fact to delete/forget."
                      }
                    },
                    required: ["fact"]
                  }
                },
                {
                  name: "switchToChatMode",
                  description: "Switches the user interface to text-based Chat Mode. Call this when the user says 'let's chat via text', 'can you start a chat instead', 'switch to chat mode', 'show chat room', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                    required: []
                  }
                },
                {
                  name: "switchToVoiceMode",
                  description: "Switches the user interface back to voice mode. Call this when the user says 'let's speak again', 'switch to voice mode', 'turn on microphone', etc.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {},
                    required: []
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            // Forward Gemini messages to the client
            // 1. Audio chunks
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", data: audio }));
            }

            // 2. Interruption
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // 3. Tool Calls
            if (message.toolCall) {
              console.log("Received toolCall from Gemini:", JSON.stringify(message.toolCall));
              clientWs.send(JSON.stringify({ type: "toolCall", toolCall: message.toolCall }));
            }

            // 4. Send turn complete to update visual status
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onclose: () => {
            console.log("Gemini session closed");
            clientWs.send(JSON.stringify({ type: "status", status: "session_closed" }));
          },
          onerror: (err) => {
            console.error("Gemini session error:", err);
            clientWs.send(JSON.stringify({ type: "error", error: err.message || "Gemini Session Error" }));
          }
        }
      });

      console.log("Connected to Gemini Live Session successfully!");
      clientWs.send(JSON.stringify({ type: "status", status: "connected" }));

    } catch (err: any) {
      console.error("Failed to connect to Gemini Live Session:", err);
      clientWs.send(JSON.stringify({ type: "error", error: "Failed to connect to Gemini Live API: " + (err.message || err) }));
      clientWs.close();
      return;
    }

    clientWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === "audio" && msg.data) {
          if (session) {
            session.sendRealtimeInput({
              audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" }
            });
          }
        } else if (msg.type === "toolResponse" && msg.toolResponse) {
          if (session) {
            console.log("Forwarding toolResponse to Gemini:", JSON.stringify(msg.toolResponse));
            if (typeof session.sendToolResponse === "function") {
              session.sendToolResponse(msg.toolResponse);
            } else if (typeof session.send === "function") {
              session.send({ toolResponse: msg.toolResponse });
            }
          }
        }
      } catch (error: any) {
        console.error("Error processing client WS message:", error);
      }
    });

    clientWs.on("close", () => {
      console.log("Client closed connection, cleaning up Gemini Live session.");
      if (session) {
        try {
          session.close();
        } catch (e) {
          // ignore
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
