import express from "express";
import cors from "cors";
import apiRoutes from "./routes/index.js";
import webhooksRoutes from "./routes/webhooks.routes.js";
import {
  errorMiddleware,
  notFoundMiddleware,
} from "./middlewares/error.middleware.js";

const app = express();

// Middlewares globales
app.use(cors());
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use("/webhooks", webhooksRoutes);

// API principal
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "API de gestion de pedidos multicanal",
    health: "/api/health",
  });
});

// 404 y manejador central de errores.
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
