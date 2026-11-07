import { Router } from "express";
import { showDashboard } from "../controllers/dashboardController.js";

const router = Router();

router.get("/", showDashboard);

export default router;

