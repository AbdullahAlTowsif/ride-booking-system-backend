"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertService = void 0;
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const sendAlerts = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const { contacts, message } = payload;
    if (!(contacts === null || contacts === void 0 ? void 0 : contacts.length)) {
        throw new AppError_1.default(400, "No contacts provided");
    }
    yield Promise.all(contacts.map((c) => __awaiter(void 0, void 0, void 0, function* () {
        console.log(`Sending alert to ${c.name} (${c.phone}) → ${message}`);
    })));
    return { ok: true };
});
exports.AlertService = {
    sendAlerts,
};
