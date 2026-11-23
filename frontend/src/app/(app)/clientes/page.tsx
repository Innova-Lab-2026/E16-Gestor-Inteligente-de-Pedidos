import { getClientes } from "./api";
import ClientesList from "./components/ClientesList";

export default async function ClientesPage() {
  const { data, error } = await getClientes();

  return (
    <section className="space-y-4 pt-2">
      <div>
        <h1 className="text-2xl font-bold text-[#102a39]">Clientes</h1>
        <p className="text-sm text-[#586574]">
          Agenda de compradores, direcciones y contacto rápido.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>
      ) : (
        <ClientesList clientes={data ?? []} />
      )}
    </section>
  );
}