"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  persistActiveEmprendimiento,
  type Emprendimiento,
} from "./actions";
import { EMPRENDIMIENTO_STORAGE_KEY } from "./constants";

type EmprendimientoContextValue = {
  emprendimientos: Emprendimiento[];
  emprendimientoActivo: Emprendimiento | null;
  seleccionarEmprendimiento: (id: string) => Promise<boolean>;
  agregarEmprendimiento: (emprendimiento: Emprendimiento) => void;
  actualizarEmprendimiento: (emprendimiento: Emprendimiento) => void;
  error: string | null;
};

const EmprendimientoContext =
  createContext<EmprendimientoContextValue | null>(null);

export function EmprendimientoProvider({
  emprendimientos,
  initialActiveId,
  children,
}: {
  emprendimientos: Emprendimiento[];
  initialActiveId: string | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [businesses, setBusinesses] = useState(emprendimientos);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [error, setError] = useState<string | null>(null);

  const seleccionarEmprendimiento = useCallback(
    async (id: string) => {
      const selected = businesses.find((item) => item.id === id);
      if (!selected) {
        setError("El emprendimiento seleccionado ya no está disponible.");
        return false;
      }

      const result = await persistActiveEmprendimiento(id);
      if (result.error) {
        setError(result.error);
        return false;
      }

      window.localStorage.setItem(EMPRENDIMIENTO_STORAGE_KEY, id);
      setActiveId(id);
      setError(null);
      router.refresh();
      return true;
    },
    [businesses, router],
  );

  const agregarEmprendimiento = useCallback((emprendimiento: Emprendimiento) => {
    setBusinesses((current) => [
      ...current.filter((item) => item.id !== emprendimiento.id),
      emprendimiento,
    ]);
    setActiveId(emprendimiento.id);
    window.localStorage.setItem(
      EMPRENDIMIENTO_STORAGE_KEY,
      emprendimiento.id,
    );
    setError(null);
  }, []);

  const actualizarEmprendimiento = useCallback(
    (emprendimiento: Emprendimiento) => {
      setBusinesses((current) =>
        current.map((item) =>
          item.id === emprendimiento.id ? emprendimiento : item,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const savedId = window.localStorage.getItem(EMPRENDIMIENTO_STORAGE_KEY);
    const savedEmprendimiento = emprendimientos.find(
      (item) => item.id === savedId,
    );
    const selectedId = savedEmprendimiento?.id ?? initialActiveId;

    if (!selectedId) return;

    void persistActiveEmprendimiento(selectedId).then((result) => {
      if (result.error) {
        setError(result.error);
        return;
      }
      window.localStorage.setItem(EMPRENDIMIENTO_STORAGE_KEY, selectedId);
      setActiveId(selectedId);
      if (selectedId !== initialActiveId) router.refresh();
    });
  }, [emprendimientos, initialActiveId, router]);

  const value = useMemo(
    () => ({
      emprendimientos: businesses,
      emprendimientoActivo:
        businesses.find((item) => item.id === activeId) ?? null,
      seleccionarEmprendimiento,
      agregarEmprendimiento,
      actualizarEmprendimiento,
      error,
    }),
    [
      activeId,
      agregarEmprendimiento,
      actualizarEmprendimiento,
      businesses,
      error,
      seleccionarEmprendimiento,
    ],
  );

  return (
    <EmprendimientoContext.Provider value={value}>
      {children}
    </EmprendimientoContext.Provider>
  );
}

export function useEmprendimiento() {
  const context = useContext(EmprendimientoContext);
  if (!context) {
    throw new Error(
      "useEmprendimiento debe usarse dentro de EmprendimientoProvider.",
    );
  }
  return context;
}
