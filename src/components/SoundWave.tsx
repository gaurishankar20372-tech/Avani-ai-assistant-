import React from "react";
import { motion } from "motion/react";

interface SoundWaveProps {
  state: "idle" | "connecting" | "listening" | "speaking";
}

export const SoundWave: React.FC<SoundWaveProps> = ({ state }) => {
  // Wave bars or ribbon properties for the "speaking" frequency bars
  const speakingBars = Array.from({ length: 12 }, (_, i) => i);

  // Breathing rings for the "listening" and "connecting" states
  const rings = Array.from({ length: 3 }, (_, i) => i);

  return (
    <div id="soundwave-container" className="relative flex items-center justify-center w-72 h-72 mx-auto">
      {/* Background radial glow */}
      <div
        id="bg-radial-glow"
        className={`absolute inset-0 rounded-full blur-3xl opacity-30 transition-all duration-1000 ${
          state === "idle"
            ? "bg-slate-800"
            : state === "connecting"
            ? "bg-purple-600 scale-110"
            : state === "listening"
            ? "bg-emerald-600 scale-125"
            : "bg-pink-600 scale-150 animate-pulse"
        }`}
      />

      {/* Connecting & Listening concentric waves */}
      {(state === "connecting" || state === "listening") &&
        rings.map((index) => (
          <motion.div
            key={index}
            id={`ring-${index}`}
            className={`absolute rounded-full border ${
              state === "connecting" ? "border-purple-500/40" : "border-emerald-400/40"
            }`}
            style={{ width: "100%", height: "100%" }}
            initial={{ scale: 0.4, opacity: 1 }}
            animate={{
              scale: 1.2,
              opacity: 0,
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              delay: index * 0.8,
              ease: "easeOut",
            }}
          />
        ))}

      {/* Speaking frequency bar visualizer */}
      {state === "speaking" && (
        <div id="speaking-bars" className="absolute inset-0 flex items-center justify-between px-10">
          {speakingBars.map((bar) => {
            const delay = bar * 0.08;
            return (
              <motion.div
                key={bar}
                id={`bar-${bar}`}
                className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 via-pink-500 to-rose-400"
                initial={{ height: 12 }}
                animate={{
                  height: [12, Math.random() * 120 + 20, 12],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.6 + Math.random() * 0.4,
                  delay,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Core Orb */}
      <motion.div
        id="core-orb-outer"
        className={`relative z-10 flex items-center justify-center w-36 h-36 rounded-full transition-all duration-700 shadow-2xl ${
          state === "idle"
            ? "bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-slate-700"
            : state === "connecting"
            ? "bg-gradient-to-tr from-indigo-950 via-purple-900 to-indigo-900 border border-purple-400/40 shadow-purple-500/50"
            : state === "listening"
            ? "bg-gradient-to-tr from-teal-950 via-emerald-900 to-teal-900 border border-emerald-400/50 shadow-emerald-400/40"
            : "bg-gradient-to-tr from-rose-950 via-pink-900 to-purple-950 border border-rose-400/60 shadow-pink-500/55"
        }`}
        animate={
          state === "listening"
            ? { scale: [1, 1.05, 1] }
            : state === "speaking"
            ? { scale: [1, 1.08, 0.98, 1.04, 1] }
            : { scale: 1 }
        }
        transition={
          state === "listening"
            ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
            : state === "speaking"
            ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      >
        {/* Neon Core Glow Particle */}
        <motion.div
          id="core-orb-inner"
          className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 ${
            state === "idle"
              ? "bg-slate-950/80"
              : state === "connecting"
              ? "bg-purple-950/60 backdrop-blur-md"
              : state === "listening"
              ? "bg-emerald-950/60 backdrop-blur-md"
              : "bg-rose-950/60 backdrop-blur-md"
          }`}
        >
          {/* Avani branding inside the core or mic icon */}
          <div className="flex flex-col items-center justify-center text-center">
            {state === "idle" && (
              <span className="text-2xl font-semibold tracking-wider text-slate-500 font-sans">A</span>
            )}
            {state === "connecting" && (
              <motion.div
                className="w-8 h-8 rounded-full border-2 border-purple-400 border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              />
            )}
            {state === "listening" && (
              <motion.div
                className="flex flex-col items-center"
                animate={{ scale: [0.9, 1.1, 0.9] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength="1"
                    d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"
                  />
                </svg>
                <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300 mt-1">Listening</span>
              </motion.div>
            )}
            {state === "speaking" && (
              <motion.div
                className="flex flex-col items-center"
                animate={{ scale: [1, 0.9, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              >
                <span className="text-3xl font-extrabold tracking-widest text-rose-300 font-sans drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]">
                  AVANI
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest text-rose-400 mt-0.5">Speaking</span>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Futuristic Orbit Rings for premium style */}
      {state !== "idle" && (
        <motion.div
          id="orbit-ring-1"
          className={`absolute rounded-full border-2 border-dashed pointer-events-none ${
            state === "connecting"
              ? "border-purple-500/20 w-44 h-44"
              : state === "listening"
              ? "border-emerald-400/25 w-48 h-48"
              : "border-pink-500/30 w-52 h-52"
          }`}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
        />
      )}
      {state !== "idle" && (
        <motion.div
          id="orbit-ring-2"
          className={`absolute rounded-full border border-dashed pointer-events-none ${
            state === "connecting"
              ? "border-purple-400/10 w-52 h-52"
              : state === "listening"
              ? "border-emerald-300/15 w-56 h-56"
              : "border-rose-400/20 w-60 h-60"
          }`}
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 45, ease: "linear" }}
        />
      )}
    </div>
  );
};
