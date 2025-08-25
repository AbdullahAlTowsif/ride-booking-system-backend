import { Router } from "express";
import { AlertController } from "./alert.controller";

const router = Router();

router.post("/", AlertController.createAlert);

export const AlertRoutes = router;
