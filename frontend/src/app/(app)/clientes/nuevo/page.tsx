"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearClienteAction } from "../actions";
import type { CondicionCliente } from "../types";

export default function NuevoClientePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [condicion, setCondicion] = useState<CondicionCliente>("OK");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await crearClienteAction({
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

    router.push("/clientes");
  }

  return (
    <section className="space-y-5 pt-2 pb-12">
      <div className="flex items-center gap-3">
        <Link
          href="/clientes"
          className="text-lg font-bold text-[#102a39]"
          aria-label="Volver a clientes"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#7622ed]">
            Clientes &gt; Nuevo
          </h1>
          <p className="text-xs text-[#586574]">
            Registrá los datos de contacto y entrega del cliente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">Nombre *</span>
            <input
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan"
              className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-semibold">Apellido</span>
            <input
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              placeholder="Ej: Pérez"
              className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Teléfono (WhatsApp)</span>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="Ej: 5491123456789"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Dirección de entrega</span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            placeholder="Ej: Av. Rivadavia 1234"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Email (Opcional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-5 gap-2">
          <label className="col-span-2 block space-y-1">
            <span className="text-sm font-semibold">Tipo Doc.</span>
            <select
              value={tipoDocumento}
              onChange={(e) => setTipoDocumento(e.target.value)}
              className="h-12 w-full rounded-full border-2 border-[#102a39] bg-white px-3 text-xs focus:outline-none"
            >
              <option value="">Opcional...</option>
              <option value="DNI">DNI</option>
              <option value="CUIT">CUIT</option>
              <option value="CUIL">CUIL</option>
              <option value="PASAPORTE">Pasaporte</option>
            </select>
          </label>

          <label className="col-span-3 block space-y-1">
            <span className="text-sm font-semibold">Número Doc.</span>
            <input
              value={numeroDocumento}
              onChange={(e) => setNumeroDocumento(e.target.value)}
              placeholder="Ej: 35123456"
              className="h-12 w-full rounded-full border-2 border-[#102a39] px-4 text-sm focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">Condición</span>
          <select
            value={condicion}
            onChange={(e) => setCondicion(e.target.value as CondicionCliente)}
            className="h-12 w-full rounded-full border-2 border-[#102a39] bg-white px-4 text-sm focus:outline-none"
          >
            <option value="OK">OK</option>
            <option value="SUSPENDIDO">Suspendido</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-semibold">
            Observaciones (Opcional)
          </span>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Timbre, piso, entre calles..."
            className="w-full rounded-2xl border-2 border-[#102a39] p-3 text-sm focus:outline-none"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-12 w-full rounded-full bg-[#056184] text-sm font-bold text-white transition hover:bg-[#044d69] disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Guardar cliente"}
        </button>
      </form>
    </section>
  );
}