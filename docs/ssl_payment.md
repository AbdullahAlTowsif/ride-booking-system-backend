# SSLCommerz Payment Integration — Implementation Plan

**Project**: Ride Booking System Backend
**Branch**: `feature/sslcommerz-payment-integration`
**Spec reference**: `.opencode/specs/01-sslcommerz-payment-integration.md`
**Status**: Planned (not implemented)

---

## 1. Overview

Integrate the **SSLCommerz** payment gateway so riders can pay for a completed ride online. This covers payment initiation, SSLCommerz callbacks and IPN, server-side payment verification, transaction persistence, payment and ride status management, duplicate payment prevention, security, failure/cancellation handling, and the required frontend/API integration contract.

This is a **new** roadmap step. There is currently **no payment module, no `Payment` model, and no external payment integration** in the codebase.

## 2. Approved Decisions

1. **HTTP client**: Add **axios** as a runtime dependency for outbound SSLCommerz calls (session initiation + validation API). No tsconfig change needed.
2. **Payment timing**: **Post-ride settlement** — riders pay for a ride only after it reaches `COMPLETED`.
3. **Fare source**: Keep the existing **client-supplied `ride.fare`** as the payable amount. This remains a **known trust weakness** (a malicious client could pay a low amount); it is documented but not fixed in this step.

## 3. Current State (Research Summary)

- **Stack**: Express 5 + TypeScript + MongoDB (Mongoose 8) + Passport (Google OAuth) + JWT + Zod.
- **Module convention** (`src/app/modules/<name>/`): `controller.ts` → `service.ts` → `model.ts`, plus `route.ts`, `validation.ts`, `interface.ts`, optional `constant.ts`.
- **Central route registry**: `src/app/routes/index.ts` (mounted under `/api`).
- **Auth**: `src/app/middlewares/checkAuth.ts` — JWT from `Authorization` header **or** `accessToken` cookie; checks `isVerified`, `isBlock`, `isDeleted`, then role. `req.user` is the verified `JwtPayload`.
- **Roles**: `ADMIN`, `RIDER`, `DRIVER`.
- **Response/error**: `sendResponse(res, { statusCode, success, message, meta, data })`, `AppError(statusCode, message)`, `catchAsync`, Zod via `validateRequest`.
- **Ride model**: `rider`, `driver`, `pickupLocation`, `destinationLocation`, `status`, `fare`, `timestamps`, `isPaid` (default `false`).
- **Driver completion path** (`src/app/modules/driver/driver.service.ts` → `updateRideStatus`): at `IN_TRANSIT → COMPLETED` it currently sets `ride.isPaid = true` and `driver.earnings += ride.fare` — this hard-coded settlement will be **decoupled**.
- **Fare**: `ride.validation.ts` requires a positive `fare` (≥10) supplied **by the client** at ride request.
- **User model** (`user.model.ts`): `name`, `email`, `phone`, `address` only (**no** separate `city`/`country`/`postcode` fields — relevant for SSLCommerz `cus_*` params).
- **HTTP**: No `axios`/`fetch` usage yet. Node v22.

---

## 4. Work Breakdown

### Phase 1 — Dependency & Configuration

- [x] **P1-1:** Install `axios` runtime dependency (`npm install axios`).
- [x] **P1-2:** Extend `src/app/config/env.ts` — add to `EnvConfig` interface, the `requiredEnvVariables` array, and the returned object:

  | Var | Required | Purpose |
  |-----|----------|---------|
  | `SSL_STORE_ID` | Y | Merchant store id |
  | `SSL_STORE_PASS` | Y | Merchant store password |
  | `SSL_PAYMENT_API` | Y | Session initiation API (full URL, e.g. `https://sandbox.sslcommerz.com/gwprocess/v4/process.php`) |
  | `SSL_VALIDATION_API` | Y | Transaction validation API (full URL, e.g. `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php`) |
  | `SSL_IPN_URL` | Y | IPN webhook (backend, e.g. `https://ride-booking-system-backend.vercel.app/api/payments/ipn`) |
  | `SSL_SUCCESS_BACKEND_URL` | Y | Success callback (backend `/api/payments/success`) |
  | `SSL_FAIL_BACKEND_URL` | Y | Fail callback (backend `/api/payments/fail`) |
  | `SSL_CANCEL_BACKEND_URL` | Y | Cancel callback (backend `/api/payments/cancel`) |
  | `SSL_SUCCESS_FRONTEND_URL` | Y | Frontend success page (redirect target) |
  | `SSL_FAIL_FRONTEND_URL` | Y | Frontend fail page (redirect target) |
  | `SSL_CANCEL_FRONTEND_URL` | Y | Frontend cancel page (redirect target) |

  > `env.ts` throws at startup on missing vars, so these must exist in `.env` before the app boots.

