/**
 * Handle GET /dashboard request.
 * Coordinates operational summary from DashboardService.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
export function showDashboard(req, res) {
  const { dashboardService } = req.app.locals.services;
  const summary = dashboardService.getDashboardSummary();

  res.render("dashboard/index", {
    summary
  });
}

