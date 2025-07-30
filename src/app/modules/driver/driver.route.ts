import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { DriverController } from "./driver.controller";
import { validateRequest } from "../../middlewares/validateRequests";
import { createDriverZodSchema } from "./driver.validation";

const router = Router();

router.post("/apply-driver", checkAuth(Role.RIDER), DriverController.applyToBeDriver, validateRequest(createDriverZodSchema));

export const DriverRoutes = router;
