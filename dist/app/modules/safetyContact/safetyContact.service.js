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
exports.SafetyContactService = void 0;
const safetyContact_model_1 = require("./safetyContact.model");
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const getContacts = (riderId) => __awaiter(void 0, void 0, void 0, function* () {
    //   console.log('Searching for riderId:', riderId);
    try {
        const docs = yield safetyContact_model_1.SafetyContact.find({ riderId: riderId });
        // console.log("Found documents:", docs);
        return docs;
    }
    catch (error) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, `Data not found, ${error}`);
    }
});
const saveContacts = (riderId, contacts) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if document exists
    let safetyDoc = yield safetyContact_model_1.SafetyContact.findOne({ riderId });
    if (!safetyDoc) {
        safetyDoc = yield safetyContact_model_1.SafetyContact.create({ riderId, contacts });
    }
    else {
        safetyDoc.contacts = contacts;
        yield safetyDoc.save();
    }
    return safetyDoc.contacts;
});
exports.SafetyContactService = {
    getContacts,
    saveContacts,
};
