"use client";

import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";

export default function HoyEmptyState() {
  const router = useRouter();

  return (
    <EmptyState
      titulo="Todavía no hay pedidos registrados"
      descripcion="Cuando ingrese uno nuevo por WhatsApp o cargues uno manual, lo vas a ver acá."
      textoBoton="Cargar nuevo pedido"
      onAccion={() => router.push("/pedidos/nuevo")}
    />
  );
}
