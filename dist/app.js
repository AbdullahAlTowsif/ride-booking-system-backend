"use strict";
// import express, { Request, Response } from "express";
// import { router } from "./app/routes";
// import { globalErrorHandler } from "./app/middlewares/globalErrorHandler";
// import "./app/config/passport";
// import passport from "passport";
// import cookieParser from "cookie-parser";
// import expressSession from "express-session";
// import { envVars } from "./app/config/env";
// import cors from "cors";
// import notFound from "./app/middlewares/notFound";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const app = express();
// // 1. Trust proxy first (if behind reverse proxy)
// app.set("trust proxy", 1);
// // 2. CORS - MUST come before body parsers and routes
// app.use(
//   cors({
//     origin: envVars.FRONTEND_URL,
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
//   })
// );
// // 3. Body parsing middleware - MUST come after CORS but before routes
// app.use(express.json({ limit: '10mb' })); // For JSON bodies
// app.use(express.urlencoded({ extended: true, limit: '10mb' })); // For form data
// // 4. Cookie parser
// app.use(cookieParser());
// // 5. Session middleware
// app.use(
//   expressSession({
//     secret: envVars.EXPRESS_SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
//       httpOnly: true,
//       maxAge: 24 * 60 * 60 * 1000 // 24 hours
//     }
//   })
// );
// // 6. Passport middleware
// app.use(passport.initialize());
// app.use(passport.session());
// // 7. Routes
// app.use("/api", router);
// // 8. Health check route
// app.get("/", (req: Request, res: Response) => {
//   res.status(200).json({
//     message: "Welcome to Ride Booking System Backend!",
//   });
// });
// // 9. Global error handler
// app.use(globalErrorHandler);
// // 10. Not found handler (should be last)
// app.use(notFound);
// export default app;
const express_1 = __importDefault(require("express"));
const routes_1 = require("./app/routes");
const globalErrorHandler_1 = require("./app/middlewares/globalErrorHandler");
require("./app/config/passport");
const passport_1 = __importDefault(require("passport"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
const env_1 = require("./app/config/env");
const cors_1 = __importDefault(require("cors"));
const notFound_1 = __importDefault(require("./app/middlewares/notFound"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({
    origin: env_1.envVars.FRONTEND_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
app.use((0, express_session_1.default)({
    secret: env_1.envVars.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.set("trust proxy", 1);
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use("/api", routes_1.router);
app.get("/", (req, res) => {
    res.status(200).json({
        message: "Welcome to Ride Booking System Backend!",
    });
});
app.use(globalErrorHandler_1.globalErrorHandler);
app.use(notFound_1.default);
exports.default = app;
