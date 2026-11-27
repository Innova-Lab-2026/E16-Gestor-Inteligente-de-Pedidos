import Link from "next/link";
import { getClienteById } from "../api";
import ClienteDetalle from "../components/ClienteDetalle";

export default async function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: cliente, error } = await getClienteById(id);

  if (error || !cliente) {
    return (
      <section className="space-y-4 pt-2">
        <Link href="/clientes" className="text-sm font-bold text-[#102a39]">
          ← Volver a clientes
        </Link>
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">
          {error ?? "No encontramos el cliente."}
        </p>
      </section>
    );
  }

  const nombreCompleto = [cliente.nombre, cliente.apellido]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="space-y-4 pt-2">
      <div className="app-page-heading">
        <Link
          href="/clientes"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          aria-label="Volver a clientes"
        >
          ← Volver
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {nombreCompleto}
          </h1>
          <p className="text-xs text-[#586574]">
            Editá los datos de contacto y condición del cliente.
          </p>
        </div>
      </div>

      <ClienteDetalle cliente={cliente} />
    </section>
  );
}