import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { SimulatorAction } from '../../shared/types';
import AttackerTerminal from './real/AttackerTerminal';
import ControlBar from './real/ControlBar';
import DemoTokenControl from './real/DemoTokenControl';
import MetricsBar from './real/MetricsBar';
import { CachePanel, EventStream, LlmPanel } from './real/SidePanels';
import SessionDrawer from './real/SessionDrawer';
import SpotlightTour, { type TourStep } from './real/SpotlightTour';
import TopologyMap from './real/TopologyMap';
import { readDemoToken } from '../demoToken';
import { useGrid } from '../useGrid';

const EXPECTED_REQUESTS: Record<SimulatorAction, number> = {
  legitimate: 2,
  sqli: 2,
  recon: 3,
  novel: 1,
  scrape: 2,
  portcullis: 0,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => { window.setTimeout(resolve, ms); });
}

function buildTourSteps(aiReady: boolean): TourStep[] {
  return [
    {
      id: 'legitimate',
      targetId: 'sim-legitimate',
      title: 'A normal visitor',
      body: 'This sends a normal request through the front gate. It reaches the real app and no AI is used. Click Next to send it.',
    },
    {
      id: 'sqli',
      targetId: 'sim-sqli',
      title: 'A known SQL trick',
      body: 'This sends a classic SQL injection pattern. The gate recognizes it instantly and serves a saved fake database. Click Next to send it.',
    },
    {
      id: 'novel',
      targetId: 'sim-novel',
      title: 'A new kind of request',
      body: aiReady
        ? 'This request is not in the rule book. The AI invents a fake table once, then saves it so the same trick is free next time. Click Next to send it.'
        : 'This request is not in the rule book. A built-in rule invents a fake table once, then saves it so the same trick is free next time. Click Next to send it.',
    },
    {
      id: 'map',
      targetId: 'traffic-map',
      title: 'Watch the traffic map',
      body: 'Each dot is a real session. Normal visitors go to the real app. Suspicious ones are sent to the fake city. Click Next to continue.',
    },
    {
      id: 'report',
      targetId: 'session-report-panel',
      title: 'Read the incident report',
      body: 'This report explains what the attacker tried, what fake assets they touched, and what to do next. Click Next to continue.',
    },
    {
      id: 'gate',
      targetId: 'gate-toggle',
      title: 'The 403 gate',
      body: 'When the gate is on, hostile traffic gets a hard 403 response instead of a decoy. Normal visitors still pass through. Click Next to turn it on and finish.',
    },
  ];
}

