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
exports.verifySignature = exports.verifyTransaction = exports.initiateSession = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const initiateSession = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    const body = new URLSearchParams(Object.assign({ store_id: env_1.envVars.SSL_STORE_ID, store_passwd: env_1.envVars.SSL_STORE_PASS, currency: "BDT" }, payload));
    const { data } = yield axios_1.default.post(env_1.envVars.SSL_PAYMENT_API, body.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
    });
    return data;
});
exports.initiateSession = initiateSession;
const verifyTransaction = (valId) => __awaiter(void 0, void 0, void 0, function* () {
    const params = new URLSearchParams({
        val_id: valId,
        store_id: env_1.envVars.SSL_STORE_ID,
        store_passwd: env_1.envVars.SSL_STORE_PASS,
        format: "json",
        v: "1",
    });
    const { data } = yield axios_1.default.get(`${env_1.envVars.SSL_VALIDATION_API}?${params.toString()}`, { timeout: 15000 });
    return data;
});
exports.verifyTransaction = verifyTransaction;
const verifySignature = (body, verifyKey, verifySign) => {
    if (!verifyKey || !verifySign) {
        return false;
    }
    const keys = verifyKey.split(",");
    const signString = keys
        .map((key) => { var _a; return `${key}=${(_a = body[key]) !== null && _a !== void 0 ? _a : ""}`; })
        .join("&");
    const expected = crypto_1.default.createHash("md5").update(signString).digest("hex");
    return expected === verifySign;
};
exports.verifySignature = verifySignature;
