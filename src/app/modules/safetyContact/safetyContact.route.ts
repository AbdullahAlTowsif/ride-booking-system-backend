import { Router } from "express";
import { SafetyContactController } from "./safetyContact.controller";
import { Role } from "../user/user.interface";
import { checkAuth } from "../../middlewares/checkAuth";

const router = Router();

router.get("/", checkAuth(Role.RIDER), SafetyContactController.getContacts);
router.post("/", checkAuth(Role.RIDER), SafetyContactController.saveContacts);

export const SafetyContactRoutes = router;
