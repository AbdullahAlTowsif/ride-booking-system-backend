import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { DriverController } from "./driver.controller";
import { validateRequest } from "../../middlewares/validateRequests";
import { createDriverZodSchema } from "./driver.validation";

const router = Router();

router.post("/apply-driver", checkAuth(Role.RIDER), validateRequest(createDriverZodSchema), DriverController.applyToBeDriver);
router.get("/rides-available", checkAuth(Role.DRIVER), DriverController.getAvailableRides);
router.patch("/rides/:id/accept", checkAuth(Role.DRIVER), DriverController.acceptRide);
router.patch("/rides/:id/reject", checkAuth(Role.DRIVER), DriverController.rejectRide);
router.patch("/rides/:id/status", checkAuth(Role.DRIVER), DriverController.updateRideStatus);
router.get("/earning-history", checkAuth(Role.DRIVER), DriverController.getRideHistory);
router.patch("/availability", checkAuth(Role.DRIVER), DriverController.updateAvailability);
router.get("/me-driver", checkAuth(Role.DRIVER), DriverController.getMeDriver);
router.get("/my-rides", checkAuth(Role.DRIVER), DriverController.getMyRides);
router.get("/profile", checkAuth(Role.DRIVER), DriverController.getDriverProfile);
router.patch("/update-driver-profile", checkAuth(Role.DRIVER), DriverController.updateDriverProfile);

export const DriverRoutes = router;
