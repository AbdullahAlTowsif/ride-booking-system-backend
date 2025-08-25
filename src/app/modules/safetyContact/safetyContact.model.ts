import { Schema, model } from "mongoose";
import { IRiderSafety } from "./safetyContact.interface";

const SafetyContactSchema = new Schema<IRiderSafety>({
  riderId: { type: String, required: true, unique: true },
  contacts: [
    {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String },
    },
  ],
});

export const SafetyContact = model<IRiderSafety>("SafetyContact", SafetyContactSchema);
