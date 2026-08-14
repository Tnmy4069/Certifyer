"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SuperAdminLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Access denied. Invalid credentials.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    window.location.href = "/admin/users";
  }

  return (
    <div className="superadmin-bg">
      <style>{`
        .superadmin-bg {
          min-height: 100vh;
          background: #050508;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          overflow: hidden;
        }

        .superadmin-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 40%, rgba(99, 20, 255, 0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 60%, rgba(20, 100, 255, 0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        .sa-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          padding: 2.5rem;
          backdrop-filter: blur(24px);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04) inset,
            0 32px 64px -16px rgba(0,0,0,0.8),
            0 0 80px rgba(99, 20, 255, 0.06);
        }

        .sa-card.shake {
          animation: shake 0.5s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }

        .sa-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #6314ff 0%, #1464ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          box-shadow: 0 0 24px rgba(99, 20, 255, 0.4);
        }

        .sa-icon svg {
          width: 22px;
          height: 22px;
          color: white;
        }

        .sa-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 20, 255, 0.12);
          border: 1px solid rgba(99, 20, 255, 0.25);
          color: #a78bff;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 100px;
          margin-bottom: 0.75rem;
        }

        .sa-badge-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a78bff;
          animation: pulse-dot 2s ease-in-out infinite;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }

        .sa-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 0 0 0.375rem;
        }

        .sa-desc {
          font-size: 0.85rem;
          color: rgba(255,255,255,0.35);
          margin: 0 0 2rem;
        }

        .sa-label {
          display: block;
          font-size: 0.78rem;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.02em;
          margin-bottom: 0.5rem;
        }

        .sa-input-wrap {
          position: relative;
          margin-bottom: 1rem;
        }

        .sa-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          color: #ffffff;
          font-size: 0.9rem;
          padding: 0.7rem 1rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          box-sizing: border-box;
        }

        .sa-input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        .sa-input:focus {
          border-color: rgba(99, 20, 255, 0.5);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(99, 20, 255, 0.12);
        }

        .sa-input:-webkit-autofill,
        .sa-input:-webkit-autofill:hover,
        .sa-input:-webkit-autofill:focus {
          -webkit-text-fill-color: #ffffff;
          -webkit-box-shadow: 0 0 0 1000px #0d0d16 inset;
          transition: background-color 5000s ease-in-out 0s;
        }

        .sa-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.2);
          border-radius: 8px;
          color: #f87171;
          font-size: 0.8rem;
          padding: 0.6rem 0.9rem;
          margin-bottom: 1rem;
          animation: fade-in 0.2s ease;
        }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .sa-btn {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: none;
          background: linear-gradient(135deg, #6314ff 0%, #1464ff 100%);
          color: white;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(99, 20, 255, 0.35);
          position: relative;
          overflow: hidden;
          margin-top: 0.5rem;
        }

        .sa-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }

        .sa-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(99, 20, 255, 0.45);
        }

        .sa-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .sa-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sa-spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .sa-divider {
          border: none;
          border-top: 1px solid rgba(255,255,255,0.06);
          margin: 1.75rem 0 1.25rem;
        }

        .sa-footer {
          text-align: center;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>

      <div className="grid-overlay" />

      <div className={`sa-card${shake ? " shake" : ""}`}>
        {/* Icon */}
        <div className="sa-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Badge */}
        <div className="sa-badge">
          <span className="sa-badge-dot" />
          Super Admin Access
        </div>

        <h1 className="sa-title">System Control Panel</h1>
        <p className="sa-desc">Restricted area. Authorized personnel only.</p>

        <form onSubmit={onSubmit} autoComplete="off">
          {error && (
            <div className="sa-error" role="alert">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <div className="sa-input-wrap">
            <label className="sa-label" htmlFor="sa-email">Email address</label>
            <input
              id="sa-email"
              name="email"
              type="email"
              className="sa-input"
              placeholder="superadmin@certify.local"
              required
              autoComplete="off"
            />
          </div>

          <div className="sa-input-wrap">
            <label className="sa-label" htmlFor="sa-password">Password</label>
            <input
              id="sa-password"
              name="password"
              type="password"
              className="sa-input"
              placeholder="••••••••••••"
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="sa-btn" disabled={loading} id="sa-submit-btn">
            {loading ? (
              <>
                <span className="sa-spinner" />
                Authenticating...
              </>
            ) : (
              "Authenticate"
            )}
          </button>
        </form>

        <hr className="sa-divider" />
        <p className="sa-footer">Certify · Secure Access · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
