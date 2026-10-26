import { Router } from "express";

import { showHealth } from "../controllers/healthController.js";
import { showHome } from "../controllers/homeController.js";
import residentRoutes from "./residentRoutes.js";

const router = Router();

router.get("/", showHome);
router.get("/health", showHealth);
router.use("/residents", residentRoutes);

export default router;