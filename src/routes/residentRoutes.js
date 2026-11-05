import { Router } from "express";
import {
  listResidents,
  showRegisterForm,
  registerResident,
  showEditForm,
  updateResident,
  deactivateResident
} from "../controllers/residentController.js";

const router = Router();

router.get("/", listResidents);
router.get("/register", showRegisterForm);
router.post("/register", registerResident);
router.get("/:id/edit", showEditForm);
router.post("/:id/edit", updateResident);
router.post("/:id/deactivate", deactivateResident);

export default router;
