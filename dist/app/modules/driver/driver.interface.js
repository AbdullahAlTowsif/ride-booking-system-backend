"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IsAvailable = exports.IsApprove = void 0;
var IsApprove;
(function (IsApprove) {
    IsApprove["APPROVED"] = "APPROVED";
    IsApprove["PENDING"] = "PENDING";
    IsApprove["SUSPENDED"] = "SUSPENDED";
    IsApprove["BLOCKED"] = "BLOCKED";
})(IsApprove || (exports.IsApprove = IsApprove = {}));
var IsAvailable;
(function (IsAvailable) {
    IsAvailable["ONLINE"] = "ONLINE";
    IsAvailable["OFFLINE"] = "OFFLINE";
})(IsAvailable || (exports.IsAvailable = IsAvailable = {}));
