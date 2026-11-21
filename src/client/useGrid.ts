import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ClientCommand,
  ServerMessage,
  SimulatorResponse,
  TelemetrySnapshot,
  ThreatAnalysis,
} from '../shared/types';
import { captureDemoTokenFromUrl, readDemoToken } from './demoToken';

export interface Toast {
  id: number;
  level: 'info' | 'warn' | 'success';
  message: string;
}

export interface SimulatorStatus {
  id: string;
  label: string;
  phase: 'start' | 'done';
  sessionId: string;
  path: string;
}

export function useGrid() {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [responses, setResponses] = useState<SimulatorResponse[]>([]);
  const [pending, setPending] = useState<SimulatorStatus[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [analysis, setAnalysis] = useState<ThreatAnalysis | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const toastId = useRef(0);
  const responseCountRef = useRef(0);
  const pendingRef = useRef<SimulatorStatus[]>([]);

  const clear = useCallback(() => {
    setResponses([]);
    setPending([]);
    setAnalysis(null);
    setToasts([]);
    responseCountRef.current = 0;
    pendingRef.current = [];
  }, []);

  const pushToast = useCallback((level: Toast['level'], message: string) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { id, level, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4800);
  }, []);

  const send = useCallback((command: ClientCommand) => {
    const token = readDemoToken();
    const wireCommand: ClientCommand = token ? { ...command, token } : command;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(wireCommand));
      return;
    }
    void fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wireCommand),
    }).catch(() => pushToast('warn', 'Control plane unreachable'));
  }, [pushToast]);

  useEffect(() => {
    captureDemoTokenFromUrl();
    let disposed = false;
    let retry = 0;

    const connect = () => {
      if (disposed) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!disposed) retry = window.setTimeout(connect, 1800);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as ServerMessage;
          switch (message.type) {
            case 'snapshot':
              setSnapshot(message.payload as TelemetrySnapshot);
              break;
            case 'simulator-response': {
              const response = message.payload as SimulatorResponse;
              setResponses((prev) => [response, ...prev].slice(0, 40));
              responseCountRef.current += 1;
              const nextPending = pendingRef.current.filter((p) => p.id !== response.id);
              pendingRef.current = nextPending;
              setPending(nextPending);
              break;
            }
            case 'simulator-status': {
              const status = message.payload as SimulatorStatus;
              const nextPending = [...pendingRef.current.filter((p) => p.id !== status.id), status].slice(-8);
              pendingRef.current = nextPending;
              setPending(nextPending);
              break;
            }
            case 'analysis-ready':
              setAnalysis(message.payload as ThreatAnalysis);
              break;
            case 'toast': {
              const payload = message.payload as { level: Toast['level']; message: string };
              pushToast(payload.level, payload.message);
              break;
            }
          }
        } catch {
          // Ignore malformed frames; the next snapshot repairs state.
        }
      };
    };

    connect();
    const poll = window.setInterval(() => {
      void fetch('/api/snapshot')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: TelemetrySnapshot | null) => { if (data && !disposed) setSnapshot(data); })
        .catch(() => undefined);
    }, 2600);

    return () => {
      disposed = true;
      window.clearTimeout(retry);
      window.clearInterval(poll);
      wsRef.current?.close();
    };
  }, [pushToast]);

  return {
    snapshot,
    responses,
    pending,
    toasts,
    analysis,
    connected,
    send,
    pushToast,
    clear,
    responseCountRef,
    pendingRef,
  };
}
