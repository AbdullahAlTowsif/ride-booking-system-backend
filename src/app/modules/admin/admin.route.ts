import { Router } from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../user/user.interface";
import { AdminController } from "./admin.controller";

const router = Router();

router.patch("/driver/approve/:id", checkAuth(Role.ADMIN), AdminController.approveDriver);
router.patch("/driver/suspend/:id", checkAuth(Role.ADMIN), AdminController.suspendDriver);

export const AdminRoutes = router;