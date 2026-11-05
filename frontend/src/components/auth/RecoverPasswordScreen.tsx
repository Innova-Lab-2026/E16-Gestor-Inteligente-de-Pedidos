"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ROUTES } from "@/config/router";
import styles from "./RecoverPasswordScreen.module.css";

export default function RecoverPasswordScreen() {
  const [email, setEmail] = useState("");
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function validateEmail(value: string) {
    setEmailInvalid(!isValidEmail(value));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = isValidEmail(email);
    setEmailInvalid(!valid);
    if (valid) setSubmitted(true);
  }

  return (
    <main className={styles.screen}>
      <header className={styles.brand} aria-label="Emprendete">
        <Image
          src="/images/emprendete-logo.png"
          alt="Emprendete"
          width={324}
          height={272}
          priority
          className={styles.logo}
        />
        <p className={styles.tagline}>
          Pedidos, stock y cobros
          <br />
          en un solo lugar
        </p>
      </header>

      <section className={styles.content}>
        <h1>Recuperá tu contraseña</h1>
        {submitted ? (
          <p className={styles.description}>
            Si tu mail está en nuestra base de datos, te enviaremos el correo con los pasos a seguir.
          </p>
        ) : (
          <>
            <p className={styles.description}>
              Te enviaremos un mail a tu casilla con los pasos a seguir.
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <label className={`${styles.emailField} ${emailInvalid ? styles.fieldInvalid : ""}`} htmlFor="recovery-email">
                Email
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Ej: hola@ejemplo.com"
                  required
                  value={email}
                  aria-invalid={emailInvalid}
                  aria-describedby={emailInvalid ? "recovery-email-error" : undefined}
                  onBlur={(event) => validateEmail(event.currentTarget.value)}
                  onChange={(event) => {
                    setEmail(event.currentTarget.value);
                    if (emailInvalid) validateEmail(event.currentTarget.value);
                  }}
                />
                {emailInvalid && <span className={styles.fieldError} id="recovery-email-error" role="alert">Usá un formato válido: Hola@ejemplo.com</span>}
              </label>

              <div className={styles.actions}>
                <button type="submit" className={styles.sendButton}>Enviar</button>
                <Link href={ROUTES.login} className={styles.backButton}>Volver</Link>
              </div>
            </form>
          </>
        )}

        {submitted && (
          <div className={styles.actions}>
            <Link href={ROUTES.login} className={styles.backButton}>Volver</Link>
          </div>
        )}
      </section>
    </main>
  );
}
