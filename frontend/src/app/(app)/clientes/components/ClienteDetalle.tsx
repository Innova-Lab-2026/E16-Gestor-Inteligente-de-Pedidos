"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { editarClienteAction } from "../actions";
import type { Cliente, CondicionCliente } from "../types";

export default function ClienteDetalle({ cliente }: { cliente: Cliente }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [nombre, setNombre] = useState(cliente.nombre);
  const [apellido, setApellido] = useState(cliente.apellido ?? "");
  const [telefono, setTelefono] = useState(cliente.telefono ?? "");
  const [email, setEmail] = useState(cliente.email ?? "");
  const [tipoDocumento, setTipoDocumento] = useState(
    cliente.tipo_documento ?? "",
  );
  const [numeroDocumento, setNumeroDocumento] = useState(
    cliente.numero_documento ?? "",
  );
  const [direccion, setDireccion] = useState(cliente.direccion ?? "");
  const [observaciones, setObservaciones] = useState(
    cliente.observaciones ?? "",
  );
  const [condicion, setCondicion] = useState<CondicionCliente>(
    cliente.condicion ?? "OK",
  );

  const whatsappUrl = telefono.replace(/\D/g, "")
    ? `https://wa.me/${telefono.replace(/\D/g, "")}`
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOkMsg(null);
    setLoading(true);

    const res = await editarClienteAction(cliente.id, {
      nombre: nombre.trim(),
      apellido: apellido.trim() || undefined,
      telefono: telefono.trim() || undefined,
      email: email.trim() || undefined,
      tipo_documento: tipoDocumento.trim() || undefined,
      numero_documento: numeroDocumento.trim() || undefined,
      direccion: direccion.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      condicion,
    });

    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }

    setOkMsg("Datos del cliente actualizados.");
    router.refresh();
  }

  return (
    <div className="space-y-4 pb-12">
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 w-full items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700"
        >
          Escribir por WhatsApp ({cliente.telefono})
        </a>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      {okMsg && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {okMsg}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-3.5 rounded-2xl border border-[#e2e8f0] bg-white p-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">
              Nombre *
            </span>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">
              Apellido
            </span>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">Teléfono</span>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej: 5491123456789"
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-5 gap-2">
          <label className="col-span-2 block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">Tipo</span>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-3 text-xs focus:outline-none"
            >
              <option value="">Doc...</option>
              <option value="DNI">DNI</option>
              <option value="CUIT">CUIT</option>
              <option value="CUIL">CUIL</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>

          <label className="col-span-3 block space-y-1">
            <span className="text-xs font-semibold text-[#586574]">
              Número de documento
            </span>
            <input
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ej: 35123456"
              className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">
            Dirección de entrega
          </span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Ej: Av. Rivadavia 1234, Piso 2"
            className="h-11 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">
            Condición comercial
          </span>
          <select
            value={condicion}
            onChange={(e) => setCondicion(e.target.value as CondicionCliente)}
            className="h-11 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
          >
            <option value="OK">OK (Habilitado)</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold text-[#586574]">
            Observaciones
          </span>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Referencias del domicilio, horarios preferidos..."
            className="w-full rounded-2xl border-2 border-[#102a39] p-3 text-sm focus:outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="h-11 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}