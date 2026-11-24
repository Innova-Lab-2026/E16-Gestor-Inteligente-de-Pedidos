import ConfiguracionEmprendimientoForm from "./ConfiguracionEmprendimientoForm";
import { logout } from "@/features/auth/actions";

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <ConfiguracionEmprendimientoForm />
      <form action={logout} className="border-t border-[#e2e8f0] pt-4">
        <button
          type="submit"
          className="min-h-11 rounded-full border border-red-200 bg-white px-5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}