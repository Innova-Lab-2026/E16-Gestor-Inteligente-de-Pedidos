"use client";

import { useState, type FormEvent } from "react";
import {
  actualizarEmprendimientoAction,
  type Emprendimiento,
  type EmprendimientoInput,
} from "@/features/emprendimientos/actions";
import { useEmprendimiento } from "@/features/emprendimientos/EmprendimientoProvider";
import type {
  CanalVenta,
  ModalidadEntrega,
} from "@/features/emprendimientos/constants";

const rubros = ["Facturas", "Farmacia", "Flores", "Otro"];
const canales: { value: CanalVenta; label: string }[] = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "EN_PERSONA", label: "En persona" },
];
const entregas: { value: ModalidadEntrega; label: string }[] = [
  { value: "RETIRO", label: "Retiro" },
  { value: "ENVIO", label: "Envío" },
];

export default function ConfiguracionEmprendimientoForm() {
  const { emprendimientoActivo, actualizarEmprendimiento } = useEmprendimiento();

  if (!emprendimientoActivo) {
    return (
      <section className="space-y-3 pt-2">
        <h1 className="text-2xl font-bold text-[#102a39]">Configuración</h1>
        <p className="text-sm text-[#586574]">
          Creá un emprendimiento para configurar sus datos.
        </p>
      </section>
    );
  }

  return (
    <ConfiguracionEmprendimiento
      key={emprendimientoActivo.id}
      activeBusiness={emprendimientoActivo}
      onUpdate={actualizarEmprendimiento}
    />
  );
}

function ConfiguracionEmprendimiento({
  activeBusiness,
  onUpdate,
}: {
  activeBusiness: Emprendimiento;
  onUpdate: (emprendimiento: Emprendimiento) => void;
}) {
  const [nombre, setNombre] = useState(activeBusiness.nombre ?? "");
  const [rubro, setRubro] = useState(activeBusiness.rubro ?? "");
  const [especialidad, setEspecialidad] = useState(
    activeBusiness.especialidad ?? "",
  );
  const [canalesVenta, setCanalesVenta] = useState<CanalVenta[]>(
    activeBusiness.canales_venta ?? [],
  );
  const [modalidadesEntrega, setModalidadesEntrega] =
    useState<ModalidadEntrega[]>(activeBusiness.modalidades_entrega ?? []);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const valid =
    nombre.trim().length > 0 &&
    rubro.length > 0 &&
    (rubro !== "Otro" || especialidad.trim().length > 0) &&
    canalesVenta.length > 0 &&
    modalidadesEntrega.length > 0;

  function toggle<T extends string>(
    value: T,
    current: T[],
    setValues: (next: T[]) => void,
  ) {
    setValues(
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    const input: EmprendimientoInput = {
      nombre: nombre.trim(),
      rubro,
      especialidad: rubro === "Otro" ? especialidad.trim() : null,
      canales_venta: canalesVenta,
      modalidades_entrega: modalidadesEntrega,
    };
    try {
      const result = await actualizarEmprendimientoAction(
        activeBusiness.id,
        input,
      );
      if (result.error || !result.data) {
        setError(result.error ?? "No pudimos actualizar el emprendimiento.");
        return;
      }

      onUpdate(result.data);
      setSuccess("Cambios guardados.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No pudimos actualizar el emprendimiento.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-[#102a39]">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-[#586574]">
          Editá los datos de {activeBusiness.nombre ?? "tu emprendimiento"}.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-[#e2e8f0] bg-white p-4"
      >
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-[#102a39]">
            Nombre del emprendimiento
          </span>
          <input
            required
            maxLength={150}
            value={nombre}
            onChange={(event) => setNombre(event.currentTarget.value)}
            className="h-12 w-full rounded-full border border-[#cbd5e1] px-4 text-sm outline-none focus:border-[#7622ed]"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-[#102a39]">
            ¿Qué vendés?
          </span>
          <select
            required
            value={rubro}
            onChange={(event) => {
              setRubro(event.currentTarget.value);
              if (event.currentTarget.value !== "Otro") setEspecialidad("");
            }}
            className="h-12 w-full rounded-full border border-[#cbd5e1] bg-white px-4 text-sm outline-none focus:border-[#7622ed]"
          >
            <option value="" disabled>
              Seleccioná un rubro
            </option>
            {rubro && !rubros.includes(rubro) && (
              <option value={rubro}>{rubro}</option>
            )}
            {rubros.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {rubro === "Otro" && (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-[#102a39]">
              Contanos cuál es tu producto
            </span>
            <input
              required
              maxLength={150}
              value={especialidad}
              onChange={(event) => setEspecialidad(event.currentTarget.value)}
              className="h-12 w-full rounded-full border border-[#cbd5e1] px-4 text-sm outline-none focus:border-[#7622ed]"
            />
          </label>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[#102a39]">
            Canales de pedido
          </legend>
          {canales.map((canal) => (
            <label
              key={canal.value}
              className="flex items-center gap-3 rounded-xl border border-[#d5e4f7] p-3 text-sm text-[#102a39]"
            >
              <input
                type="checkbox"
                checked={canalesVenta.includes(canal.value)}
                onChange={() =>
                  toggle(canal.value, canalesVenta, setCanalesVenta)
                }
                className="h-5 w-5 accent-[#7622ed]"
              />
              {canal.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-[#102a39]">
            Formas de entrega
          </legend>
          <div className="flex gap-2">
            {entregas.map((entrega) => {
              const selected = modalidadesEntrega.includes(entrega.value);
              return (
                <button
                  key={entrega.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    toggle(
                      entrega.value,
                      modalidadesEntrega,
                      setModalidadesEntrega,
                    )
                  }
                  className={`min-h-11 rounded-full border px-5 text-sm font-semibold transition ${
                    selected
                      ? "border-[#7622ed] bg-[#7622ed] text-white"
                      : "border-[#aabbd0] bg-white text-[#102a39]"
                  }`}
                >
                  {entrega.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-green-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid || saving}
          className="h-12 w-full rounded-full bg-[#0E4D64] text-sm font-bold text-white transition hover:bg-[#0a3f52] disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </section>
  );
}
