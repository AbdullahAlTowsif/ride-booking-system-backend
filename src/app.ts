import express, { Request, Response } from "express";
import { router } from "./app/routes";
import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
import "./app/config/passport";
import passport from "passport";
import cookieParser from "cookie-parser";
import expressSession from "express-session";
import { envVars } from "./app/config/env";
import cors from "cors";
import notFound from "./app/middlewares/notFound";

const app = express();

app.use(expressSession({
    secret: envVars.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))

app.use(cookieParser())
app.use(express.json());
app.set("trust proxy", 1);
app.use(passport.initialize());
app.use(passport.session());

app.use(cors({
    origin: envVars.FRONTEND_URL,
    credentials: true
}));

app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
    res.status(200).json({
        message: "Welcome to Ride Booking System Backend!"
    })
})

app.use(globalErrorHandler);

app.use(notFound);

export default app;