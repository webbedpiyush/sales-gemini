"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveSessionBootstrap } from "@/lib/types/domain";

interface LiveSessionPanelProps {
  callId: string;
  agentId: number;
  defaultObjections: string[];
}

const LIVE_WS_BASE =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

const PUBLIC_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? "";

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, targetRate: number) {
  if (targetRate === inputRate) {
    return buffer;
  }

  const ratio = inputRate / targetRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;

    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i += 1) {
      accum += buffer[i];
      count += 1;
    }

    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult += 1;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function pcm16ToFloat32(pcmBytes: Uint8Array): Float32Array {
  const dataView = new DataView(
    pcmBytes.buffer,
    pcmBytes.byteOffset,
    pcmBytes.byteLength,
  );
  const sampleCount = Math.floor(pcmBytes.byteLength / 2);
  const output = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const sample = dataView.getInt16(i * 2, true);
    output[i] = sample / 32768;
  }

  return output;
}

function getSampleRateFromMimeType(mimeType?: string): number {
  if (!mimeType) return 24000;
  const rateMatch = mimeType.match(/rate=(\d+)/);
  if (!rateMatch) return 24000;
  return Number(rateMatch[1]) || 24000;
}

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  if (!value || typeof value !== "object") return null;
  return value as AnyRecord;
}

function extractText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  const obj = asRecord(value);
  if (!obj) return null;

  const direct =
    (typeof obj.text === "string" && obj.text) ||
    (typeof obj.transcript === "string" && obj.transcript) ||
    null;
  if (direct) return direct.trim() || null;

  const results = Array.isArray(obj.results) ? obj.results : [];
  const firstResult = asRecord(results[0]);
  const alternatives = firstResult && Array.isArray(firstResult.alternatives)
    ? firstResult.alternatives
    : [];
  const firstAlternative = asRecord(alternatives[0]);
  if (firstAlternative && typeof firstAlternative.transcript === "string") {
    return firstAlternative.transcript.trim() || null;
  }
  return null;
}

