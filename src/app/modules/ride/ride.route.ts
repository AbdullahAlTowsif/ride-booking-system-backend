import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { RideController } from "./ride.controller";
import { validateRequest } from "../../middlewares/validateRequests";
import { createRideZodSchema } from "./ride.validation";

const router = Router();

router.post("/request", checkAuth(Role.RIDER), validateRequest(createRideZodSchema), RideController.createRide)
router.patch("/:id/cancel", checkAuth(Role.RIDER), RideController.cancelRide)
router.get("/me", checkAuth(Role.RIDER), RideController.getMyRides)
router.get("/:id", checkAuth(Role.RIDER), RideController.getSingleRide)

export const RideRoutes = router;