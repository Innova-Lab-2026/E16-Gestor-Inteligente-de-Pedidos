"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login } from "@/features/auth/actions";
import { ROUTES } from "@/config/router";
import styles from "./LoginScreen.module.css";

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [state, formAction, isPending] = useActionState(login, {});

  function validateEmail(form: HTMLFormElement) {
    const email = new FormData(form).get("email")?.toString().trim() ?? "";
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setEmailInvalid(!valid);
    return valid;
  }

  return (
    <section className={styles.loginForm} aria-label="Inicio de sesión">
      <h1 className={styles.loginTitle}>Ingresá a tu cuenta</h1>

      <form
        action={formAction}
        className={styles.credentials}
        noValidate
        onSubmit={(event) => {
          if (!validateEmail(event.currentTarget)) event.preventDefault();
        }}
      >
        <div className={`${styles.field} ${emailInvalid ? styles.fieldInvalid : ""}`}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="Ej: hola@ejemplo.com"
            required
            aria-invalid={emailInvalid}
            aria-describedby={emailInvalid ? "email-error" : undefined}
            onBlur={(event) => validateEmail(event.currentTarget.form!)}
            onChange={(event) => {
              if (emailInvalid) validateEmail(event.currentTarget.form!);
            }}
          />
          {emailInvalid && (
            <p className={styles.fieldError} id="email-error" role="alert">
              Usá un formato válido: Hola@ejemplo.com
            </p>
          )}
        </div>

        <div className={`${styles.field} ${state.error ? styles.fieldInvalid : ""}`}>
          <label htmlFor="password">Contraseña</label>
          <div className={styles.passwordInput}>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Ej: Hola1234"
              required
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? "credentials-error" : "password-helper"}
            />
            <button
              type="button"
              className={styles.passwordToggle}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="2.7" />
                {!showPassword && <path d="m4 20 16-16" />}
              </svg>
            </button>
          </div>
          {state.error ? (
            <p className={styles.fieldError} id="credentials-error" role="alert">
              {state.error}
            </p>
          ) : (
            <p className={styles.helperText} id="password-helper">Usá letras y números.</p>
          )}
        </div>

        <Link href={ROUTES.recuperarContrasena} className={styles.forgotPassword}>
          Olvidé mi contraseña
        </Link>

        <div className={styles.formActions}>
          <button type="submit" className={styles.submitButton} disabled={isPending}>
            {isPending ? "Ingresando..." : "Ingresar"}
          </button>
          <a href={ROUTES.registro} className={styles.registerButton}>
            Es mi primera vez - Crear cuenta
          </a>
        </div>
      </form>
    </section>
  );
}