export function LiveSessionPanel({
  callId,
  agentId,
  defaultObjections,
}: LiveSessionPanelProps) {
  const [selectedObjections, setSelectedObjections] =
    useState<string[]>(defaultObjections.slice(0, 2));
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [connectionState, setConnectionState] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<LiveSessionBootstrap | null>(null);
  const [transcriptTurns, setTranscriptTurns] = useState<
    Array<{ speaker: "rep" | "buyer"; text: string; timestamp: string }>
  >([]);
  const [messageCount, setMessageCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextPlaybackTimeRef = useRef<number>(0);
  const micStartedRef = useRef(false);

  const promptPreview = useMemo(() => {
    if (!session) {
      return "Click 'Connect Live Session' to generate Gemini Live session bootstrap.";
    }
    return session.systemInstruction.slice(0, 700);
  }, [session]);

  const transcriptStorageKey = useMemo(
    () => `pitchperfect:call:${callId}:transcript`,
    [callId],
  );

  function toggleObjection(objection: string) {
    setSelectedObjections((previous) =>
      previous.includes(objection)
        ? previous.filter((item) => item !== objection)
        : [...previous, objection],
    );
  }

  async function connectSession() {
    setLoading(true);
    setError(null);
    setSession(null);

    try {
      const response = await fetch("/api/live/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          runtimeObjections: selectedObjections,
        }),
      });

      const data = (await response.json()) as LiveSessionBootstrap & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to initialize session");
      }

      setSession(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unknown error",
      );
    } finally {
      setLoading(false);
    }
  }

  const cleanupStreamingResources = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();

    if (inputAudioContextRef.current) {
      void inputAudioContextRef.current.close();
    }
    if (outputAudioContextRef.current) {
      void outputAudioContextRef.current.close();
    }

    micStreamRef.current?.getTracks().forEach((track) => track.stop());

    processorRef.current = null;
    sourceRef.current = null;
    inputAudioContextRef.current = null;
    outputAudioContextRef.current = null;
    micStreamRef.current = null;
    wsRef.current = null;
    nextPlaybackTimeRef.current = 0;
    micStartedRef.current = false;
  }, []);

  const stopStreaming = useCallback(() => {
    wsRef.current?.close();
    cleanupStreamingResources();
    setStreaming(false);
    setConnectionState("Stopped");
  }, [cleanupStreamingResources]);

  async function playAudioChunk(base64Data: string, mimeType?: string) {
    const bytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const sampleRate = getSampleRateFromMimeType(mimeType);
    const audioFloats = pcm16ToFloat32(bytes);

    if (!outputAudioContextRef.current) {
      outputAudioContextRef.current = new AudioContext({ sampleRate });
      nextPlaybackTimeRef.current = outputAudioContextRef.current.currentTime;
    }

    const outputContext = outputAudioContextRef.current;
    const buffer = outputContext.createBuffer(1, audioFloats.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    channelData.set(audioFloats);

    const source = outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(outputContext.destination);

    const startAt = Math.max(nextPlaybackTimeRef.current, outputContext.currentTime);
    source.start(startAt);
    nextPlaybackTimeRef.current = startAt + buffer.duration;
  }

  const recordTranscriptTurn = useCallback(
    (speaker: "rep" | "buyer", text: string) => {
      const cleaned = text.replace(/\s+/g, " ").trim();
      if (!cleaned) return;
      if (cleaned.length < 2) return;

      setTranscriptTurns((previous) => {
        const lastTurn = previous[previous.length - 1];
        if (lastTurn && lastTurn.speaker === speaker) {
          if (lastTurn.text === cleaned) {
            return previous;
          }

          // Collapse streaming partials into a single turn:
          // - if new text extends prior text, keep the new one
          // - if new text is shorter (intermediate partial), keep the longer previous
          // - if they differ without prefix relation, append as continuation
          if (cleaned.startsWith(lastTurn.text)) {
            return [
              ...previous.slice(0, -1),
              {
                ...lastTurn,
                text: cleaned,
              },
            ];
          }

          if (lastTurn.text.startsWith(cleaned)) {
            return previous;
          }

          return [
            ...previous.slice(0, -1),
            {
              ...lastTurn,
              text: `${lastTurn.text} ${cleaned}`.replace(/\s+/g, " ").trim(),
            },
          ];
        }

        return [
          ...previous,
          {
            speaker,
            text: cleaned,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    },
    [],
  );

  async function startStreaming() {
    if (!session) {
      setError("Create session bootstrap first.");
      return;
    }
    if (!PUBLIC_API_KEY) {
      setError(
        "Missing NEXT_PUBLIC_GEMINI_API_KEY. Add it in web/.env.local and restart dev server.",
      );
      return;
    }

    setError(null);
    setConnectionState("Connecting");
    setMessageCount(0);

    try {
      const wsUrl = `${LIVE_WS_BASE}?key=${encodeURIComponent(PUBLIC_API_KEY)}`;
      const websocket = new WebSocket(wsUrl);
      wsRef.current = websocket;

      const startMicCapture = async () => {
        if (micStartedRef.current) {
          return;
        }
        micStartedRef.current = true;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micStreamRef.current = stream;

        const inputAudioContext = new AudioContext();
        inputAudioContextRef.current = inputAudioContext;
        const source = inputAudioContext.createMediaStreamSource(stream);
        sourceRef.current = source;

        const processor = inputAudioContext.createScriptProcessor(2048, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(inputAudioContext.destination);

        processor.onaudioprocess = (event) => {
          if (websocket.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const downsampled = downsampleBuffer(
            channelData,
            inputAudioContext.sampleRate,
            16000,
          );
          const pcm16 = floatTo16BitPCM(downsampled);
          const pcmBytes = new Uint8Array(pcm16.buffer);
          const base64Audio = uint8ToBase64(pcmBytes);

          websocket.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  data: base64Audio,
                  mimeType: "audio/pcm;rate=16000",
                },
              },
            }),
          );
        };
      };

      websocket.onopen = async () => {
        try {
          setConnectionState("Configuring");

          websocket.send(
            JSON.stringify({
              setup: {
                model: `models/${session.model}`,
                generationConfig: {
                  responseModalities: session.responseModalities,
                },
                inputAudioTranscription: {},
                outputAudioTranscription: {},
                systemInstruction: {
                  parts: [{ text: session.systemInstruction }],
                },
              },
            }),
          );
        } catch (openError) {
          setConnectionState("Error");
          setError(
            openError instanceof Error
              ? openError.message
              : "Failed to start microphone stream.",
          );
          websocket.close();
          cleanupStreamingResources();
          setStreaming(false);
        }
      };

      websocket.onmessage = async (event) => {
        let raw: string;
        if (typeof event.data === "string") {
          raw = event.data;
        } else if (event.data instanceof Blob) {
          raw = await event.data.text();
        } else {
          return; // skip non-text/binary messages
        }
        let response: AnyRecord;
        try {
          response = JSON.parse(raw);
        } catch {
          return; // skip non-JSON (e.g. binary) messages
        }
        setMessageCount((current) => current + 1);

        const errorObj = asRecord(response.error);
        const errorMessage =
          (errorObj && typeof errorObj.message === "string" && errorObj.message) || null;
        if (errorMessage) {
          setError(`Gemini error: ${errorMessage}`);
          setConnectionState("Error");
        }

        const setupComplete =
          "setupComplete" in response || "setup_complete" in response;

        const content = asRecord(response.serverContent) ?? asRecord(response.server_content);

        if (setupComplete && !streaming) {
          try {
            await startMicCapture();
            setConnectionState("Live");
            setStreaming(true);
          } catch (micError) {
            setConnectionState("Error");
            setError(
              micError instanceof Error
                ? micError.message
                : "Failed to start microphone stream.",
            );
            websocket.close();
          }
          return;
        }

        if (!micStartedRef.current && content) {
          // Fallback in case setupComplete is not emitted by model version.
          try {
            await startMicCapture();
            setConnectionState("Live");
            setStreaming(true);
          } catch (micError) {
            setConnectionState("Error");
            setError(
              micError instanceof Error
                ? micError.message
                : "Failed to start microphone stream.",
            );
            websocket.close();
          }
        }

        const inputText =
          extractText(content?.inputTranscription ?? content?.input_transcription) ??
          extractText(response.inputTranscription ?? response.input_transcription) ??
          extractText(response.userTranscription ?? response.user_transcription);
        if (inputText) {
          recordTranscriptTurn("rep", inputText);
        }

        if (!content) return;

        let outputText = extractText(
          content.outputTranscription ?? content.output_transcription,
        );

        // Fallback: some responses emit text parts in modelTurn instead of outputTranscription.
        if (!outputText) {
          const modelTurn =
            asRecord(content.modelTurn) ?? asRecord(content.model_turn);
          const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];
          const textPart = parts
            .map((part) => asRecord(part))
            .find((part) => part && typeof part.text === "string");
          if (textPart && typeof textPart.text === "string") {
            outputText = textPart.text.trim();
          }
        }

        if (outputText) {
          recordTranscriptTurn("buyer", outputText);
        }

        const modelTurn = asRecord(content.modelTurn) ?? asRecord(content.model_turn);
        const parts = Array.isArray(modelTurn?.parts) ? modelTurn.parts : [];
        for (const part of parts) {
          const partRecord = asRecord(part);
          const audio =
            asRecord(partRecord?.inlineData) ?? asRecord(partRecord?.inline_data);
          if (audio && typeof audio.data === "string") {
            const mimeType = typeof audio.mimeType === "string" ? audio.mimeType : undefined;
            await playAudioChunk(audio.data, mimeType);
          }
        }
      };

      websocket.onerror = () => {
        setConnectionState("Error");
        setError("Gemini Live WebSocket error.");
      };

      websocket.onclose = (event) => {
        cleanupStreamingResources();
        setStreaming(false);
        if (event.code === 1000) {
          setConnectionState("Closed");
          return;
        }

        const reason =
          event.reason?.trim() || `WebSocket closed with code ${event.code}`;
        setConnectionState("Closed");
        setError(`Gemini connection closed: ${reason}`);
      };
    } catch (streamError) {
      setConnectionState("Error");
      setError(streamError instanceof Error ? streamError.message : "Unknown error");
      stopStreaming();
    }
  }

  useEffect(() => {
    setTranscriptTurns([]);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(transcriptStorageKey);
    }
  }, [transcriptStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(
      transcriptStorageKey,
      JSON.stringify({
        callId,
        agentId,
        turns: transcriptTurns,
        savedAt: new Date().toISOString(),
      }),
    );
  }, [agentId, callId, transcriptStorageKey, transcriptTurns]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm">
      <h2 className="text-lg font-semibold">Session Controls</h2>
      <p className="mt-1 text-sm text-slate-600">
        Select objections, initialize Gemini Live, then start voice.
      </p>

      <div className="mt-4 grid gap-2">
        {defaultObjections.slice(0, 4).map((objection) => (
          <label
            key={objection}
            className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selectedObjections.includes(objection)}
              onChange={() => toggleObjection(objection)}
              className="mt-1"
            />
            <span>{objection}</span>
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={connectSession}
          disabled={loading}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700"
        >
          {loading ? "Connecting..." : "Connect Live Session"}
        </button>
        <button
          type="button"
          onClick={startStreaming}
          disabled={!session || streaming}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-sky-800"
        >
          Start Voice
        </button>
        <button
          type="button"
          onClick={stopStreaming}
          disabled={!streaming}
          className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          Stop Voice
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

      {session ? (
        <div className="mt-4 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm md:grid-cols-2">
          <p>
            Status:{" "}
            <span className="font-semibold">
              {session.status === "ready"
                ? "Ready (GEMINI_API_KEY detected)"
                : "Missing GEMINI_API_KEY"}
            </span>
          </p>
          <p className="mt-1">Model: {session.model}</p>
          <p className="mt-1">Session ID: {session.sessionId}</p>
          <p className="mt-1">Voice: {session.voiceName}</p>
          <p className="mt-1">Connection: {connectionState}</p>
          <p className="mt-1">Messages received: {messageCount}</p>
        </div>
      ) : null}

      <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-500">
          Prompt Preview
        </summary>
        <pre className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
          {promptPreview}
          {session && session.systemInstruction.length > 700 ? "\n..." : ""}
        </pre>
      </details>
    </section>
  );
}
