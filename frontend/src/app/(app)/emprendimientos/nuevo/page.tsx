"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import EmprendimientoSetupWizard, {
  type EmprendimientoSetupValues,
} from "@/components/emprendimientos/EmprendimientoSetupWizard";
import { useEmprendimiento } from "@/features/emprendimientos/EmprendimientoProvider";
import { crearEmprendimientoAction } from "@/features/emprendimientos/actions";
import type {
  CanalVenta,
  ModalidadEntrega,
} from "@/features/emprendimientos/constants";

const canalValues: Record<string, CanalVenta> = {
  WhatsApp: "WHATSAPP",
  Telegram: "TELEGRAM",
  Texto: "EN_PERSONA",
};

const deliveryValues: Record<string, ModalidadEntrega> = {
  Retiro: "RETIRO",
  "Envío": "ENVIO",
};

export default function NuevoEmprendimientoPage() {
  const router = useRouter();
  const { agregarEmprendimiento } = useEmprendimiento();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: EmprendimientoSetupValues) {
    setError(null);
    setLoading(true);

    try {
      const result = await crearEmprendimientoAction({
        nombre: values.nombre,
        rubro: values.rubro,
        especialidad: values.rubro === "Otro" ? values.especialidad : null,
        canales_venta: values.canales.flatMap((channel) =>
          canalValues[channel] ? [canalValues[channel]] : [],
        ),
        modalidades_entrega: values.modalidades.flatMap((mode) =>
          deliveryValues[mode] ? [deliveryValues[mode]] : [],
        ),
      });

      if (result.error || !result.data) {
        setError(result.error ?? "No pudimos crear el emprendimiento.");
        return;
      }

      agregarEmprendimiento(result.data);
      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No pudimos crear el emprendimiento.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <EmprendimientoSetupWizard
      backHref="/dashboard"
      compact
      error={error}
      onComplete={handleSubmit}
      pending={loading}
      showPhoneInputs={false}
      showPickupAddress={false}
      submitLabel="Crear emprendimiento"
    />
  );
}
