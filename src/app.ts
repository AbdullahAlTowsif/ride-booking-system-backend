import express, { Request, Response } from "express";
import { router } from "./app/routes";

const app = express();

app.use(express.json());
app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to Ride Booking System Backend!"
    })
})

export default app;