export default function RealDashboard() {
  const {
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
  } = useGrid();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [split, setSplit] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisRequestId, setAnalysisRequestId] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const [tourStep, setTourStep] = useState<number | null>(null);
  const demoRunningRef = useRef(false);
  const tourStepRef = useRef<number | null>(null);
  const tourSessionIdRef = useRef<string | null>(null);
  const tourAnalysisTriggeredRef = useRef(false);
  const tourAdvancingRef = useRef(false);
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (analysis && analysis.sessionId === analysisRequestId) setAnalyzing(false);
  }, [analysis, analysisRequestId]);

  useEffect(() => {
    const latest = responses[0];
    if (latest && latest.disposition !== 'passthrough') setSelectedId(latest.sessionId);
  }, [responses]);

  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);

  const selectedSession = useMemo(
    () => snapshot?.sessions.find((s) => s.id === selectedId) ?? null,
    [snapshot, selectedId],
  );

  const engaged = snapshot?.portcullis.engaged ?? false;
  const ready = snapshot !== null;
  const aiReady = snapshot?.llm.configured ?? false;
  const busy = !ready || pending.length > 0 || actionBusy || demoStatus !== null || tourStep !== null;
  const demoAdminRequired = snapshot?.demo.adminTokenRequired ?? false;
  const tourSteps = useMemo(() => buildTourSteps(aiReady), [aiReady]);

  const blockWithoutToken = useCallback((message: string) => {
    if (!snapshot) {
      pushToast('warn', 'The grid is still connecting. Try again in a moment.');
      return true;
    }
    if (!demoAdminRequired || readDemoToken()) return false;
    pushToast('warn', message);
    return true;
  }, [demoAdminRequired, pushToast, snapshot]);

  const inspect = useCallback((id: string) => {
    setSelectedId(id);
    setDrawerOpen(true);
  }, []);

  const waitForResponses = useCallback(async (baseline: number, expected: number, timeoutMs: number) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const arrived = responseCountRef.current - baseline;
      if (arrived >= expected && pendingRef.current.length === 0) return;
      await sleep(120);
    }
  }, [pendingRef, responseCountRef]);

  const runAction = useCallback(async (action: SimulatorAction) => {
    if (blockWithoutToken('Simulator actions need the demo token. Use the lock icon in the top bar.')) return;
    const baseline = responseCountRef.current;
    send({ type: 'simulate', action });
    const expected = EXPECTED_REQUESTS[action];
    if (expected === 0) { await sleep(650); return; }
    const timeout = action === 'scrape' ? 30_000 : action === 'novel' ? 24_000 : 18_000;
    await waitForResponses(baseline, expected, timeout);
  }, [blockWithoutToken, responseCountRef, send, waitForResponses]);

  const onSimulate = useCallback(async (action: SimulatorAction) => {
    if (demoRunningRef.current || tourStepRef.current !== null) return;
    setActionBusy(true);
    try { await runAction(action); } finally { setActionBusy(false); }
  }, [runAction]);

  const onReset = useCallback(async () => {
    if (demoRunningRef.current || tourStepRef.current !== null) return;
    if (blockWithoutToken('Reset needs the demo token. Use the lock icon in the top bar.')) return;
    setActionBusy(true);
    clear();
    setSelectedId(null);
    setDrawerOpen(false);
    setDemoStatus(null);
    setAnalyzing(false);
    setAnalysisRequestId(null);
    send({ type: 'reset' });
    await sleep(500);
    setActionBusy(false);
  }, [blockWithoutToken, clear, send]);

  const onPlayDemo = useCallback(async (_event?: MouseEvent<HTMLButtonElement>) => {
    if (demoRunningRef.current) return;
    if (blockWithoutToken('Unlock the demo with the lock icon to play the whole story.')) return;
    demoRunningRef.current = true;
    setActionBusy(true);
    clear();
    setSelectedId(null);
    setDrawerOpen(false);
    setAnalyzing(false);
    setAnalysisRequestId(null);
    setDemoStatus('Getting ready');
    send({ type: 'reset' });
    await sleep(650);

    const steps: Array<{ status: string; action: SimulatorAction }> = [
      { status: 'Step 1 of 6: a normal visitor', action: 'legitimate' },
      { status: 'Step 2 of 6: a known SQL trick', action: 'sqli' },
      { status: 'Step 3 of 6: a secret file scan', action: 'recon' },
      { status: 'Step 4 of 6: a new kind of request', action: 'novel' },
      { status: 'Step 5 of 6: a scraper slowed down', action: 'scrape' },
      { status: 'Step 6 of 6: the 403 gate', action: 'portcullis' },
    ];

    try {
      for (const step of steps) {
        setDemoStatus(step.status);
        await runAction(step.action);
      }
      setDemoStatus('Putting the gate back');
      send({ type: 'portcullis', engaged: false });
      await sleep(600);
      setDemoStatus('Done');
      await sleep(1200);
    } finally {
      demoRunningRef.current = false;
      setActionBusy(false);
      setDemoStatus(null);
    }
  }, [blockWithoutToken, clear, runAction, send]);

  const onAnalyze = (sessionId: string, forceAi: boolean) => {
    if (blockWithoutToken('Reports need the demo token. Use the lock icon in the top bar.')) return;
    setAnalyzing(true);
    setAnalysisRequestId(sessionId);
    setDrawerOpen(true);
    send({ type: 'analyze', sessionId, forceAi });
  };

  const finishTour = useCallback(() => {
    tourStepRef.current = null;
    tourAdvancingRef.current = false;
    tourAnalysisTriggeredRef.current = false;
    tourSessionIdRef.current = null;
    setTourStep(null);
    setDrawerOpen(false);
    setAnalyzing(false);
    setAnalysisRequestId(null);
    setActionBusy(false);
    send({ type: 'portcullis', engaged: false });
  }, [send]);

  const enterTourStep = useCallback(async (index: number) => {
    tourStepRef.current = index;
    setTourStep(index);

    if (index === 3) { setDrawerOpen(false); return; }

    if (index === 4) {
      const hostile = snapshotRef.current?.sessions.find((s) => s.status !== 'legitimate') ?? null;
      if (hostile) {
        if (tourSessionIdRef.current !== hostile.id) {
          tourSessionIdRef.current = hostile.id;
          tourAnalysisTriggeredRef.current = false;
        }
        setSelectedId(hostile.id);
        setDrawerOpen(true);
        if (!tourAnalysisTriggeredRef.current) {
          tourAnalysisTriggeredRef.current = true;
          setAnalyzing(true);
          setAnalysisRequestId(hostile.id);
          send({ type: 'analyze', sessionId: hostile.id, forceAi: true });
        }
      }
      return;
    }

    if (index === 5) setDrawerOpen(false);
  }, [send]);

  const startTour = useCallback(async (_event?: MouseEvent<HTMLButtonElement>) => {
    if (demoRunningRef.current || tourStepRef.current !== null) return;
    if (blockWithoutToken('Unlock the demo with the lock icon to take the tour.')) return;
    setActionBusy(true);
    clear();
    setSelectedId(null);
    setDrawerOpen(false);
    setDemoStatus(null);
    setAnalyzing(false);
    setAnalysisRequestId(null);
    tourAnalysisTriggeredRef.current = false;
    tourSessionIdRef.current = null;
    send({ type: 'reset' });
    await sleep(250);
    await enterTourStep(0);
  }, [blockWithoutToken, clear, enterTourStep, send]);

  const advanceTour = useCallback(async () => {
    const index = tourStepRef.current;
    if (index === null || tourAdvancingRef.current) return;
    tourAdvancingRef.current = true;
    try {
      if (index < 3) {
        const actions = ['legitimate', 'sqli', 'novel'] as const;
        send({ type: 'simulate', action: actions[index] });
        await sleep(140);
        await enterTourStep(index + 1);
        return;
      }
      if (index === 3 || index === 4) {
        await enterTourStep(index + 1);
        return;
      }
      send({ type: 'simulate', action: 'portcullis' });
      await sleep(1000);
      finishTour();
    } finally {
      tourAdvancingRef.current = false;
    }
  }, [enterTourStep, finishTour, send]);

  const backTour = useCallback(() => {
    const index = tourStepRef.current;
    if (index === null || index === 0) return;
    void enterTourStep(index - 1);
  }, [enterTourStep]);

  return (
    <section id="economics" className="relative py-16 md:py-24 lg:py-32">
      <div className="mx-auto max-w-[1800px] px-4 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[65ch] flex-col gap-4">
            <span className="tnum text-xs font-semibold tracking-[0.24em] text-accent uppercase">Live demo</span>
            <h2 className="max-w-[18ch] text-[clamp(2rem,4.4vw,3.5rem)] leading-[1.08]">Send a real request.</h2>
            <p className="max-w-[65ch] text-base leading-relaxed text-muted md:text-lg">
              Every button below hits the real backend. Watch the gate decide, the decoy answer, and the report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`tag ${connected ? 'border-pass/35 bg-pass/[0.07] text-pass' : 'border-accent/40 bg-accent/[0.07] text-accent'}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-pass' : 'bg-accent'}`} />
              {connected ? 'Live updates on' : snapshot ? 'Reconnecting' : 'Connecting'}
            </span>
            <span className={`tag ${snapshot?.llm.configured ? 'border-plum/35 bg-plum/[0.07] text-plum' : 'border-line text-muted'}`}>
              {snapshot?.llm.configured ? 'AI ready' : 'Using saved decoys'}
            </span>
            <span className={`tag ${engaged ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted'}`}>
              <span className={`h-2 w-2 rounded-full ${engaged ? 'bg-accent' : 'bg-muted'}`} />
              {engaged ? '403 gate on' : '403 gate off'}
            </span>
            <DemoTokenControl required={demoAdminRequired} onMessage={pushToast} />
            <span className="tag border-line text-muted num">{clock.toISOString().slice(11, 19)} UTC</span>
            <button
              onClick={() => setSplit((v) => !v)}
              className="btn btn-quiet min-h-11 px-4 py-2 text-xs"
              aria-pressed={split}
            >
              {split ? 'Hide attacker view' : 'Show attacker view'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <MetricsBar snapshot={snapshot} />

          <ControlBar
            onSimulate={onSimulate}
            onPlayDemo={onPlayDemo}
            onTakeTour={(e) => void startTour(e)}
            onReset={onReset}
            engaged={engaged}
            busy={busy}
            demoStatus={demoStatus}
            aiReady={aiReady}
          />

          <div className={`grid gap-6 ${split ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
            <div className="min-w-0 space-y-6">
              <SectionHeading eyebrow="Defender view" title="Where the traffic goes" description="Click any colored dot or request to inspect what that visitor tried." />
              <TopologyMap snapshot={snapshot} selectedId={selectedId} onSelect={inspect} />
              <div className="grid gap-6 lg:grid-cols-2">
                <EventStream events={snapshot?.events ?? []} onSelect={inspect} selectedId={selectedId} />
                <CachePanel snapshot={snapshot} />
              </div>
              {!split && <LlmPanel snapshot={snapshot} />}
            </div>

            {split && (
              <div className="min-w-0 space-y-6">
                <SectionHeading eyebrow="Attacker view" title="What they actually see" description="These are the real bytes returned by the fake city. None of this data is real." />
                <AttackerTerminal responses={responses} pending={pending} onInspect={inspect} />
                <LlmPanel snapshot={snapshot} />
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-muted">
            <span>瓮城 · Fake city, real requests</span>
            <span className="num">
              {snapshot?.totals.requests ?? 0} checked · {snapshot?.totals.diverted ?? 0} sent to the fake city · {(snapshot?.totals.secondsWasted ?? 0).toFixed(1)} seconds wasted by attackers
            </span>
          </footer>
        </div>
      </div>

      <SessionDrawer
        session={selectedSession}
        open={drawerOpen}
        latestAnalysis={analysis}
        analyzing={analyzing}
        aiReady={aiReady}
        onClose={() => setDrawerOpen(false)}
        onAnalyze={onAnalyze}
      />

      {tourStep !== null && (
        <SpotlightTour
          steps={tourSteps}
          currentStep={tourStep}
          onNext={() => void advanceTour()}
          onBack={backTour}
          onSkip={finishTour}
        />
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] space-y-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast-enter rounded-xl border bg-surface px-4 py-2 text-xs ${
              toast.level === 'warn' ? 'border-accent/50 text-accent' : toast.level === 'success' ? 'border-pass/50 text-pass' : 'border-accent/50 text-accent'
            }`}
          >
            {toast.message.replace(/\s\u2014\s/g, ', ')}
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="section-label">{eyebrow}</div>
        <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      <p className="max-w-[52ch] text-xs leading-relaxed text-muted">{description}</p>
    </div>
  );
}
