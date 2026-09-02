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

// app.use(
//   cors({
//     origin: envVars.FRONTEND_URL || "http://localhost:5173",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//   })
// );

const allowedOrigins = [
  envVars.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean); // drop undefined if FRONTEND_URL isn't set

app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser requests (curl, Postman) with no origin
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);


app.use(
  expressSession({
    secret: envVars.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("trust proxy", 1);
app.use(passport.initialize());
app.use(passport.session());



app.use("/api", router);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    message: "Welcome to Ride Booking System Backend!",
  });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;