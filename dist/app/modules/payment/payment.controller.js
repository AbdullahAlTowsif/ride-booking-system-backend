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
exports.PaymentController = void 0;
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const catchAsync_1 = require("../../utils/catchAsync");
const sendResponse_1 = require("../../utils/sendResponse");
const payment_service_1 = require("./payment.service");
const payment_interface_1 = require("./payment.interface");
const env_1 = require("../../config/env");
const initiate = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const rider = req.user;
    const userId = rider.userId;
    const { rideId } = req.body;
    const result = yield payment_service_1.PaymentService.initiate(userId, rideId);
    (0, sendResponse_1.sendResponse)(res, {
        success: true,
        statusCode: http_status_codes_1.default.OK,
        message: "Payment session created successfully",
        data: result,
    });
}));
const handleIpn = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield payment_service_1.PaymentService.handleIpn(req.body);
    res.status(200).send("OK");
}));
const handleSuccess = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield payment_service_1.PaymentService.handleIpn(req.body);
    res.redirect(302, buildFrontendUrl(req.body));
}));
const handleFail = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield payment_service_1.PaymentService.handleCallbackStatus(req.body, payment_interface_1.PaymentStatus.FAILED);
    res.redirect(302, buildFrontendUrl(req.body));
}));
const handleCancel = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    yield payment_service_1.PaymentService.handleCallbackStatus(req.body, payment_interface_1.PaymentStatus.CANCELLED);
    res.redirect(302, buildFrontendUrl(req.body));
}));
const getRideStatus = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const rider = req.user;
    const userId = rider.userId;
    const role = rider.role;
    const rideId = req.params.rideId;
    const result = yield payment_service_1.PaymentService.getRideStatus(rideId, userId, role);
    (0, sendResponse_1.sendResponse)(res, {
        success: true,
        statusCode: http_status_codes_1.default.OK,
        message: "Payment status fetched successfully",
        data: result,
    });
}));
const getMyPayments = (0, catchAsync_1.catchAsync)((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const rider = req.user;
    const userId = rider.userId;
    const result = yield payment_service_1.PaymentService.getMyPayments(userId);
    (0, sendResponse_1.sendResponse)(res, {
        success: true,
        statusCode: http_status_codes_1.default.OK,
        message: "Payment history fetched successfully",
        data: result,
    });
}));
const buildFrontendUrl = (body) => {
    const status = (body.status || "").toUpperCase();
    const tranId = body.tran_id || "";
    const rideId = body.value_a || "";
    let baseUrl = env_1.envVars.SSL_SUCCESS_FRONTEND_URL;
    if (status === "FAILED") {
        baseUrl = env_1.envVars.SSL_FAIL_FRONTEND_URL;
    }
    else if (status === "CANCELLED") {
        baseUrl = env_1.envVars.SSL_CANCEL_FRONTEND_URL;
    }
    const params = new URLSearchParams();
    if (status)
        params.set("status", status);
    if (tranId)
        params.set("tranId", tranId);
    if (rideId)
        params.set("rideId", rideId);
    return `${baseUrl}?${params.toString()}`;
};
exports.PaymentController = {
    initiate,
    handleIpn,
    handleSuccess,
    handleFail,
    handleCancel,
    getRideStatus,
    getMyPayments,
};
