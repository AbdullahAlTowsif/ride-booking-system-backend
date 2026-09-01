import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { validateRequest } from "../../middlewares/validateRequests";
import { Role } from "../user/user.interface";
import { PaymentController } from "./payment.controller";
import { initiatePaymentZodSchema } from "./payment.validation";

const router = Router();

router.post(
  "/initiate",
  checkAuth(Role.RIDER),
  validateRequest(initiatePaymentZodSchema),
  PaymentController.initiate
);
router.post("/ipn", PaymentController.handleIpn);
router.post("/success", PaymentController.handleSuccess);
router.post("/fail", PaymentController.handleFail);
router.post("/cancel", PaymentController.handleCancel);
router.get(
  "/:rideId/status",
  checkAuth(Role.RIDER, Role.ADMIN),
  PaymentController.getRideStatus
);
router.get("/me", checkAuth(Role.RIDER), PaymentController.getMyPayments);

export const PaymentRoutes = router;
