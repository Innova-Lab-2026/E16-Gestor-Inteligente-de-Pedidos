"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    titulo: "1. Cargá tu catálogo",
    descripcion:
      "Sumá tus productos, precios y stock para tener todo ordenado en un solo lugar.",
  },
  {
    titulo: "2. Registrá tus pedidos",
    descripcion:
      "Anotá ventas en segundos, asigná clientes y seguí el estado de cada entrega.",
  },
  {
    titulo: "3. Controlá tus números",
    descripcion:
      "Mirá cuánto vendiste por día, semana o mes sin hacer cuentas a mano.",
  },
];

const STORAGE_KEY = "onboarding_visto";

export default function OnboardingModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === null) {
      setVisible(true);
    }
  }, []);

  function finishOnboarding() {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102a39]/60 px-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description"
        className="w-full max-w-[390px] rounded-3xl bg-white p-6 text-[#102a39] shadow-2xl"
      >
        <p className="text-xs font-bold uppercase tracking-wide text-[#7622ed]">
          Paso {step + 1} de {STEPS.length}
        </p>
        <h2 id="onboarding-title" className="mt-4 text-xl font-bold">
          {currentStep.titulo}
        </h2>
        <p
          id="onboarding-description"
          className="mt-3 text-sm leading-6 text-[#586574]"
        >
          {currentStep.descripcion}
        </p>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finishOnboarding}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-[#586574] transition hover:bg-slate-100"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={() => {
              if (step === STEPS.length - 1) {
                finishOnboarding();
              } else {
                setStep((current) => current + 1);
              }
            }}
            className="rounded-full bg-[#7622ed] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#641bd0]"
          >
            {step === STEPS.length - 1 ? "Empezar" : "Siguiente"}
          </button>
        </div>
      </section>
    </div>
  );
}
