import { Router } from "express";

import { showHealth } from "../controllers/healthController.js";
import { showHome } from "../controllers/homeController.js";

const router = Router();

router.get("/", showHome);
router.get("/health", showHealth);

export default router;