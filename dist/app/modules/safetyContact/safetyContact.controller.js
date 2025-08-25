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
exports.SafetyContactController = void 0;
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const safetyContact_service_1 = require("./safetyContact.service");
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const getContacts = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = req.user;
    if (!user) {
        return (0, sendResponse_1.sendResponse)(res, {
            statusCode: http_status_codes_1.default.UNAUTHORIZED,
            success: false,
            message: "Authentication required",
            data: null,
        });
    }
    const { userId: riderId } = user;
    //   console.log("Fetching contacts for riderId:", riderId);
    const result = yield safetyContact_service_1.SafetyContactService.getContacts(riderId);
    //   console.log("Service result:", result);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Safety contacts fetched successfully",
        data: result,
    });
}));
const saveContacts = (0, catchAsync_1.catchAsync)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const rider = req.user;
    //   console.log("rider", rider);
    const { userId: riderId } = rider;
    const contacts = req.body;
    //   console.log(contacts);
    const result = yield safetyContact_service_1.SafetyContactService.saveContacts(riderId, contacts);
    (0, sendResponse_1.sendResponse)(res, {
        statusCode: http_status_codes_1.default.OK,
        success: true,
        message: "Safety contacts saved successfully",
        data: result,
    });
}));
exports.SafetyContactController = {
    getContacts,
    saveContacts,
};
