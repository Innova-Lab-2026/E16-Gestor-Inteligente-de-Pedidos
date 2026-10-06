import { AuthService } from "./auth.service.js";
import { EmprendimientoService } from "../emprendimientos/emprendimiento.service.js";

/**
 * Controller de autenticación. Sólo HTTP + DTOs.
 */
export class AuthController {
  constructor({ authService, emprendimientoService } = {}) {
    this.authService = authService || new AuthService();
    this.emprendimientoService =
      emprendimientoService || new EmprendimientoService();
  }

  /** POST /api/auth/register */
  register = async (req, res) => {
    const { email, password, metadata, emprendimiento } = req.validated.body;

    const resultado = await this.authService.register({
      email,
      password,
      metadata,
      emprendimiento,
    });

    return res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: resultado.user,
      session: resultado.session,
      emprendimiento: resultado.emprendimiento,
    });
  };

  /** POST /api/auth/login */
  login = async (req, res) => {
    const { email, password } = req.validated.body;
    const resultado = await this.authService.login({ email, password });
    return res.status(200).json(resultado);
  };

  /** GET /api/auth/me (protegido) */
  me = async (req, res) => {
    const user = await this.authService.me(req.userToken);
    return res.status(200).json({
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
      created_at: user.created_at,
    });
  };

  /** PUT /api/auth/me (protegido) */
  updateMe = async (req, res) => {
    const { metadata, password } = req.validated.body;
    const user = await this.authService.update({
      userToken: req.userToken,
      metadata,
      password,
    });
    return res.status(200).json({ message: "Usuario actualizado", user });
  };
}

export default AuthController;