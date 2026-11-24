"use client";

import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import SplashScreen from "./SplashScreen";
import styles from "./LoginScreen.module.css";

type SplashPhase = "entering" | "waiting" | "transitioning" | "form";
type RegistrationNotice = "1" | "pending" | null;
const PAUSE_BEFORE_FORM_MS = 1000;
const TRANSITION_FALLBACK_MS = 1800;

export default function LoginScreen({
  registrationNotice,
}: {
  registrationNotice: RegistrationNotice;
}) {
  const [phase, setPhase] = useState<SplashPhase>("entering");
  const [noticeVisible, setNoticeVisible] = useState(registrationNotice !== null);

  useEffect(() => {
    if (phase === "waiting") {
      const timeout = window.setTimeout(
        () => setPhase("transitioning"),
        PAUSE_BEFORE_FORM_MS,
      );
      return () => window.clearTimeout(timeout);
    }

    if (phase === "transitioning") {
      const timeout = window.setTimeout(
        () => setPhase("form"),
        TRANSITION_FALLBACK_MS,
      );
      return () => window.clearTimeout(timeout);
    }
  }, [phase]);

  useEffect(() => {
    if (!registrationNotice) return;

    const url = new URL(window.location.href);
    url.searchParams.delete("registered");
    window.history.replaceState(window.history.state, "", url);
  }, [registrationNotice]);

  useEffect(() => {
    if (!registrationNotice || phase !== "form" || !noticeVisible) return;

    const timeout = window.setTimeout(() => setNoticeVisible(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [noticeVisible, phase, registrationNotice]);

  return (
    <main
      className={`${styles.screen} ${phase === "transitioning" || phase === "form" ? styles.formMode : ""}`}
    >
      {registrationNotice && noticeVisible && (
        <div
          className="absolute left-1/2 top-4 z-50 flex w-[calc(100%-2rem)] max-w-[390px] -translate-x-1/2 items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <p className="flex-1">
            {registrationNotice === "pending"
              ? "Cuenta creada. Revisá tu email y confirmala antes de iniciar sesión."
              : "Cuenta creada exitosamente. Ya podés iniciar sesión."}
          </p>
          <button
            type="button"
            className="rounded px-1 text-lg leading-5 text-emerald-800 hover:bg-emerald-50"
            aria-label="Cerrar aviso"
            onClick={() => setNoticeVisible(false)}
          >
            ×
          </button>
        </div>
      )}
      <SplashScreen
        transitioning={phase === "transitioning" || phase === "form"}
        onEntranceEnd={() => setPhase("waiting")}
        onTransitionEnd={() => setPhase("form")}
      />
      {(phase === "transitioning" || phase === "form") && <LoginForm />}
    </main>
  );
}
