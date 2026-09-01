import { PaymentStatus } from "./payment.interface";

export const ACTIVE_PAYMENT_STATUSES = [
  PaymentStatus.INITIATED,
  PaymentStatus.PENDING,
  PaymentStatus.VALID,
];

export const TERMINAL_SUCCESS_STATUS = PaymentStatus.VALID;

export const PAYMENT_AMOUNT_TOLERANCE = 1;
