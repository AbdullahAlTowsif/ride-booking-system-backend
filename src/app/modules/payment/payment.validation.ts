import { z } from "zod";

export const initiatePaymentZodSchema = z.object({
  rideId: z.string({ message: "Ride ID is required" }).min(1, "Ride ID is required"),
});
