import { DashboardService } from "./dashboard.service.js";

/** Controller del panel. */
export class DashboardController {
  constructor({ dashboardServiceFactory } = {}) {
    this.serviceFactory =
      dashboardServiceFactory || ((token) => new DashboardService({ token }));
  }

  /** GET /api/dashboard */
  resumen = async (req, res) => {
    const { desde, hasta } = req.query;
    const result = await this.serviceFactory(req.userToken).resumen(req.tenant.id, {
      desde,
      hasta,
    });
    return res.status(200).json(result);
  };
}

export default DashboardController;