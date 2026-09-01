"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiatePaymentZodSchema = void 0;
const zod_1 = require("zod");
exports.initiatePaymentZodSchema = zod_1.z.object({
    rideId: zod_1.z.string({ message: "Ride ID is required" }).min(1, "Ride ID is required"),
});