- [x] **P1-3:** Update `.env` and `README.md` `.env` example with the new vars.

### Phase 2 — New `Payment` Module (`src/app/modules/payment/`)

- [x] **P2-1:** `payment.interface.ts` — `PaymentStatus` enum (`INITIATED`, `PENDING`, `VALID`, `FAILED`, `CANCELLED`, `EXPIRED`, `REFUNDED`) + `IPayment` interface (`rider`, `ride`, `driver?`, `amount`, `currency: "BDT"`, `tranId`, `valId?`, `status`, `paidAt?`, `ipnReceivedAt?`, `verifiedAt?`, `raw: object`, timestamps).
- [x] **P2-2:** `payment.constant.ts` — status enum re-export + SSLCommerz path/builders + URL helpers.
- [x] **P2-3:** `payment.model.ts` — Mongoose schema with `ref: 'User'` / `ref: 'Ride'`, `versionKey: false`, `timestamps: true`, **unique index on `tranId`**, index on `ride`.
- [x] **P2-4:** `payment.validation.ts` — Zod schema `z.object({ rideId: z.string() })`.
- [x] **P2-5:** `src/app/utils/sslcommerz.ts` — axios helpers:
  - `initiateSession(payload)` → `POST <base>/gwprocess/v4/api.php` (form-encoded)
  - `verifyTransaction(valId)` → `GET <base>/validator/api/validationserverAPI.php`
  - `verifySignature(body, verifyKey, verifySign)` — defense-in-depth hash check
  - Sandbox/live base URL selection from env
  - `cus_*` mapping note: `cus_name=name`, `cus_email=email`, `cus_phone=phone`, `cus_add1=address`; pass sensible defaults for city/state/postcode/country (`Bangladesh`) since no dedicated fields exist.

### Phase 3 — Service, Controller, Route

- [x] **P3-1:** `payment.service.ts`:
  - `initiate(riderId, rideId)` — validate ObjectId; load ride; ownership check (`ride.rider === riderId`); require `COMPLETED` + `!isPaid`; block if an `INITIATED/PENDING/VALID` payment already exists (reuse or reject); generate unique `tranId` (≤30 chars); call `initiateSession`; persist `Payment(INITIATED)`; return `GatewayPageURL`.
  - `handleIpn(body)` — signature check; find by `tranId`; **idempotency guard** (already `VALID` → noop); set `PENDING` + `raw` + `ipnReceivedAt`; call `verifyTransaction`; cross-check `tran_id` and `amount`/`currency_amount`; on success atomically transition `INITIATED/PENDING → VALID` via a **status-filtered `findOneAndUpdate`** (only the winner proceeds), set `valId/paidAt/verifiedAt`, set `ride.isPaid = true`, and **idempotently credit** `Driver.earnings` (guarded by the atomic transition — no double credit). Return 200.
  - `handleFail/Cancel(body)` — mark `FAILED`/`CANCELLED` if not terminal.
  - `getRideStatus(rideId, userId, role?)` — ownership/role check (ADMIN allowed), return latest payment for the ride.
  - `getMyPayments(userId)` — payments where `rider = userId`, desc.
- [x] **P3-2:** `payment.controller.ts` — thin `catchAsync` wrappers using `sendResponse`, reading `req.user.userId` per project convention.
- [x] **P3-3:** `payment.route.ts` — the endpoints below. Success callback runs full IPN verification (not a blind `VALID` mark).

### Phase 4 — Wiring & Integration

- [x] **P4-1:** `src/app/routes/index.ts` — register `PaymentRoutes` at `/api/payments`:

  ```ts
  { path: "/payments", route: PaymentRoutes },
  ```

