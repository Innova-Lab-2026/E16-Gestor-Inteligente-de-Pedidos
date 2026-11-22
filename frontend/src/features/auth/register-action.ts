"use server";

export type RegisterState = {
  error?: string;
  success?: string;
  pendienteConfirmacion?: boolean;
};

export async function register(
  _previousState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const apiUrl = process.env.BACKEND_API_URL?.replace(/\/+$/, "");
  if (!apiUrl) {
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }

  try {
    const response = await fetch(`${apiUrl}/auth/register`, {
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
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return {
        error:
          body?.error?.message ??
          "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.",
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
  } catch {
    return { error: "No pudimos conectar con el servidor. Intentá nuevamente." };
  }
}
