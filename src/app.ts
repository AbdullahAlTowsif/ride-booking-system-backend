import express, { Request, Response } from "express";
import { router } from "./app/routes";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import "./app/config/passport";
import passport from "passport";

const app = express();

app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());
app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to Ride Booking System Backend!"
    })
})

app.use(globalErrorHandler);

export default app;