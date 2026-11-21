import { useEffect, useState } from 'react';
import { clearDemoToken, readDemoToken, saveDemoToken } from '../demoToken';

interface Props {
  required: boolean;
  onMessage: (level: 'info' | 'warn' | 'success', message: string) => void;
}

export default function DemoTokenControl({ required, onMessage }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => readDemoToken());
  const [stored, setStored] = useState(() => Boolean(readDemoToken()));

  useEffect(() => {
    const token = readDemoToken();
    setValue(token);
    setStored(Boolean(token));
  }, []);

  if (!required) return null;

  const handleSave = () => {
    const token = value.trim();
    if (!token) {
      clearDemoToken();
      setStored(false);
      onMessage('warn', 'Enter a demo token first.');
      return;
    }
    saveDemoToken(token);
    setStored(true);
    setOpen(false);
    onMessage('success', 'Demo token saved for this tab.');
  };

  const handleClear = () => {
    clearDemoToken();
    setValue('');
    setStored(false);
    onMessage('info', 'Demo token cleared for this tab.');
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="btn btn-quiet min-h-[38px] px-2.5 py-1.5 text-xs"
        onClick={() => setOpen((visible) => !visible)}
        aria-label="Demo access token"
        aria-expanded={open}
        title="Demo access token"
      >
        <LockIcon locked={!stored} />
      </button>

      {open && (
        <div className="surface-raised absolute right-0 top-full z-50 mt-2 w-72 p-3">
          <div className="text-xs font-semibold text-ink">Demo access token</div>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Saved for this tab only. Needed for the 403 gate, new AI decoys, AI reports, and reset.
          </p>
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') handleSave(); }}
            className="focus-ring mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs text-ink"
            placeholder="Paste demo token"
            autoComplete="off"
            spellCheck={false}
            aria-label="Demo token"
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-primary min-h-[34px] flex-1 px-2 py-1 text-xs" onClick={handleSave}>
              Save token
            </button>
            <button type="button" className="btn btn-quiet min-h-[34px] px-2 py-1 text-xs" onClick={handleClear} disabled={!stored}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.4 7V5.4a2.6 2.6 0 0 1 5.2 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="10.2" r="1.1" fill={locked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}
