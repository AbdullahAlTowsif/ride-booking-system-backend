"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyContact = void 0;
const mongoose_1 = require("mongoose");
const SafetyContactSchema = new mongoose_1.Schema({
    riderId: { type: String, required: true, unique: true },
    contacts: [
        {
            name: { type: String, required: true },
            phone: { type: String, required: true },
            email: { type: String },
        },
    ],
});
exports.SafetyContact = (0, mongoose_1.model)("SafetyContact", SafetyContactSchema);
