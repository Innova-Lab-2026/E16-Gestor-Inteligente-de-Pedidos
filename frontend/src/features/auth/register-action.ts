"use server";

export type RegisterState = {
  error?: string;
  success?: string;
  pendienteConfirmacion?: boolean;
};

function getBackendErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;

  const body = payload as Record<string, unknown>;
  const backendError = body.error;

  if (typeof backendError === "string" && backendError.trim()) {
    return backendError;
  }
  if (
    typeof backendError === "object" &&
    backendError !== null &&
    "message" in backendError &&
    typeof backendError.message === "string" &&
    backendError.message.trim()
  ) {
    return backendError.message;
  }
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  return undefined;
}

export async function register(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const apiUrl = process.env.BACKEND_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    console.error("[register] Falta configurar BACKEND_API_URL");
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }

  try {
    const canalesVenta = {
      WhatsApp: "WHATSAPP",
      Telegram: "TELEGRAM",
      Texto: "EN_PERSONA",
    };
    const modalidadesEntrega = {
      Retiro: "RETIRO",
      "Envío": "ENVIO",
    };
    const selectedChannels = formData.getAll("channels").map(String);
    const selectedDeliveryModes = JSON.parse(
      String(formData.get("deliveryModes") ?? "[]"),
    ) as string[];

    const response = await fetch(`${apiUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        metadata: {
          nombre: formData.get("nombre"),
          apellido: formData.get("apellido"),
          dni: formData.get("dni"),
          emprendimiento: {
            rubro: formData.get("productType"),
            productoOtro: formData.get("customProduct"),
          },
          canales: {
            whatsapp: formData.get("channels") && formData.getAll("channels").includes("WhatsApp")
              ? formData.get("whatsappPhone")
              : null,
            telegram: formData.getAll("channels").includes("Telegram")
              ? formData.get("telegramPhone")
              : null,
            cargaManual: formData.getAll("channels").includes("Texto"),
          },
          entregas: {
            modalidades: JSON.parse(String(formData.get("deliveryModes") ?? "[]")),
            direccionRetiro: formData.get("pickupAddress"),
          },
        },
        emprendimiento: {
          nombre: formData.get("businessName"),
          rubro: formData.get("productType"),
          especialidad: formData.get("customProduct"),
          canales_venta: selectedChannels
            .map((channel) => canalesVenta[channel as keyof typeof canalesVenta])
            .filter(Boolean),
          modalidades_entrega: selectedDeliveryModes
            .map(
              (mode) =>
                modalidadesEntrega[mode as keyof typeof modalidadesEntrega],
            )
            .filter(Boolean),
        },
      }),
    });

    if (!response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch (error) {
        console.error("[register] El backend devolvió una respuesta inválida", {
          status: response.status,
          error,
        });
      }

      console.error("[register] El backend rechazó el registro", {
        status: response.status,
        message: getBackendErrorMessage(body),
      });
      return {
        error: "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.",
      };
    }

    const resultado = await response.json();
    if (resultado.pendienteConfirmacion) {
      return {
        success: "Cuenta creada. Revisá tu email y confirmá la cuenta antes de iniciar sesión.",
        pendienteConfirmacion: true,
      };
    }

    return {
      success: "Cuenta creada. Ya podés iniciar sesión con tu email y contraseña.",
      pendienteConfirmacion: false,
    };
  } catch (error) {
    console.error("[register] Error técnico al crear la cuenta", error);
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }
}
