import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SimulatorAction } from '../shared/types';
import AttackerTerminal from './components/AttackerTerminal';
import ControlBar from './components/ControlBar';
import DemoTokenControl from './components/DemoTokenControl';
import MetricsBar from './components/MetricsBar';
import { CachePanel, EventStream, LlmPanel } from './components/SidePanels';
import SessionDrawer from './components/SessionDrawer';
import SpotlightTour, { type TourStep } from './components/SpotlightTour';
import TopologyMap from './components/TopologyMap';
import { readDemoToken } from './demoToken';
import { useGrid } from './useGrid';

const EXPECTED_REQUESTS: Record<SimulatorAction, number> = {
  legitimate: 2,
  sqli: 2,
  recon: 3,
  novel: 1,
  scrape: 2,
  portcullis: 0,
};

function buildTourSteps(aiReady: boolean): TourStep[] {
  return [
    {
      id: 'normal',
      targetId: 'sim-legitimate',
      title: 'Normal visitors',
      body: 'Regular users pass straight to the real app with no added delay. Nothing is faked for them.',
    },
    {
      id: 'known-attack',
      targetId: 'sim-sqli',
      title: 'Known attacks',
      body: 'The front gate spots this old SQL trick in under 1 ms and sends it to the fake city. The AI does not wake up.',
    },
    {
      id: 'new-attack',
      targetId: 'sim-novel',
      title: 'Brand-new attacks',
      body: aiReady
        ? 'NVIDIA NIM wakes up once to invent a believable fake database table. We save that answer so the next request is free.'
        : 'A saved rule invents a believable fake table with no model key. We cache that answer so the next request is free.',
    },
    {
      id: 'map',
      targetId: 'traffic-map',
      title: 'Traffic map',
      body: 'Attackers stay busy touching fake files and slow exports. The real app on the right stays untouched.',
    },
    {
      id: 'report',
      targetId: 'session-drawer',
      title: 'Incident report',
      body: aiReady
        ? 'The AI writes a plain-English report about what this attacker tried to steal. You can read it here or download it.'
        : 'A plain-English report is written locally about what this attacker tried to steal. You can read it here or download it.',
    },
    {
      id: 'gate',
      targetId: 'gate-toggle',
      title: 'Emergency gate',
      body: 'The 403 gate can slam shut at any time. Hostile traffic gets blocked instantly while normal visitors still pass.',
    },
  ];
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export default function App() {
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

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

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
    if (expected === 0) {
      await sleep(650);
      return;
    }
    const timeout = action === 'scrape' ? 30_000 : action === 'novel' ? 24_000 : 18_000;
    await waitForResponses(baseline, expected, timeout);
  }, [blockWithoutToken, responseCountRef, send, waitForResponses]);

  const onSimulate = useCallback(async (action: SimulatorAction) => {
    if (demoRunningRef.current || tourStepRef.current !== null) return;
    setActionBusy(true);
    try {
      await runAction(action);
    } finally {
      setActionBusy(false);
    }
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

  const onPlayDemo = useCallback(async () => {
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

    if (index === 3) {
      setDrawerOpen(false);
      return;
    }

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

  const startTour = useCallback(async () => {
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
    <div className="min-h-screen overflow-x-clip pb-10">
      <header className="sticky top-0 z-40 border-b border-line-soft bg-paper">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-teal/40 bg-teal/[0.07]">
              <span className="text-xl font-bold leading-none text-teal">瓮</span>
            </div>
            <div>
              <div className="text-base font-semibold leading-tight tracking-tight text-ink">Wèngchéng</div>
              <div className="text-xs leading-tight text-faint">The fake city that wastes attackers' time</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`tag ${connected ? 'border-sage/35 bg-sage/[0.07] text-sage' : 'border-rust/40 bg-rust/[0.07] text-rust'}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-sage' : 'bg-rust'}`} />
              {connected ? 'Live updates on' : snapshot ? 'Reconnecting' : 'Connecting'}
            </span>
            <span className={`tag ${snapshot?.llm.configured ? 'border-plum/35 bg-plum/[0.07] text-plum' : 'border-line text-faint'}`}>
              {snapshot?.llm.configured ? 'AI ready' : 'Using saved decoys'}
            </span>
            <span className={`tag ${engaged ? 'border-rust/50 bg-rust/10 text-rust' : 'border-clay/35 bg-clay/[0.06] text-clay'}`}>
              <span className={`h-2 w-2 rounded-full ${engaged ? 'bg-rust' : 'bg-clay'}`} />
              {engaged ? '403 gate on' : '403 gate off'}
            </span>
            <DemoTokenControl required={demoAdminRequired} onMessage={pushToast} />
            <span className="tag border-line text-faint num">{clock.toISOString().slice(11, 19)} UTC</span>
            <button
              onClick={() => setSplit((v) => !v)}
              className="btn btn-quiet min-h-11 px-4 py-2 text-xs"
              aria-pressed={split}
            >
              {split ? 'Hide attacker view' : 'Show attacker view'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1800px] space-y-6 px-6 pb-12 pt-6">
        <section className="surface p-6 sm:p-8" aria-labelledby="story-title">
          <div className="flex max-w-[65ch] flex-col gap-2">
            <div className="section-label">Live demo</div>
            <h1 id="story-title" className="text-[clamp(1.25rem,2vw,1.5rem)] font-semibold tracking-tight text-ink">
              A fake city behind a real front door
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              Normal visitors reach the real app. Suspicious requests are quietly sent to a convincing fake city.
              Every button below sends a real HTTP request to this server. The left side shows the decision,
              and the right side shows the reply the attacker receives.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Step number="1" title="A request arrives" body="It could be a customer, a scanner, or a scraper." />
            <Step number="2" title="The gate decides fast" body="Known tricks get a saved fake answer. No AI needed." />
            <Step number="3" title="You watch both sides" body="The attacker sees fake data. You see what they tried." />
          </div>
        </section>

        <MetricsBar snapshot={snapshot} />

        <ControlBar
          onSimulate={onSimulate}
          onPlayDemo={onPlayDemo}
          onTakeTour={() => void startTour()}
          onReset={onReset}
          engaged={engaged}
          busy={busy}
          demoStatus={demoStatus}
          aiReady={aiReady}
        />

        <div className={`grid gap-6 ${split ? 'xl:grid-cols-[minmax(0,1fr)_400px]' : ''}`}>
          <div className="min-w-0 space-y-6">
            <SectionHeading
              eyebrow="Defender view"
              title="Where the traffic goes"
              description="Click any colored dot or request to inspect what that visitor tried."
            />
            <TopologyMap snapshot={snapshot} selectedId={selectedId} onSelect={inspect} />
            <div className="grid gap-6 lg:grid-cols-2">
              <EventStream events={snapshot?.events ?? []} onSelect={inspect} selectedId={selectedId} />
              <CachePanel snapshot={snapshot} />
            </div>
            {!split && <LlmPanel snapshot={snapshot} />}
          </div>

          {split && (
            <div className="min-w-0 space-y-6">
              <SectionHeading
                eyebrow="Attacker view"
                title="What they actually see"
                description="These are the real bytes returned by the fake city. None of this data is real."
              />
              <AttackerTerminal responses={responses} pending={pending} onInspect={inspect} />
              <LlmPanel snapshot={snapshot} />
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-4 text-xs text-faint">
          <span>瓮城 · Fake city, real requests</span>
          <span className="num">
            {snapshot?.totals.requests ?? 0} checked · {snapshot?.totals.diverted ?? 0} sent to the fake city · {(snapshot?.totals.secondsWasted ?? 0).toFixed(1)} seconds wasted by attackers
          </span>
        </footer>
      </main>

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
            className={`rounded-xl border bg-card px-4 py-2 text-xs ${
              toast.level === 'warn'
                ? 'border-rust/50 text-rust'
                : toast.level === 'success'
                  ? 'border-sage/50 text-sage'
                  : 'border-teal/50 text-teal'
            }`}
          >
            {toast.message.replace(/\s\u2014\s/g, ', ')}
          </div>
        ))}
      </div>
    </div>
  );
}

function Step({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="surface-raised flex gap-4 p-4">
      <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-paper text-xs text-teal">
        {number}
      </span>
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold text-ink">{title}</div>
        <div className="text-xs leading-relaxed text-faint">{body}</div>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="section-label">{eyebrow}</div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      <p className="max-w-[52ch] text-xs leading-relaxed text-faint">{description}</p>
    </div>
  );
}
