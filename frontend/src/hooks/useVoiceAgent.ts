"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";

export type VoiceAgentStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type AgentMode = "speaking" | "listening";

interface UseVoiceAgentArgs {
  storyId: string;
  currentPage: number;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

export function useVoiceAgent({
  storyId,
  currentPage,
  onSessionStart,
  onSessionEnd,
}: UseVoiceAgentArgs) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceAgentStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const isFirstSessionRef = useRef(true);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const connect = useCallback(async () => {
    if (status === "connecting" || status === "connected") return;
    setStatus("connecting");
    setError(null);

    try {
      const result = await api.startConversation(
        storyId,
        currentPageRef.current,
        isFirstSessionRef.current,
      );
      agentIdRef.current = result.agent_id;
      setSignedUrl(result.signed_url);
      isFirstSessionRef.current = false;
      onSessionStart?.();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to connect");
      agentIdRef.current = null;
    }
  }, [storyId, status, onSessionStart]);

  const disconnect = useCallback(async () => {
    const agentId = agentIdRef.current;
    setSignedUrl(null);
    setStatus("idle");
    setError(null);
    agentIdRef.current = null;

    if (agentId) {
      api.endConversation(storyId, agentId).catch(() => {});
    }

    onSessionEnd?.();
  }, [storyId, onSessionEnd]);

  const handleConversationConnect = useCallback(() => {
    setStatus("connected");
  }, []);

  const handleConversationDisconnect = useCallback(() => {
    setStatus("idle");
    setSignedUrl(null);
    const agentId = agentIdRef.current;
    agentIdRef.current = null;
    if (agentId) {
      api.endConversation(storyId, agentId).catch(() => {});
    }
    onSessionEnd?.();
  }, [storyId, onSessionEnd]);

  const handleConversationError = useCallback(
    (err: unknown) => {
      console.error("[VoiceAgent] conversation error:", err);
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Conversation error"
      );
      const agentId = agentIdRef.current;
      agentIdRef.current = null;
      if (agentId) {
        api.endConversation(storyId, agentId).catch(() => {});
      }
    },
    [storyId]
  );

  return {
    signedUrl,
    status,
    error,
    connect,
    disconnect,
    handleConversationConnect,
    handleConversationDisconnect,
    handleConversationError,
  };
}
