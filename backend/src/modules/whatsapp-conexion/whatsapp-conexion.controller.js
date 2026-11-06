import logger from "../../utils/logger.js";
import { WhatsAppConexionService } from "./whatsapp-conexion.service.js";

/**
 * Controller de conexiones de WhatsApp.
 * Capa HTTP pura: recibe request, valida con DTO, invoca el servicio
 * y arma la respuesta. No contiene reglas de negocio ni credenciales.
 */
export class WhatsAppConexionController {
  constructor({ servicioFactory } = {}) {
    this.servicioFactory =
      servicioFactory || ((token) => new WhatsAppConexionService());
  }

  #service() {
    return typeof this.servicioFactory === "function"
      ? this.servicioFactory()
      : this.servicioFactory;
  }

  /** POST /api/canales/whatsapp/conectar */
  iniciarConexion = async (req, res) => {
    const { emprendimientoId, nombreCanal } = req.validated.body;
    const usuarioId = req.user.id;

    const resultado = await this.#service().iniciarConexion({
      emprendimientoId,
      usuarioId,
      nombreCanal,
    });

    // Nunca exponer el state en el cuerpo si contiene datos sensibles;
    // el state se valida en el callback. Se devuelve solo para debugging
    // en desarrollo; en produccion el frontend lo maneja via redirect.
    return res.status(200).json({
      connectionUrl: resultado.connectionUrl,
      estado: resultado.estado,
    });
  };

  /** POST /api/canales/whatsapp/conectar-manual */
  conectarManual = async (req, res) => {
    const { wabaId, phoneNumberId, numeroTelefono, accessToken, nombreCanal } =
      req.validated.body;
    const emprendimientoId = req.tenant.id;
    const usuarioId = req.user.id;

    const resultado = await this.#service().conectarManual({
      emprendimientoId,
      usuarioId,
      wabaId,
      phoneNumberId,
      numeroTelefono,
      accessToken,
      nombreCanal,
    });

    return res.status(200).json({
      message: "Conexion de WhatsApp creada exitosamente",
      ...resultado,
    });
  };
  /** GET /api/canales/whatsapp/callback */

  completarConexion = async (req, res) => {
    const { code, state } = req.validated.query;
    const { emprendimientoId } = req.validated.body;
    const usuarioId = req.user.id;

    const resultado = await this.#service().completarConexion({
      emprendimientoId,
      usuarioId,
      code,
      state,
    });

    return res.status(200).json({
      message: "Conexion de WhatsApp completada exitosamente",
      ...resultado,
    });
  };

  /** GET /api/canales/whatsapp */
  listarConexiones = async (req, res) => {
    const { emprendimientoId } = req.validated.query;
    const usuarioId = req.user.id;

    const conexiones = await this.#service().listarConexiones(
      emprendimientoId,
      usuarioId,
    );

    return res.status(200).json(conexiones);
  };

  /** GET /api/canales/whatsapp/:id */
  obtenerConexion = async (req, res) => {
    const { id } = req.validated.params;
    const { emprendimientoId } = req.validated.query;
    const usuarioId = req.user.id;

    const conexion = await this.#service().obtenerConexion(
      emprendimientoId,
      id,
      usuarioId,
    );

    return res.status(200).json(conexion);
  };

  /** POST /api/canales/whatsapp/:id/desactivar */
  desactivarConexion = async (req, res) => {
    const { id } = req.validated.params;
    const { emprendimientoId } = req.validated.body;
    const usuarioId = req.user.id;

    const resultado = await this.#service().desactivarConexion(
      emprendimientoId,
      id,
      usuarioId,
    );

    return res.status(200).json(resultado);
  };

  /** DELETE /api/canales/whatsapp/:id */
  eliminarConexion = async (req, res) => {
    const { id } = req.validated.params;
    const { emprendimientoId } = req.validated.body;
    const usuarioId = req.user.id;

    const resultado = await this.#service().eliminarConexion(
      emprendimientoId,
      id,
      usuarioId,
    );

    return res.status(200).json(resultado);
  };

  /** POST /api/canales/whatsapp/enviar */
  enviarMensaje = async (req, res) => {
    const {
      conexionId,
      telefonoDestino,
      tipo,
      texto,
      nombrePlantilla,
      idiomaPlantilla,
      parametrosPlantilla,
    } = req.validated.body;
    const { emprendimientoId } = req.validated.body;
    const usuarioId = req.user.id;

    // Validar que la conexion exista y pertenezca al emprendimiento
    await this.#service().obtenerConexion(
      emprendimientoId,
      conexionId,
      usuarioId,
    );

    const accessToken = await this.#service().obtenerAccessToken(
      emprendimientoId,
      conexionId,
      usuarioId,
    );

    // Delegar el envio al adapter de WhatsApp
    const { channelAdapterFactory } =
      await import("../../adapters/channel-adapter.factory.js");
    const adapter = channelAdapterFactory.get("WHATSAPP");

    const resultado = await adapter.sendMessage({
      accessToken,
      phoneNumberId: conexionId, // Se resuelve el phone_number_id desde la conexion
      telefonoDestino,
      tipo,
      texto,
      nombrePlantilla,
      idiomaPlantilla,
      parametrosPlantilla,
    });

    return res.status(200).json({
      message: "Mensaje enviado",
      resultado,
    });
  };
}

export default WhatsAppConexionController;
