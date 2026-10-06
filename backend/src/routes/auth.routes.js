import { Router } from "express";
import { z } from "zod";
import { validate } from "../middlewares/validator.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { AuthController } from "../modules/auth/auth.controller.js";
import { loginSchema } from "../modules/auth/dtos/login.dto.js";
import { registerSchema } from "../modules/auth/dtos/register.dto.js";

const router = Router();
const controller = new AuthController();

// Público: alta de usuario (Supabase Auth) y login.
router.post("/register", validate({ body: registerSchema }), controller.register);
router.post("/login", validate({ body: loginSchema }), controller.login);

// Protegido: perfil del usuario autenticado.
router.get("/me", authMiddleware, controller.me);
router.put(
  "/me",
  authMiddleware,
  validate({
    body: z
      .object({
        metadata: z.record(z.any()).optional(),
        password: z.string().min(8).optional(),
      })
      .refine((dto) => dto.metadata || dto.password, {
        message: "Debe enviarse 'metadata' o 'password'",
      }),
  }),
  controller.updateMe
);

export default router;