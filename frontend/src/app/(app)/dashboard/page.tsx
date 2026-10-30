import { requireSession } from "@/features/auth/guards";
import { logout } from "@/features/auth/actions";

export default async function DashboardPage() {
  const session = await requireSession();
  const displayName =
    session.user_metadata?.nombre ?? session.nombre ?? session.email ?? "tu cuenta";

  return (
    <section className="mx-auto w-full max-w-5xl" aria-labelledby="dashboard-title">
      <h1 id="dashboard-title" className="text-2xl font-semibold">
        Bienvenido, {String(displayName)}
      </h1>
      <p className="mt-2 text-gray-600">
        Iniciaste sesión correctamente.
      </p>
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        >
          Cerrar Sesión
        </button>
      </form>
    </section>
  );
}
