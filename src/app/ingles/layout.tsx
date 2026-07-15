import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "English Practice",
  description: "Sistema de repaso espaciado para aprender inglés",
};

export default function EnglishLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        .en-root {
          --en-bg: #0b0c18;
          --en-surface: #12142a;
          --en-surface-2: #1a1d3a;
          --en-surface-3: #222546;
          --en-accent: #6366f1;
          --en-accent-hover: #818cf8;
          --en-gold: #fbbf24;
          --en-gold-dim: rgba(251,191,36,0.12);
          --en-text: #e8eaf6;
          --en-text-2: #9496b0;
          --en-text-3: #5c5f7a;
          --en-border: rgba(255,255,255,0.07);
          --en-green: #34d399;
          --en-green-dim: rgba(52,211,153,0.12);
          --en-red: #f87171;
          --en-red-dim: rgba(248,113,113,0.12);
          --en-orange: #fb923c;
          --en-orange-dim: rgba(251,146,60,0.12);
          --en-radius: 18px;
          --en-radius-sm: 12px;
        }

        .en-root * {
          box-sizing: border-box;
        }

        .en-root input, .en-root textarea {
          font-family: inherit;
        }

        .en-root button {
          font-family: inherit;
          cursor: pointer;
          border: none;
          outline: none;
        }

        .en-btn-primary {
          background: var(--en-accent);
          color: #fff;
          border-radius: var(--en-radius-sm);
          padding: 14px 24px;
          font-weight: 700;
          font-size: 15px;
          transition: background 0.15s, transform 0.1s;
          width: 100%;
        }
        .en-btn-primary:hover { background: var(--en-accent-hover); }
        .en-btn-primary:active { transform: scale(0.98); }
        .en-btn-primary:disabled { opacity: 0.35; cursor: default; }

        .en-btn-secondary {
          background: var(--en-surface-2);
          color: var(--en-text);
          border-radius: var(--en-radius-sm);
          padding: 12px 20px;
          font-weight: 600;
          font-size: 14px;
          border: 1px solid var(--en-border);
          transition: background 0.15s;
        }
        .en-btn-secondary:hover { background: var(--en-surface-3); }

        .en-card {
          background: var(--en-surface);
          border: 1px solid var(--en-border);
          border-radius: var(--en-radius);
          padding: 20px;
        }

        .en-input {
          background: var(--en-surface-2);
          border: 1.5px solid var(--en-border);
          color: var(--en-text);
          border-radius: var(--en-radius-sm);
          padding: 12px 16px;
          font-size: 15px;
          width: 100%;
          outline: none;
          transition: border-color 0.15s;
          resize: none;
        }
        .en-input:focus {
          border-color: var(--en-accent);
        }
        .en-input::placeholder {
          color: var(--en-text-3);
        }
      `}</style>
      <div className="en-root" style={{ minHeight: "100vh", background: "var(--en-bg)", color: "var(--en-text)", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {children}
      </div>
    </>
  );
}
