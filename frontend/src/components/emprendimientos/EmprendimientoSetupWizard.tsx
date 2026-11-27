"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "@/components/auth/RegisterScreen.module.css";

const productOptions = ["Artesanía", "Indumentaria", "Comida", "Otro"];
const channelOptions = ["Texto"];
const unavailableChannels = [
  "WhatsApp",
  "Telegram",
  "Instagram",
  "Facebook",
] as const;
const deliveryOptions = ["Retiro", "Envío"] as const;

export type EmprendimientoSetupValues = {
  nombre: string;
  rubro: string;
  especialidad: string;
  canales: string[];
  telefonos: { WhatsApp: string; Telegram: string };
  modalidades: string[];
  direccionRetiro: string;
};

type Props = {
  initialValues?: Partial<EmprendimientoSetupValues>;
  onComplete: (values: EmprendimientoSetupValues) => void;
  onCancel?: () => void;
  backHref?: string;
  error?: string | null;
  pending?: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  compact?: boolean;
  showPhoneInputs?: boolean;
  showPickupAddress?: boolean;
};

export default function EmprendimientoSetupWizard({
  initialValues,
  onComplete,
  onCancel,
  backHref,
  error,
  pending = false,
  submitLabel = "Crear emprendimiento",
  pendingLabel = "Guardando...",
  compact = false,
  showPhoneInputs = true,
  showPickupAddress = true,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [nombre, setNombre] = useState(initialValues?.nombre ?? "");
  const [rubro, setRubro] = useState(initialValues?.rubro ?? "");
  const [especialidad, setEspecialidad] = useState(
    initialValues?.especialidad ?? "",
  );
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [canales, setCanales] = useState<string[]>(["Texto"]);
  const [telefonos, setTelefonos] = useState({
    WhatsApp: initialValues?.telefonos?.WhatsApp ?? "",
    Telegram: initialValues?.telefonos?.Telegram ?? "",
  });
  const [modalidades, setModalidades] = useState<string[]>(
    initialValues?.modalidades ?? [],
  );
  const [direccionRetiro, setDireccionRetiro] = useState(
    initialValues?.direccionRetiro ?? "",
  );

  const stepOneValid =
    nombre.trim().length > 0 &&
    rubro.length > 0 &&
    (rubro !== "Otro" || especialidad.trim().length > 0);
  const stepTwoValid = canales.includes("Texto") && modalidades.length > 0;

  function toggleSelection(
    value: string,
    values: string[],
    setValues: (next: string[]) => void,
  ) {
    setValues(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      if (stepOneValid) setStep(2);
      return;
    }

    if (!stepTwoValid || pending) return;
    onComplete({
      nombre: nombre.trim(),
      rubro,
      especialidad: rubro === "Otro" ? especialidad.trim() : "",
      canales,
      telefonos,
      modalidades,
      direccionRetiro,
    });
  }

  const backButton = backHref ? (
    <Link
      href={backHref}
      className={styles.stepBack}
      aria-label="Volver"
    >
      <ArrowIcon />
    </Link>
  ) : (
    <button
      type="button"
      className={`${styles.stepBack} ${styles.stepCancel}`}
      onClick={onCancel}
      aria-label="Cancelar registro"
    >
      <ArrowIcon />
      <span>Cancelar</span>
    </button>
  );

  return (
    <div className={compact ? styles.appSetupWizard : undefined}>
      {step === 1 ? (
        <form className={styles.businessStep} onSubmit={handleSubmit}>
          <div
            className={
              compact
                ? "app-page-heading app-page-heading-at-nav"
                : "contents"
            }
          >
            <header className={styles.progressHeader}>
              {backButton}
              <span>Paso 1 de 2</span>
            </header>
            <div
              className={styles.progressTrack}
              aria-label="Progreso: paso 1 de 2"
            >
              <span />
            </div>

            <h1 className={styles.businessTitle}>
              Contanos de tu emprendimiento
            </h1>
            <p className={styles.businessIntro}>
              Con esto armamos tu catálogo inicial.
            </p>
          </div>

          <label className={styles.businessField}>
            <span>Nombre del emprendimiento</span>
            <input
              name="businessName"
              placeholder="Ej: Mi emprendimiento"
              maxLength={150}
              required
              value={nombre}
              onChange={(event) => setNombre(event.currentTarget.value)}
            />
          </label>

          <div className={styles.businessField}>
            <label htmlFor="product-type">
              <span>¿Qué vendés?</span>
            </label>
            <div
              className={`${styles.productPicker} ${productMenuOpen ? styles.productPickerOpen : ""}`}
            >
              <button
                id="product-type"
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={productMenuOpen}
                aria-controls="product-options"
                aria-label="¿Qué vendés?"
                aria-required="true"
                className={styles.productPickerButton}
                onClick={() => setProductMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setProductMenuOpen(false);
                }}
              >
                <span className={rubro ? undefined : styles.productPlaceholder}>
                  {rubro || "Seleccioná una opción"}
                </span>
                <ChevronDownIcon />
              </button>
              {productMenuOpen && (
                <div
                  className={styles.productOptions}
                  id="product-options"
                  role="listbox"
                >
                  {productOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={rubro === option}
                      onClick={() => {
                        setRubro(option);
                        if (option !== "Otro") setEspecialidad("");
                        setProductMenuOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {rubro === "Otro" && (
            <label className={`${styles.businessField} ${styles.customProductField}`}>
              <span>Contanos la especialidad de tu emprendimiento</span>
              <input
                name="customProduct"
                placeholder="Ej: Cerámica artesanal"
                required
                value={especialidad}
                onChange={(event) => setEspecialidad(event.currentTarget.value)}
              />
            </label>
          )}

          <button
            className={styles.submitButton}
            type="submit"
            disabled={!stepOneValid}
          >
            Siguiente
          </button>
        </form>
      ) : (
        <form
          className={`${styles.businessStep} ${styles.deliveryStep}`}
          onSubmit={handleSubmit}
        >
          <div
            className={
              compact
                ? "app-page-heading app-page-heading-at-nav"
                : "contents"
            }
          >
            <header className={styles.progressHeader}>
              <button
                type="button"
                className={styles.stepBack}
                onClick={() => setStep(1)}
                aria-label="Volver al paso anterior"
              >
                <ArrowIcon />
              </button>
              <span>Paso 2 de 2</span>
            </header>
            <div
              className={`${styles.progressTrack} ${styles.progressComplete}`}
              aria-label="Progreso: paso 2 de 2"
            >
              <span />
            </div>
            <h1 className={styles.deliveryTitle}>
              ¿Cómo te llegan los pedidos?
            </h1>
          </div>

          <div className={styles.channelList}>
            {channelOptions.map((channel) => {
              const selected = canales.includes(channel);
              const isPhoneChannel = channel === "WhatsApp" || channel === "Telegram";
              return (
                <label
                  key={channel}
                  className={`${styles.channelCard} ${selected ? channel === "Texto" ? styles.channelManualSelected : styles.channelSelected : ""}`}
                >
                  <input
                    type="checkbox"
                    name="channels"
                    value={channel}
                    checked={selected}
                    onChange={() =>
                      toggleSelection(channel, canales, setCanales)
                    }
                  />
                  <span className={styles.channelCopy}>
                    <strong>{channel}</strong>
                    <small>Ingreso manual</small>
                    {showPhoneInputs && selected && isPhoneChannel && (
                      <input
                        className={styles.channelPhone}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Ej: +54 9 11 123456789"
                        value={telefonos[channel]}
                        onChange={(event) => {
                          const value = event.currentTarget.value.replace(
                            /[^0-9+()\s-]/g,
                            "",
                          );
                          setTelefonos((current) => ({
                            ...current,
                            [channel]: value,
                          }));
                        }}
                      />
                    )}
                  </span>
                </label>
              );
            })}
            {unavailableChannels.map((channel) => (
              <div
                key={channel}
                className={`${styles.channelCard} ${styles.channelUnavailable}`}
                aria-disabled="true"
              >
                <span className={styles.channelCheck} aria-hidden="true" />
                <span className={styles.channelCopy}>
                  <strong>{channel}</strong>
                  <small>Próximamente</small>
                </span>
              </div>
            ))}
          </div>

          <fieldset className={styles.deliveryFieldset}>
            <legend>¿Cómo realizás la entrega?</legend>
            <div className={styles.deliveryOptions}>
              {deliveryOptions.map((mode) => {
                const selected = modalidades.includes(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.deliveryOption} ${selected ? styles.deliveryOptionSelected : ""}`}
                    aria-pressed={selected}
                    onClick={() =>
                      toggleSelection(mode, modalidades, setModalidades)
                    }
                  >
                    {selected && <span aria-hidden="true">✓</span>}
                    {mode}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {showPickupAddress && modalidades.includes("Retiro") && (
            <label className={styles.pickupField}>
              <span>¿En qué dirección se realizan los retiros?</span>
              <input
                name="pickupAddress"
                placeholder="Calle / Número / Ciudad"
                value={direccionRetiro}
                onChange={(event) =>
                  setDireccionRetiro(event.currentTarget.value)
                }
              />
            </label>
          )}

          <div className={styles.deliveryActions}>
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <button
              className={styles.submitButton}
              type="submit"
              disabled={!stepTwoValid || pending}
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 18-6-6 6-6M9 12h11" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      className={styles.productPickerChevron}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
