"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { ROUTES } from "@/config/router";
import { register, type RegisterState } from "@/features/auth/register-action";
import EmprendimientoSetupWizard, {
  type EmprendimientoSetupValues,
} from "@/components/emprendimientos/EmprendimientoSetupWizard";
import styles from "./RegisterScreen.module.css";

const initialState: RegisterState = {};

type AccountFields = {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  password: string;
  repeatPassword: string;
};

const emptyAccount: AccountFields = {
  nombre: "",
  apellido: "",
  dni: "",
  email: "",
  password: "",
  repeatPassword: "",
};

export default function RegisterScreen() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [step, setStep] = useState<1 | 2>(1);
  const [account, setAccount] = useState(emptyAccount);
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeatedPassword, setShowRepeatedPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [productType, setProductType] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channelPhones, setChannelPhones] = useState({ WhatsApp: "", Telegram: "" });
  const [deliveryModes, setDeliveryModes] = useState<string[]>([]);
  const [pickupAddress, setPickupAddress] = useState("");

  const passwordRules = [
    { label: "Mínimo 8 caracteres.", valid: account.password.length >= 8 },
    { label: "Al menos 1 letra mayúscula.", valid: /[A-Z]/.test(account.password) },
    { label: "Al menos 1 letra minúscula.", valid: /[a-z]/.test(account.password) },
    { label: "Al menos 1 caracter numérico.", valid: /[0-9]/.test(account.password) },
    { label: "Al menos 1 caracter especial.", valid: /[^A-Za-z0-9]/.test(account.password) },
  ];
  const passwordValid = passwordRules.every((rule) => rule.valid);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim());
  const accountValid =
    account.nombre.trim().length > 0 &&
    account.apellido.trim().length > 0 &&
    /^[0-9]+$/.test(account.dni) &&
    emailValid &&
    passwordValid &&
    account.password === account.repeatPassword &&
    termsAccepted;
  const registrationNotice = state.success ? "1" : null;

  useEffect(() => {
    if (registrationNotice) {
      router.replace(`${ROUTES.login}?registered=${registrationNotice}`);
    }
  }, [registrationNotice, router]);

  function updateAccount(field: keyof AccountFields, value: string) {
    setAccount((current) => ({ ...current, [field]: value }));
  }

  function goToBusinessStep() {
    setEmailInvalid(!emailValid);
    setPasswordTouched(true);
    setPasswordInvalid(!passwordValid);
    if (accountValid) setStep(2);
  }

  function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    if (step === 1) {
      event.preventDefault();
      goToBusinessStep();
    }
  }

  function handleSetupComplete(values: EmprendimientoSetupValues) {
    setBusinessName(values.nombre);
    setProductType(values.rubro);
    setCustomProduct(values.especialidad);
    setSelectedChannels(values.canales);
    setChannelPhones(values.telefonos);
    setDeliveryModes(values.modalidades);
    setPickupAddress(values.direccionRetiro);

    const formData = new FormData();
    formData.set("nombre", account.nombre);
    formData.set("apellido", account.apellido);
    formData.set("dni", account.dni);
    formData.set("email", account.email);
    formData.set("password", account.password);
    formData.set("businessName", values.nombre);
    formData.set("productType", values.rubro);
    formData.set("customProduct", values.especialidad);
    values.canales.forEach((channel) => formData.append("channels", channel));
    formData.set("whatsappPhone", values.telefonos.WhatsApp);
    formData.set("telegramPhone", values.telefonos.Telegram);
    formData.set("deliveryModes", JSON.stringify(values.modalidades));
    formData.set("pickupAddress", values.direccionRetiro);

    startTransition(() => formAction(formData));
  }

  return (
    <main className={`${styles.screen} ${step > 1 ? styles.businessScreen : ""}`}>
      {step === 1 ? (
        <>
          <header className={styles.header}>
            <Link href={ROUTES.login} className={styles.backLink} aria-label="Volver al inicio de sesión">
              <ArrowIcon />
            </Link>
            <h1>Crear cuenta</h1>
          </header>

          <p className={styles.intro}>Cargá tus datos y comenzá a organizar tu emprendimiento.</p>

          <form action={formAction} className={styles.form} onSubmit={handleAccountSubmit}>
            <label className={styles.field}>
              <span>Nombre *</span>
              <input name="nombre" autoComplete="given-name" placeholder="Ej: Pepe" required value={account.nombre} onChange={(event) => updateAccount("nombre", event.currentTarget.value)} />
            </label>

            <label className={styles.field}>
              <span>Apellido *</span>
              <input name="apellido" autoComplete="family-name" placeholder="Ej: Argento" required value={account.apellido} onChange={(event) => updateAccount("apellido", event.currentTarget.value)} />
            </label>

            <label className={styles.field}>
              <span>DNI *</span>
              <input name="dni" inputMode="numeric" autoComplete="off" placeholder="Ej: 123456789" pattern="[0-9]+" required value={account.dni} onChange={(event) => updateAccount("dni", event.currentTarget.value)} />
              <small>Sin espacios ni puntos.</small>
            </label>

            <label className={`${styles.field} ${emailInvalid ? styles.fieldInvalid : ""}`}>
              <span>Email *</span>
              <input name="email" type="email" autoComplete="email" placeholder="Ej: hola@gmail.com" required value={account.email} aria-invalid={emailInvalid} onBlur={() => setEmailInvalid(!emailValid)} onChange={(event) => { updateAccount("email", event.currentTarget.value); setEmailInvalid(false); }} />
              {emailInvalid && <small className={styles.error}>Usá un formato válido: Hola@ejemplo.com</small>}
            </label>

            <label className={`${styles.field} ${passwordInvalid ? styles.fieldInvalid : ""}`}>
              <span>Contraseña *</span>
              <span className={styles.passwordWrap}>
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required value={account.password} aria-invalid={passwordInvalid} onFocus={() => setPasswordFocused(true)} onBlur={() => { setPasswordFocused(false); if (account.password) { setPasswordTouched(true); setPasswordInvalid(!passwordValid); } }} onChange={(event) => { updateAccount("password", event.currentTarget.value); setPasswordTouched(false); setPasswordInvalid(false); }} />
                <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><EyeIcon visible={showPassword} /></button>
              </span>
              {(passwordFocused || passwordTouched || account.password.length > 0) && (
                <ul className={styles.passwordRules} aria-live="polite">
                  {passwordRules.map((rule) => <li key={rule.label} className={rule.valid ? styles.ruleValid : ""}>{rule.label}</li>)}
                </ul>
              )}
            </label>

            <label className={`${styles.field} ${account.repeatPassword && account.password !== account.repeatPassword ? styles.fieldInvalid : ""}`}>
              <span>Repetir contraseña *</span>
              <span className={styles.passwordWrap}>
                <input name="repeatPassword" type={showRepeatedPassword ? "text" : "password"} autoComplete="new-password" placeholder="Repetí tu contraseña" required value={account.repeatPassword} aria-invalid={Boolean(account.repeatPassword) && account.password !== account.repeatPassword} onChange={(event) => updateAccount("repeatPassword", event.currentTarget.value)} />
                <button type="button" className={styles.passwordToggle} onClick={() => setShowRepeatedPassword((value) => !value)} aria-label={showRepeatedPassword ? "Ocultar contraseña" : "Mostrar contraseña"}><EyeIcon visible={showRepeatedPassword} /></button>
              </span>
              {account.repeatPassword && account.password !== account.repeatPassword && <small className={styles.error}>Las contraseñas no coinciden.</small>}
            </label>

            <label className={styles.terms}>
              <input name="acceptTerms" type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.currentTarget.checked)} />
              <span>Acepto los términos y condiciones y la política de privacidad.</span>
            </label>
            <button className={styles.submitButton} type="submit" disabled={!accountValid}>
              Siguiente
            </button>
          </form>
        </>
      ) : (
        <EmprendimientoSetupWizard
          initialValues={{
            nombre: businessName,
            rubro: productType,
            especialidad: customProduct,
            canales: selectedChannels,
            telefonos: channelPhones,
            modalidades: deliveryModes,
            direccionRetiro: pickupAddress,
          }}
          error={state.error}
          pending={isPending || Boolean(state.success)}
          pendingLabel={state.success ? "Cuenta creada" : "Creando cuenta..."}
          submitLabel="Crear cuenta"
          onComplete={handleSetupComplete}
          onCancel={() => setStep(1)}
        />
      )}
    </main>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h11" /></svg>;
}

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.7" />
      {!visible && <path d="m4 20 16-16" />}
    </svg>
  );
}