- [x] **P4-2:** `src/app.ts` — add `express.urlencoded({ extended: true })` before route mounting so SSLCommerz form `POST` bodies (IPN/callbacks) are parsed.
- [x] **P4-3:** `src/app/modules/driver/driver.service.ts` → `updateRideStatus`: at `IN_TRANSIT → COMPLETED`, **remove** `ride.isPaid = true` and `driver.earnings += ride.fare`; keep `completedAt` and the driver availability reset. Crediting now happens **only** via the verified IPN path.

### Phase 5 — Verification

- [x] **P5-1:** `npm run lint`
- [x] **P5-2:** `npm run build`
- [ ] **P5-3:** (Optional) Sandbox end-to-end smoke test with test SSLCommerz credentials.
  - No test suite exists — rely on lint + typecheck.

---

## 5. API Endpoints

```
POST   /api/payments/initiate        checkAuth(RIDER)      initiate session for an unpaid COMPLETED ride
POST   /api/payments/ipn             public                SSLCommerz IPN webhook (no checkAuth)
POST   /api/payments/success         public                SSLCommerz success redirect callback
POST   /api/payments/fail            public                SSLCommerz fail redirect callback
POST   /api/payments/cancel          public                SSLCommerz cancel redirect callback
GET    /api/payments/:rideId/status  checkAuth(RIDER, ADMIN)  rider polls payment status for a ride
GET    /api/payments/me              checkAuth(RIDER)      rider payment history
```

> The IPN/callback URLs are hit by SSLCommerz and are intentionally **not** JWT-protected; authenticated by **signature verification** instead. `POST` because SSLCommerz sends form-encoded `POST` bodies.

### 5.1 Response shapes

- **Initiate**: `{ success, statusCode: 200, message: "Payment session created", data: { gatewayUrl, tranId, paymentId } }`
- Respond `200` to SSLCommerz immediately from IPN/callbacks; redirects (HTTP 302) go to the frontend.

---

## 6. Business Workflow & State Machine

```text
Ride:  REQUESTED → ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED
                                                                │
                                  (driver completes, isPaid=false, payment NOT yet settled)
                                                                ▼
   Rider initiates payment ──► Payment.INITIATED ──► User redirected to SSLCommerz
                                                                ▼
                        ┌───────────────┬──────────────┬──────────────┐
                        ▼               ▼              ▼              ▼
                  Verified         Failed         Cancelled       Expired
                  (IPN+verify)                                                       
                        │               │              │              │
                        ▼               ▼              ▼              ▼
              Payment.VALID       Payment.FAILED  Payment.CANCELLED  Payment.EXPIRED
              ride.isPaid = true   (retryable)      (retryable)        (retryable)
              driver.earnings += fare
```

### Valid transitions (Payment)

- `INITIATED → PENDING` (verification started)
- `INITIATED / PENDING → VALID` (verified success) — **terminal**
- `INITIATED / PENDING → FAILED` — retryable
- `INITIATED / PENDING → CANCELLED` — retryable (user backed out)
- `INITIATED / PENDING → EXPIRED` — retryable (gateway timeout)
- `VALID → REFUNDED` — out of scope for v1 (document only)

### Invalid transitions (must be rejected)

- `VALID → VALID` (double-processing) — idempotent, no re-credit
- `VALID → FAILED / CANCELLED / EXPIRED` (confirmed payment cannot move back)
- Initiating payment on a ride that is not `COMPLETED`, or already has a `VALID` payment

---

## 7. Security & Duplicate-Payment Prevention

1. **Server-side verification is mandatory.** Never trust the browser redirect or the bare `success` URL. The **IPN + Validation API** round-trip is the source of truth. `VALID` transitions occur only after the Validation API confirms `status = VALID/VALIDATED` **and** `tran_id`/`amount` match the stored `Payment`.
2. **Signature / `verify_sign` verification** on every callback/IPN body. Recompute the hash from `verify_key` (the ordered list of keys) and the corresponding posted values; compare to `verify_sign`. Reject mismatches (log + 200 noop).
3. **Amount cross-check.** Validation API `currency_amount`/`amount` must match `Payment.amount` (within tolerance). Reject any mismatch. Prevents payer tampering with `total_amount`.
4. **`tran_id` uniqueness.** Unique DB index on `tranId` prevents two payments sharing a transaction id.
5. **Ownership checks.** Initiate is gated by the JWT rider identity and `ride.rider === riderId`. A rider can never initiate payment for another rider's ride.
6. **Role gating.** `checkAuth(Role.RIDER, Role.ADMIN)` on monetary endpoints; `ADMIN` is read-only for payments.
7. **Idempotent crediting (duplicate/concurrent IPN).** SSLCommerz may deliver the IPN more than once. Transition the `Payment` with a **status filter** (`INITIATED/PENDING → VALID` via atomic `findOneAndUpdate`); only the call that flips to `VALID` proceeds to credit. If already `VALID` (duplicate IPN) → no-op, no re-credit.
8. **Fare trust (hardening, flagged).** The client currently supplies `fare` at ride request and the server trusts it. For production correctness, compute/validate the fare server-side. **Out of scope** for this step; at minimum cross-check `payment.amount === ride.fare` at initiation (derived from the stored ride, not the request).

