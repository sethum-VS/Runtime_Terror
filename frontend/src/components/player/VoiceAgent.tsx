"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ConversationProvider,
  useConversation,
} from "@elevenlabs/react";
import {
  useVoiceAgent,
  type VoiceAgentStatus,
} from "@/hooks/useVoiceAgent";

interface VoiceAgentProps {
  storyId: string;
  currentPage: number;
  onPauseStoryAudio: () => void;
  onResumeStoryAudio: () => void;
}

export function VoiceAgent(props: VoiceAgentProps) {
  const [micMuted, setMicMuted] = useState(true);

  return (
    <ConversationProvider isMuted={micMuted} onMutedChange={setMicMuted}>
      <VoiceAgentInner {...props} micMuted={micMuted} setMicMuted={setMicMuted} />
    </ConversationProvider>
  );
}

function VoiceAgentInner({
  storyId,
  currentPage,
  onPauseStoryAudio,
  onResumeStoryAudio,
  micMuted,
  setMicMuted,
}: VoiceAgentProps & {
  micMuted: boolean;
  setMicMuted: (muted: boolean) => void;
}) {
  const sessionStartedRef = useRef(false);

  const agent = useVoiceAgent({
    storyId,
    currentPage,
    onSessionStart: onPauseStoryAudio,
    onSessionEnd: onResumeStoryAudio,
  });

  const conversation = useConversation({
    micMuted: true,
    onConnect: () => {
      agent.handleConversationConnect();
      setMicMuted(true);
    },
    onDisconnect: () => {
      sessionStartedRef.current = false;
      setMicMuted(true);
      agent.handleConversationDisconnect();
    },
    onError: agent.handleConversationError,
  });

  const stopSession = useCallback(() => {
    try {
      conversation.setVolume({ volume: 0 });
    } catch {
      /* no active session */
    }
    setMicMuted(true);
    conversation.endSession();
    agent.disconnect();
    sessionStartedRef.current = false;
  }, [conversation, agent, setMicMuted]);

  useEffect(() => {
    if (
      agent.signedUrl &&
      conversation.status === "disconnected" &&
      !sessionStartedRef.current
    ) {
      sessionStartedRef.current = true;
      conversation.startSession({ signedUrl: agent.signedUrl });
    }
  }, [agent.signedUrl, conversation]);

  const isConnected = agent.status === "connected";
  const isConnecting = agent.status === "connecting";

  const handleMicToggle = useCallback(() => {
    if (agent.status === "idle" || agent.status === "error") {
      agent.connect();
      return;
    }
    if (isConnecting) return;
    if (!isConnected) return;

    if (micMuted) {
      conversation.setVolume({ volume: 1 });
      conversation.setMuted(false);
    } else {
      conversation.setMuted(true);
    }
  }, [agent, conversation, isConnected, isConnecting, micMuted]);

  const handleOrbClick = useCallback(() => {
    if (isConnected) {
      stopSession();
    }
  }, [isConnected, stopSession]);

  return (
    <div className="flex items-center justify-center gap-3">
      <TalkingOrb
        agentStatus={agent.status}
        isSpeaking={conversation.isSpeaking}
        isListening={conversation.isListening && !micMuted}
        micMuted={micMuted}
        onClick={handleOrbClick}
      />
      <MicButton
        isConnected={isConnected}
        isConnecting={isConnecting}
        micMuted={micMuted}
        onClick={handleMicToggle}
      />
      <AnimatePresence>
        {agent.error && (
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="font-label-sm text-label-sm text-error max-w-[160px] truncate"
          >
            {agent.error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function TalkingOrb({
  agentStatus,
  isSpeaking,
  isListening,
  micMuted,
  onClick,
}: {
  agentStatus: VoiceAgentStatus;
  isSpeaking: boolean;
  isListening: boolean;
  micMuted: boolean;
  onClick: () => void;
}) {
  const isConnected = agentStatus === "connected";
  const isConnecting = agentStatus === "connecting";

  const orbSize = isSpeaking ? 56 : isListening ? 48 : 44;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isConnected}
      className="relative flex items-center justify-center disabled:cursor-default"
      aria-label={isConnected ? "Stop narrator session" : "Narrator orb"}
      style={{ width: 72, height: 72 }}
    >
      {/* Speaking: smooth orbiting rings */}
      <AnimatePresence>
        {isConnected && isSpeaking && (
          <>
            <motion.div
              key="orbit-1"
              className="absolute rounded-full border-[1.5px] border-secondary/70"
              style={{ width: 62, height: 62 }}
              initial={{ opacity: 0, rotate: 0, scale: 0.8 }}
              animate={{ opacity: [0.4, 0.8, 0.4], rotate: 360, scale: [0.95, 1.1, 0.95] }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              key="orbit-2"
              className="absolute rounded-full border-[1.5px] border-secondary/50"
              style={{ width: 68, height: 68 }}
              initial={{ opacity: 0, rotate: 180, scale: 0.9 }}
              animate={{ opacity: [0.3, 0.6, 0.3], rotate: -360, scale: [1, 1.08, 1] }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              key="glow"
              className="absolute rounded-full bg-secondary/10"
              style={{ width: 70, height: 70 }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.3, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Listening: gentle breathing ring */}
      <AnimatePresence>
        {isConnected && isListening && (
          <motion.div
            key="listen-ring"
            className="absolute rounded-full border-[1.5px] border-primary/40"
            style={{ width: 60, height: 60 }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{
              scale: [0.92, 1.06, 0.92],
              opacity: [0.25, 0.55, 0.25],
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Core orb */}
      <motion.div
        className={`rounded-full flex items-center justify-center shadow-lg transition-colors duration-300 ${
          isConnecting
            ? "bg-surface-container-high"
            : isConnected && isSpeaking
              ? "bg-secondary shadow-secondary/30"
              : isConnected && isListening
                ? "bg-primary shadow-primary/30"
                : isConnected
                  ? "bg-primary/80 shadow-primary/20"
                  : "bg-surface-container-high"
        }`}
        animate={{ width: orbSize, height: orbSize }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {isConnecting ? (
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant animate-spin">
            progress_activity
          </span>
        ) : isConnected ? (
          <motion.span
            className={`material-symbols-outlined text-[22px] ${
              isSpeaking
                ? "text-on-secondary"
                : "text-on-primary"
            }`}
            animate={isSpeaking ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={
              isSpeaking
                ? { duration: 1, repeat: Infinity, ease: "easeInOut" }
                : {}
            }
          >
            {isSpeaking
              ? "graphic_eq"
              : isListening
                ? "hearing"
                : "record_voice_over"}
          </motion.span>
        ) : (
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            record_voice_over
          </span>
        )}
      </motion.div>

      {/* Connected idle glow — session active but not speaking/listening */}
      {isConnected && !isSpeaking && !isListening && (
        <motion.div
          className="absolute rounded-full border-[1.5px] border-primary/30"
          style={{ width: 58, height: 58 }}
          animate={{
            scale: [1, 1.06, 1],
            opacity: [0.3, 0.55, 0.3],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Disconnected idle ambient pulse */}
      {agentStatus === "idle" && (
        <motion.div
          className="absolute rounded-full bg-on-surface/5"
          style={{ width: 52, height: 52 }}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.08, 0.18, 0.08],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </button>
  );
}

function MicButton({
  isConnected,
  isConnecting,
  micMuted,
  onClick,
}: {
  isConnected: boolean;
  isConnecting: boolean;
  micMuted: boolean;
  onClick: () => void;
}) {
  const showLive = isConnected && !micMuted;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isConnecting}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        showLive
          ? "bg-primary text-on-primary hover:bg-primary/90 shadow-md"
          : isConnected && micMuted
            ? "bg-secondary-container text-on-secondary-container hover:bg-secondary-container/80"
            : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"
      }`}
      aria-label={
        !isConnected
          ? "Start conversation with narrator"
          : micMuted
            ? "Unmute microphone"
            : "Mute microphone"
      }
    >
      <span className="material-symbols-outlined text-[20px]">
        {!isConnected ? "mic" : micMuted ? "mic_off" : "mic"}
      </span>
    </button>
  );
}
