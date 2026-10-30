"use client";

import { useEffect, useState } from "react";
import LoginForm from "./LoginForm";
import SplashScreen from "./SplashScreen";
import styles from "./LoginScreen.module.css";

type SplashPhase = "entering" | "waiting" | "transitioning" | "form";
const PAUSE_BEFORE_FORM_MS = 1000;
const TRANSITION_FALLBACK_MS = 1800;

export default function LoginScreen() {
  const [phase, setPhase] = useState<SplashPhase>("entering");

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

  return (
    <main
      className={`${styles.screen} ${phase === "transitioning" || phase === "form" ? styles.formMode : ""}`}
    >
      <SplashScreen
        transitioning={phase === "transitioning" || phase === "form"}
        onEntranceEnd={() => setPhase("waiting")}
        onTransitionEnd={() => setPhase("form")}
      />
      {(phase === "transitioning" || phase === "form") && <LoginForm />}
    </main>
  );
}