---

## 8. Failure & Cancellation Handling

- **User cancels / backs out** (`CANCELLED`): mark `CANCELLED` if not terminal; `ride.isPaid` stays `false`; retry.
- **Declined / failed** (`FAILED`): mark `FAILED`; retry (new `tranId` + new `Payment` doc, or reuse the pending one).
- **Timeout** (`EXPIRED` handled by validation response): mark `EXPIRED`; retryable.
- **Gateway unreachable at initiation**: catch the HTTP error, persist `raw` and a `FAILED`/no session, return a friendly `AppError(502/500)`; do not create a dangling `INITIATED` payment without a session where possible (or mark it retryable).
- **Validation API unreachable at IPN time**: keep payment `PENDING` (do **not** mark `VALID`), respond 200; rely on the success callback (browser) to retry verification, or a status reconcile. Frontend must not assume success until `status === VALID`.
- **Ride still unpaid after attempts**: frontend shows "Payment pending/failed — retry".

---

## 9. Frontend / API Integration (documentation only — no frontend files)

> The frontend lives in a separate repo. No frontend files are created or modified here.

1. **Initiate**: when a ride is `COMPLETED && isPaid === false`, rider calls `POST /api/payments/initiate` with `{ rideId }` (authenticated). Response returns `data.gatewayUrl` → redirect the browser to it.
2. **Callbacks**: set SSLCommerz admin-panel callback/IPN URLs to the backend `SSL_IPN_URL`, `SSL_SUCCESS_BACKEND_URL`, `SSL_FAIL_BACKEND_URL`, `SSL_CANCEL_BACKEND_URL`. Backend verifies and 302-redirects the browser to the matching frontend page (`SSL_SUCCESS_FRONTEND_URL` / `SSL_FAIL_FRONTEND_URL` / `SSL_CANCEL_FRONTEND_URL`), appending `?status=...&tranId=...&rideId=...`.
3. **Status polling**: after redirect back, frontend calls `GET /api/payments/:rideId/status` for ground truth (`status`, `amount`, `paidAt`); update the ride UI only on `VALID`.
4. **History**: `GET /api/payments/me` for rider payment history.
5. **Ride list**: `GET /rides/me` already exposes `status` and `isPaid` — show "Pay Now"/"Paid" states. No new ride fields required for v1.
6. **Never show success** from the redirect alone; always confirm via the status endpoint.

---

## 10. Files to Create / Modify

**Create**
- `src/app/modules/payment/payment.interface.ts`
- `src/app/modules/payment/payment.model.ts`
- `src/app/modules/payment/payment.validation.ts`
- `src/app/modules/payment/payment.constant.ts`
- `src/app/modules/payment/payment.service.ts`
- `src/app/modules/payment/payment.controller.ts`
- `src/app/modules/payment/payment.route.ts`
- `src/app/utils/sslcommerz.ts`

**Modify**
- `src/app/config/env.ts` — add SSLCommerz + callback URL env vars (and update `.env`/README example)
- `src/app/routes/index.ts` — register `PaymentRoutes` under `/api/payments`
- `src/app/modules/driver/driver.service.ts` — decouple driver earnings / `isPaid` from the completion transition; move crediting to verified IPN
- `src/app.ts` — add `express.urlencoded({ extended: true })`

---

## 11. Out of Scope / Future

- Refund flows (`VALID → REFUNDED` via SSLCommerz refund API) — model field reserved, not implemented in v1.
- Server-side fare pricing table / fare calculation engine.
- Wallet / ledger / driver payout settlement.
- Realtime payment notifications (WebSockets).
