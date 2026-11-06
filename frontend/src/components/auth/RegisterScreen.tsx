"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { ROUTES } from "@/config/router";
import { register } from "@/features/auth/register-action";
import styles from "./RegisterScreen.module.css";

const initialState = {};
const productOptions = ["Facturas", "Farmacia", "Flores", "Otro"];
const channelOptions = ["WhatsApp", "Telegram", "Texto"] as const;

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
  const [state, formAction, isPending] = useActionState(register, initialState);
  const [hasMounted, setHasMounted] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
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
  const [productSearch, setProductSearch] = useState("");
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [channelPhones, setChannelPhones] = useState({ WhatsApp: "", Telegram: "" });
  const [deliveryModes, setDeliveryModes] = useState<string[]>([]);
  const [pickupAddress, setPickupAddress] = useState("");
  const [verificationCodes, setVerificationCodes] = useState({ WhatsApp: "", Telegram: "" });
  const [verificationErrors, setVerificationErrors] = useState({ WhatsApp: false, Telegram: false });

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
  const businessValid =
    businessName.trim().length > 0 &&
    productType.length > 0 &&
    (productType !== "Otro" || customProduct.trim().length > 0);
  const deliveryValid = selectedChannels.length > 0 && deliveryModes.length > 0;
  const phoneChannels = selectedChannels.filter(
    (channel): channel is "WhatsApp" | "Telegram" => channel === "WhatsApp" || channel === "Telegram",
  );
  const channelsToVerify = phoneChannels.filter((channel) => channelPhones[channel].trim().length > 0);
  const verificationValid = channelsToVerify.length > 0 && channelsToVerify.every((channel) => verificationCodes[channel].length === 6);

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

  function handleBusinessSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (businessValid) setStep(3);
  }

  function handleDeliverySubmit(event: FormEvent<HTMLFormElement>) {
    if (channelsToVerify.length > 0) {
      event.preventDefault();
      setStep(4);
    }
  }

  function toggleSelection(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  const filteredProducts = productOptions.filter((option) =>
    option.toLocaleLowerCase("es").includes(productSearch.toLocaleLowerCase("es")),
  );

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
            <button className={styles.submitButton} type="submit" disabled={!hasMounted || !accountValid}>
              Siguiente
            </button>
          </form>
        </>
      ) : step === 2 ? (
        <form className={styles.businessStep} onSubmit={handleBusinessSubmit}>
          <header className={styles.progressHeader}>
            <button type="button" className={styles.stepBack} onClick={() => setStep(1)} aria-label="Volver al paso anterior"><ArrowIcon /></button>
            <span>Paso 1 de 2</span>
          </header>
          <div className={styles.progressTrack} aria-label="Progreso: paso 1 de 2"><span /></div>

          <h1 className={styles.businessTitle}>Contanos de tu emprendimiento</h1>
          <p className={styles.businessIntro}>Con esto armamos tu catálogo inicial.</p>

          <input type="hidden" name="nombre" value={account.nombre} />
          <input type="hidden" name="apellido" value={account.apellido} />
          <input type="hidden" name="dni" value={account.dni} />
          <input type="hidden" name="email" value={account.email} />
          <input type="hidden" name="password" value={account.password} />

          <label className={styles.businessField}>
            <span>Nombre del emprendimiento</span>
            <input name="businessName" placeholder="Ej: Mi emprendimiento" required value={businessName} onChange={(event) => setBusinessName(event.currentTarget.value)} />
            <small>Lo podés cambiar después</small>
          </label>

          <div className={styles.businessField}>
            <label htmlFor="product-type"><span>¿Qué vendés?</span></label>
            <div className={`${styles.productPicker} ${productMenuOpen ? styles.productPickerOpen : ""}`}>
              <input
                id="product-type"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={productMenuOpen}
                aria-controls="product-options"
                aria-label="Buscar tipo de producto"
                placeholder="Escribí tu tipo de producto"
                value={productSearch || productType}
                required
                onFocus={() => { setProductSearch(productType); setProductMenuOpen(true); }}
                onChange={(event) => { setProductType(""); setProductSearch(event.currentTarget.value); setProductMenuOpen(true); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setProductMenuOpen(false);
                  if (event.key === "Enter" && filteredProducts.length === 1) {
                    event.preventDefault();
                    setProductType(filteredProducts[0]);
                    setProductSearch("");
                    setProductMenuOpen(false);
                  }
                }}
              />
              <SearchIcon />
              {productMenuOpen && (
                <ul className={styles.productOptions} id="product-options" role="listbox">
                  {filteredProducts.map((option) => (
                    <li key={option} role="option" aria-selected={productType === option}>
                      <button type="button" onClick={() => { setProductType(option); setProductSearch(""); setProductMenuOpen(false); }}>{option}</button>
                    </li>
                  ))}
                  {filteredProducts.length === 0 && <li className={styles.noOptions}>Sin resultados</li>}
                </ul>
              )}
            </div>
          </div>

          {productType === "Otro" && (
            <label className={`${styles.businessField} ${styles.customProductField}`}>
              <span>Contanos cuál es tu producto</span>
              <input name="customProduct" placeholder="Ej: Ferretería" required value={customProduct} onChange={(event) => setCustomProduct(event.currentTarget.value)} />
            </label>
          )}

          {state.error && <p className={styles.error} role="alert">{state.error}</p>}
          {state.success && <p className={styles.success} role="status">{state.success} <Link href={ROUTES.login}>Iniciar sesión</Link></p>}
          <input type="hidden" name="productType" value={productType} />
          <button className={styles.submitButton} type="submit" disabled={!businessValid}>
            Siguiente
          </button>
        </form>
      ) : step === 3 ? (
        <form action={formAction} className={`${styles.businessStep} ${styles.deliveryStep}`} onSubmit={handleDeliverySubmit}>
          <header className={styles.progressHeader}>
            <button type="button" className={styles.stepBack} onClick={() => setStep(2)} aria-label="Volver al paso anterior"><ArrowIcon /></button>
            <span>Paso 2 de 2</span>
          </header>
          <div className={`${styles.progressTrack} ${styles.progressComplete}`} aria-label="Progreso: paso 2 de 2"><span /></div>
          <h1 className={styles.deliveryTitle}>¿Cómo te llegan los pedidos?</h1>

          <input type="hidden" name="nombre" value={account.nombre} />
          <input type="hidden" name="apellido" value={account.apellido} />
          <input type="hidden" name="dni" value={account.dni} />
          <input type="hidden" name="email" value={account.email} />
          <input type="hidden" name="password" value={account.password} />
          <input type="hidden" name="businessName" value={businessName} />
          <input type="hidden" name="productType" value={productType} />
          <input type="hidden" name="customProduct" value={customProduct} />

          <div className={styles.channelList}>
            {channelOptions.map((channel) => {
              const selected = selectedChannels.includes(channel);
              const isPhoneChannel = channel === "WhatsApp" || channel === "Telegram";
              return (
                <label key={channel} className={`${styles.channelCard} ${selected ? channel === "Texto" ? styles.channelManualSelected : styles.channelSelected : ""}`}>
                  <input
                    type="checkbox"
                    name="channels"
                    value={channel}
                    checked={selected}
                    onChange={() => toggleSelection(channel, selectedChannels, setSelectedChannels)}
                  />
                  <span className={styles.channelCopy}>
                    <strong>{selected && channel === "Texto" ? "En persona o por teléfono" : channel}</strong>
                    <small>{selected && channel === "Texto" ? "Los cargás vos en segundos" : selected ? "Los pedidos entran solos al gestor" : channel === "Texto" ? "Texto" : "Los pedidos entran solos"}</small>
                    {selected && isPhoneChannel && (
                      <input
                        className={styles.channelPhone}
                        name={`${channel.toLowerCase()}Phone`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Ej: +54 9 11 123456789"
                        value={channel === "WhatsApp" ? channelPhones.WhatsApp : channelPhones.Telegram}
                        onChange={(event) => {
                          const value = event.currentTarget.value.replace(/[^0-9+()\s-]/g, "");
                          setChannelPhones((current) => ({ ...current, [channel]: value }));
                        }}
                      />
                    )}
                  </span>
                </label>
              );
            })}
            <div className={`${styles.channelCard} ${styles.channelUnavailable}`} aria-disabled="true">
              <span className={styles.channelCheck} aria-hidden="true" />
              <span className={styles.channelCopy}><strong>Instagram</strong><small>No disponible</small></span>
              <span className={styles.channelBadge}>texto</span>
            </div>
            <div className={`${styles.channelCard} ${styles.channelUnavailable}`} aria-disabled="true">
              <span className={styles.channelCheck} aria-hidden="true" />
              <span className={styles.channelCopy}><strong>Facebook</strong><small>No disponible</small></span>
              <span className={styles.channelBadge}>texto</span>
            </div>
          </div>

          <fieldset className={styles.deliveryFieldset}>
            <legend>¿Cómo realizás la entrega?</legend>
            <div className={styles.deliveryOptions}>
              {["Retiro", "Envío"].map((mode) => {
                const selected = deliveryModes.includes(mode);
                return (
                  <button
                    key={mode}
                    type="button"
                    className={`${styles.deliveryOption} ${selected ? styles.deliveryOptionSelected : ""}`}
                    aria-pressed={selected}
                    onClick={() => toggleSelection(mode, deliveryModes, setDeliveryModes)}
                  >
                    {selected && <span aria-hidden="true">✓</span>}{mode}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {deliveryModes.includes("Retiro") && (
            <label className={styles.pickupField}>
              <span>¿En qué dirección se realizan los retiros?</span>
              <input name="pickupAddress" placeholder="Calle / Número / Ciudad" value={pickupAddress} onChange={(event) => setPickupAddress(event.currentTarget.value)} />
            </label>
          )}

          <div className={styles.deliveryActions}>
            {state.error && <p className={styles.error} role="alert">{state.error}</p>}
            {state.success && <p className={styles.success} role="status">{state.success} <Link href={ROUTES.login}>Iniciar sesión</Link></p>}
            <input type="hidden" name="deliveryModes" value={JSON.stringify(deliveryModes)} />
            <button className={styles.submitButton} type="submit" disabled={!deliveryValid || isPending || Boolean(state.success)}>
              {isPending ? "Creando cuenta..." : state.success ? "Cuenta creada" : "Siguiente"}
            </button>
          </div>
        </form>
      ) : (
        <form action={formAction} className={`${styles.businessStep} ${styles.deliveryStep} ${styles.verificationStep}`}>
          <header className={styles.progressHeader}>
            <button type="button" className={styles.stepBack} onClick={() => setStep(3)} aria-label="Volver al paso anterior"><ArrowIcon /></button>
            <span>Paso 3 de 3</span>
          </header>
          <div className={`${styles.progressTrack} ${styles.progressComplete}`} aria-label="Progreso: paso 3 de 3"><span /></div>
          <h1 className={styles.deliveryTitle}>Ahora vamos a validar tus cuentas</h1>

          <input type="hidden" name="nombre" value={account.nombre} />
          <input type="hidden" name="apellido" value={account.apellido} />
          <input type="hidden" name="dni" value={account.dni} />
          <input type="hidden" name="email" value={account.email} />
          <input type="hidden" name="password" value={account.password} />
          <input type="hidden" name="businessName" value={businessName} />
          <input type="hidden" name="productType" value={productType} />
          <input type="hidden" name="customProduct" value={customProduct} />
          {selectedChannels.map((channel) => <input key={channel} type="hidden" name="channels" value={channel} />)}
          {phoneChannels.includes("WhatsApp") && <input type="hidden" name="whatsappPhone" value={channelPhones.WhatsApp} />}
          {phoneChannels.includes("Telegram") && <input type="hidden" name="telegramPhone" value={channelPhones.Telegram} />}
          <input type="hidden" name="deliveryModes" value={JSON.stringify(deliveryModes)} />
          {deliveryModes.includes("Retiro") && <input type="hidden" name="pickupAddress" value={pickupAddress} />}

          <div className={styles.verificationList}>
            {channelsToVerify.map((channel) => (
              <section className={styles.verificationCard} key={channel}>
                <h2>{channel}</h2>
                <p>Te enviamos un código. Ingresalo acá.</p>
                <input
                  className={`${styles.verificationInput} ${verificationErrors[channel] ? styles.verificationInputInvalid : ""}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-label={`Código de verificación de ${channel}`}
                  aria-invalid={verificationErrors[channel]}
                  value={verificationCodes[channel]}
                  onChange={(event) => {
                    const code = event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCodes((current) => ({ ...current, [channel]: code }));
                    setVerificationErrors((current) => ({ ...current, [channel]: false }));
                  }}
                />
                {verificationErrors[channel] && <p className={styles.verificationError} role="alert">El código ingresado es incorrecto</p>}
                <button className={styles.resendButton} type="button">Reenviar</button>
              </section>
            ))}
          </div>

          {state.error && <p className={styles.error} role="alert">{state.error}</p>}
          {state.success && <p className={styles.success} role="status">{state.success} <Link href={ROUTES.login}>Iniciar sesión</Link></p>}
          <div className={styles.deliveryActions}>
            <button className={styles.submitButton} type="submit" disabled={!verificationValid || isPending || Boolean(state.success)}>
              {isPending ? "Creando cuenta..." : state.success ? "Cuenta creada" : "Siguiente"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6M9 12h11" /></svg>;
}

function SearchIcon() {
  return <svg className={styles.searchIcon} viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="7.3" /><path d="m16.2 16.2 5 5" /></svg>;
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
