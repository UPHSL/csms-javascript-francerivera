import { Router } from "express";
import {
  listServiceRequests,
  showNewForm,
  submitServiceRequest,
  viewServiceRequest,
  updateStatus,
  startProcessing,
  completeRequest,
  cancelRequest
} from "../controllers/serviceRequestController.js";

const router = Router();

// Listing & Search / Filter
router.get("/", listServiceRequests);

// Submission form & Submit
router.get("/new", showNewForm);
router.post("/new", submitServiceRequest);

// View details
router.get("/:id", viewServiceRequest);

// Status workflows
router.post("/:id/status", updateStatus);
router.post("/:id/start-processing", startProcessing);
router.post("/:id/complete", completeRequest);
router.post("/:id/cancel", cancelRequest);

export default router;
