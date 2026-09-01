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
exports.PaymentService = void 0;
const http_status_codes_1 = __importDefault(require("http-status-codes"));
const mongoose_1 = require("mongoose");
const AppError_1 = __importDefault(require("../../errorHelpers/AppError"));
const payment_model_1 = require("./payment.model");
const payment_interface_1 = require("./payment.interface");
const ride_model_1 = require("../ride/ride.model");
const ride_interface_1 = require("../ride/ride.interface");
const user_model_1 = require("../user/user.model");
const driver_model_1 = require("../driver/driver.model");
const user_interface_1 = require("../user/user.interface");
const sslcommerz_1 = require("../../utils/sslcommerz");
const env_1 = require("../../config/env");
const payment_constant_1 = require("./payment.constant");
const generateTranId = (rideId) => {
    const uniqueId = `RIDE${rideId}${Date.now()}`;
    return uniqueId.slice(0, 30);
};
const refineCusPayload = (riderId) => __awaiter(void 0, void 0, void 0, function* () {
    const rider = yield user_model_1.User.findById(riderId);
    const address = (rider === null || rider === void 0 ? void 0 : rider.address) || "Dhaka";
    const city = "Dhaka";
    const postcode = "1200";
    const country = "Bangladesh";
    return {
        cus_name: (rider === null || rider === void 0 ? void 0 : rider.name) || "Rider",
        cus_email: (rider === null || rider === void 0 ? void 0 : rider.email) || "",
        cus_phone: (rider === null || rider === void 0 ? void 0 : rider.phone) || "01700000000",
        cus_add1: address,
        cus_add2: address,
        cus_city: city,
        cus_state: city,
        cus_postcode: postcode,
        cus_country: country,
        cus_fax: "01600000000",
        ship_name: (rider === null || rider === void 0 ? void 0 : rider.name) || "Rider",
        ship_add1: address,
        ship_add2: address,
        ship_city: city,
        ship_state: city,
        ship_postcode: postcode,
        ship_country: country,
    };
});
const initiate = (riderId, rideId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!riderId) {
        throw new AppError_1.default(http_status_codes_1.default.UNAUTHORIZED, "Unauthorized access");
    }
    if (!(0, mongoose_1.isValidObjectId)(rideId)) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Invalid ride ID");
    }
    const ride = yield ride_model_1.Ride.findById(rideId);
    if (!ride) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Ride not found");
    }
    if (ride.rider.toString() !== riderId) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "You are not authorized to pay for this ride");
    }
    if (ride.status !== ride_interface_1.RideStatus.COMPLETED) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Payment can only be initiated for a completed ride");
    }
    if (ride.isPaid) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Ride is already paid");
    }
    const existingActive = yield payment_model_1.Payment.findOne({
        ride: ride._id,
        status: { $in: payment_constant_1.ACTIVE_PAYMENT_STATUSES },
    });
    if (existingActive) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "A payment is already in progress or completed for this ride");
    }
    const cusPayload = yield refineCusPayload(riderId);
    const tranId = generateTranId(ride._id.toString());
    const session = yield (0, sslcommerz_1.initiateSession)(Object.assign({ total_amount: String(ride.fare), tran_id: tranId, success_url: env_1.envVars.SSL_SUCCESS_BACKEND_URL, fail_url: env_1.envVars.SSL_FAIL_BACKEND_URL, cancel_url: env_1.envVars.SSL_CANCEL_BACKEND_URL, ipn_url: env_1.envVars.SSL_IPN_URL, product_name: "Ride Booking", product_category: "Ride", product_profile: "general", value_a: ride._id.toString() }, cusPayload));
    // console.log(session);
    if (session.status !== "SUCCESS") {
        throw new AppError_1.default(http_status_codes_1.default.BAD_GATEWAY, session.status_message || "Failed to create payment session");
    }
    const payment = yield payment_model_1.Payment.create({
        rider: riderId,
        ride: ride._id,
        driver: ride.driver || null,
        amount: ride.fare,
        currency: "BDT",
        tranId,
        status: payment_interface_1.PaymentStatus.INITIATED,
        raw: session,
    });
    return {
        gatewayUrl: session.GatewayPageURL,
        tranId,
        paymentId: payment._id,
    };
});
const markValidAndSettle = (payment) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(0, mongoose_1.isValidObjectId)(payment._id)) {
        return;
    }
    const updated = yield payment_model_1.Payment.findOneAndUpdate({
        _id: payment._id,
        status: { $in: [payment_interface_1.PaymentStatus.INITIATED, payment_interface_1.PaymentStatus.PENDING] },
    }, {
        $set: {
            status: payment_interface_1.PaymentStatus.VALID,
            valId: payment.valId,
            paidAt: new Date(),
            verifiedAt: new Date(),
        },
    }, { new: true });
    if (!updated) {
        return;
    }
    const ride = yield ride_model_1.Ride.findById(payment.ride);
    if (!ride || ride.isPaid) {
        return;
    }
    ride.isPaid = true;
    ride.timestamps.completedAt = ride.timestamps.completedAt || new Date();
    yield ride.save();
    if (ride.driver) {
        yield driver_model_1.Driver.findByIdAndUpdate(ride.driver, {
            $inc: { earnings: ride.fare },
        });
    }
});
const handleIpn = (body) => __awaiter(void 0, void 0, void 0, function* () {
    const tranId = body.tran_id;
    const valId = body.val_id;
    const signatureValid = (0, sslcommerz_1.verifySignature)(body, body.verify_key, body.verify_sign);
    if (!tranId) {
        return;
    }
    const payment = yield payment_model_1.Payment.findOne({ tranId });
    if (!payment) {
        return;
    }
    if (payment.status === payment_interface_1.PaymentStatus.VALID) {
        return;
    }
    payment.raw = Object.assign(Object.assign({}, payment.raw), { ipn: body });
    payment.ipnReceivedAt = new Date();
    payment.status = payment_interface_1.PaymentStatus.PENDING;
    yield payment.save();
    if (!signatureValid) {
        return;
    }
    if (!valId) {
        return;
    }
    const validation = yield (0, sslcommerz_1.verifyTransaction)(valId);
    const verified = (validation.status === "VALID" || validation.status === "VALIDATED") &&
        validation.tran_id === tranId &&
        Math.abs(parseFloat(validation.currency_amount || validation.amount || "0") -
            payment.amount) < payment_constant_1.PAYMENT_AMOUNT_TOLERANCE;
    if (!verified) {
        payment.raw = Object.assign(Object.assign({}, payment.raw), { validation });
        payment.status = payment_interface_1.PaymentStatus.FAILED;
        yield payment.save();
        return;
    }
    payment.valId = valId;
    payment.raw = Object.assign(Object.assign({}, payment.raw), { validation });
    yield payment.save();
    yield markValidAndSettle({ _id: payment._id, ride: payment.ride, valId });
});
const handleCallbackStatus = (body, outcome) => __awaiter(void 0, void 0, void 0, function* () {
    const tranId = body.tran_id;
    if (!tranId) {
        return;
    }
    const payment = yield payment_model_1.Payment.findOne({ tranId });
    if (!payment) {
        return;
    }
    if (payment.status === payment_interface_1.PaymentStatus.VALID) {
        return;
    }
    payment.status = outcome;
    payment.ipnReceivedAt = payment.ipnReceivedAt || new Date();
    payment.raw = Object.assign(Object.assign({}, payment.raw), { callback: body });
    yield payment.save();
});
const getRideStatus = (rideId, userId, role) => __awaiter(void 0, void 0, void 0, function* () {
    if (!(0, mongoose_1.isValidObjectId)(rideId)) {
        throw new AppError_1.default(http_status_codes_1.default.BAD_REQUEST, "Invalid ride ID");
    }
    const ride = yield ride_model_1.Ride.findById(rideId);
    if (!ride) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "Ride not found");
    }
    if (role !== user_interface_1.Role.ADMIN && ride.rider.toString() !== userId) {
        throw new AppError_1.default(http_status_codes_1.default.FORBIDDEN, "You are not authorized to view this payment");
    }
    const payment = yield payment_model_1.Payment.findOne({ ride: rideId }).sort({
        createdAt: -1,
    });
    if (!payment) {
        throw new AppError_1.default(http_status_codes_1.default.NOT_FOUND, "No payment found for this ride");
    }
    return {
        status: payment.status,
        amount: payment.amount,
        tranId: payment.tranId,
        paidAt: payment.paidAt,
    };
});
const getMyPayments = (userId) => __awaiter(void 0, void 0, void 0, function* () {
    const payments = yield payment_model_1.Payment.find({ rider: userId }).sort({
        createdAt: -1,
    });
    return payments;
});
exports.PaymentService = {
    initiate,
    handleIpn,
    handleCallbackStatus,
    getRideStatus,
    getMyPayments,
};
