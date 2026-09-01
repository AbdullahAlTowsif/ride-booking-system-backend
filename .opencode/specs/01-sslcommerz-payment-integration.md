# 01 — SSLCommerz Payment Integration for Ride Booking

## Metadata

| Field | Value |
|-------|-------|
| **Step** | `01` |
| **Feature Title** | SSLCommerz Payment Integration |
| **Slug** | `sslcommerz-payment-integration` |
| **Branch** | `feature/sslcommerz-payment-integration` |
| **Status** | Planned (not implemented) |
| **Scope** | Backend only (ride-booking-system-backend) |

---

## 1. Overview

Integrate the **SSLCommerz** payment gateway so riders can pay for a completed ride online. The feature must cover payment initiation, SSLCommerz callbacks and IPN, server-side payment verification, transaction persistence, payment and ride status management, duplicate payment prevention, security, failure/cancellation handling, and the required frontend/API integration contract.

This is a **new** roadmap step. There is currently **no payment module, no `Payment` model, and no external payment integration** in the codebase. The existing `Ride.isPaid` boolean flag and the `Driver.earnings` field already exist and are set when a ride is completed (see `src/app/modules/driver/driver.service.ts`), but they are not yet backed by a real payment flow. This feature replaces that hard-coded "paid" transition with a gateway-backed settlement.

---

## 2. Repository Validation & Research Summary

The current repository is confirmed as the **Ride Booking System backend**:

- **Stack**: Express 5 + TypeScript + MongoDB (Mongoose 8) + Passport (Google OAuth) + JWT + Zod (`package.json`, `AGENTS.md`)
- **Entry**: `src/server.ts` → `src/app.ts`
- **Central route registry**: `src/app/routes/index.ts` (all routes mounted under `/api`)
- **Module convention** (`src/app/modules/<name>/`): `controller.ts` → `service.ts` → `model.ts`, plus `route.ts`, `validation.ts`, `interface.ts`, optional `constant.ts`
- **Auth**: `src/app/middlewares/checkAuth.ts` reads JWT from `Authorization` header **or** `accessToken` cookie, validates against `User`, checks `isVerified`, `isBlock`, `isDeleted`, then role
- **Roles**: `ADMIN`, `RIDER`, `DRIVER` (`src/app/modules/user/user.interface.ts`)
- **Response**: `sendResponse(res, { statusCode, success, message, meta, data })` (`src/app/utils/sendResponse.ts`)
- **Errors**: `AppError(statusCode, message)` (`src/app/errorHelpers/AppError.ts`) handled by `globalErrorHandler`
- **Async wrapper**: `catchAsync` (`src/app/utils/catchAsync.ts`)
- **Validation**: Zod schemas via `validateRequest(schema)` middleware (`src/app/middlewares/validateRequests.ts`)

### Relevant existing flow (ride + fare + driver)

- **Ride model** (`src/app/modules/ride/ride.model.ts`, `ride.interface.ts`):
  - Fields: `rider`, `driver`, `pickupLocation`, `destinationLocation`, `status`, `fare`, `timestamps`, `isPaid` (default `false`)
  - `RideStatus`: `REQUESTED → ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED`, plus `CANCELLED`, `REJECTED`
- **Ride routes** (`src/app/modules/ride/ride.route.ts`): `POST /rides/request` (RIDER), `PATCH /rides/:id/cancel` (RIDER), `GET /rides/me` (RIDER), `GET /rides/:id` (RIDER)
- **Fare**: `ride.validation.ts` requires a positive `fare` (≥10) supplied **by the client** at ride request. **Security note:** the server currently trusts the client-supplied fare. See §9 for the hardening step.
- **Driver accept / status** (`src/app/modules/driver/driver.service.ts`):
  - `acceptRide` assigns driver, sets `ACCEPTED`
  - `updateRideStatus` walks `ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED`; at `COMPLETED` it currently sets `ride.isPaid = true` and increments `driver.earnings += ride.fare`
- **Driver model** (`driver.model.ts`): `user`, `vehicleType`, `vehicleNumber`, `approvalStatus`, `availabilityStatus`, `earnings`
- **Auth identity**: `req.user` is the verified `JwtPayload`; controllers read `const { userId } = req.user as JwtPayload`

### Existing specifications

`.opencode/specs/` does **not** exist yet (only `.opencode/commands/`). No prior spec for this step exists — nothing to overwrite or deduplicate against.

---

## 3. Dependencies

The following existing, confirmed features are **required** by this feature:

1. **User registration + authentication (JWT)** — Required to identify the paying rider (`req.user.userId`) and to authorize payment routes, and to reject unauthenticated initiation/status requests.
2. **User roles (RIDER/DRIVER/ADMIN)** — Payment must be gated by role: only the ride's **owner rider** may initiate payment; `ADMIN` may view all payments. Used via `checkAuth(Role.RIDER, Role.ADMIN)`.
3. **Ride creation (REQUESTED + fare)** — Payment is tied to a `Ride` via `rideId`; the `fare` field is the payable `amount`.
4. **Ride lifecycle → COMPLETED** — Payment settlement happens for a **completed, unpaid** ride. The driver-assignment and status-transition machinery already exists.
5. **Driver earnings tracking** — Driver payout is the downstream consumer of a successful payment; `Driver.earnings` is credited only after the gateway confirms payment (idempotently).
6. **Auth middleware + error/response utils** — All payment controllers reuse `checkAuth`, `catchAsync`, `sendResponse`, `AppError`, `validateRequest`.

Not required (not in scope, not confirmed in codebase): refunds to external sources, wallet/ledger, notifications, ratings, admin analytics dashboards may be *touched* but are out of scope unless explicitly requested.

---

## 4. Business Workflow

### Who / when

- **Actor**: the ride's **owning rider** (or `ADMIN` for read-only reporting).
- **Trigger**: a ride reaches **`COMPLETED`** and `isPaid === false`.

### State machine

```text
Ride:  REQUESTED → ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED
                                                                │
                                  (driver completes, isPaid=false,   payment NOT yet settled)
                                                                │
                                                                ▼
   Rider initiates payment ──► Payment.INITIATED ──► User redirected to SSLCommerz
                                                                │
                                               ┌────────────────┴───────────────────┐
                                               │        SSLCommerz outcome            │
                                               ▼                       ▼             ▼
                                        Validated (IPN+verify)     Failed         Cancelled/Expired
                                               │                       │             │
                                               ▼                       ▼             ▼
                                  Payment.VALID                 Payment.FAILED  Payment.CANCELLED / EXPIRED
                                  ride.isPaid = true
                                  driver.earnings += fare      ride stays unpaid; rider may retry
```

### Valid transitions (Payment)

- `INITIATED → PENDING` (verification started)
- `INITIATED / PENDING → VALID` (verified success) — **terminal**
- `INITIATED / PENDING → FAILED` — retryable
- `INITIATED / PENDING → CANCELLED` — retryable (user backed out)
- `INITIATED / PENDING → EXPIRED` — retryable (gateway timeout)
- `VALID → REFUNDED` — out of scope for v1 (document only)

### Invalid transitions (must be rejected)

- `VALID → VALID` (double-processing) — must be idempotent, not re-credit earnings
- `VALID → FAILED / CANCELLED / EXPIRED` (a confirmed payment cannot move back)
- Initiating payment on a ride that is not `COMPLETED`, or already has a `VALID` payment

### Money flow intent

- **Rider pays** the full `fare` to the merchant store (the platform).
- **Driver is credited** `Driver.earnings += fare` only after the transaction is **verified VALID** and the crediting is **idempotent** (never double-counted).
- Currency: `BDT` (fixed for this feature; SSLCommerz BDT flow).

---

## 5. Data Model — New `Payment` Module

Create a new module at `src/app/modules/payment/` following the existing module convention (no existing `Payment` entity to extend — this is the correct single entity to add).

### `payment.interface.ts`

```ts
export enum PaymentStatus {
  INITIATED = "INITIATED",
  PENDING = "PENDING",
  VALID = "VALID",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
  REFUNDED = "REFUNDED",
}

export interface IPayment {
  _id?: Types.ObjectId;
  rider: Types.ObjectId;          // the paying User (ref: User)
  ride: Types.ObjectId;           // the ride being paid for (ref: Ride)
  driver?: Types.ObjectId | null; // denormalized for reporting (ref: User/Driver)
  amount: number;                 // = ride.fare at time of settlement
  currency: "BDT";
  tranId: string;                 // unique SSLCommerz transaction id (<=30)
  valId?: string;                 // set after gateway validation
  status: PaymentStatus;
  paidAt?: Date;
  ipnReceivedAt?: Date;
  verifiedAt?: Date;
  raw: object;                    // full raw IPN / validation payload for audit
  createdAt?: Date;
  updatedAt?: Date;
}
```

### `payment.model.ts` (key points)

- All fields as above; `ref` to `User`, `Ride`.
- **Unique index** on `tranId` (guarantees no duplicate transaction id — a core duplicate-payment guard).
- **Standard/fast index** on `ride` (to query existing payments per ride) and optional composite `{ ride, status }`.
- `versionKey: false` to match the `Ride` model convention.
- `timestamps: true` to match `Driver`/`Ride` convention.

### `payment.route.ts` (intended endpoints — see §7 for exact auth)

```
POST   /payments/initiate        checkAuth(RIDER)      initiate a session for an unpaid COMPLETED ride
POST   /payments/ipn             public                SSLCommerz IPN webhook (no checkAuth)
POST   /payments/success         public                SSLCommerz success redirect callback
POST   /payments/fail            public                SSLCommerz fail redirect callback
POST   /payments/cancel          public                SSLCommerz cancel redirect callback
GET    /payments/:rideId/status  checkAuth(RIDER, ADMIN)  rider polls payment status for a ride
GET    /payments/me              checkAuth(RIDER)      rider payment history
```

Register `PaymentRoutes` in `src/app/routes/index.ts` mounted under `/api/payments`:

```ts
{ path: "/payments", route: PaymentRoutes },
```

> The IPN/callback URLs are hit by SSLCommerz and are intentionally **not** JWT-protected; they must be authenticated by **signature verification** (§9) instead. `POST` is required because SSLCommerz sends the callback data as form-encoded `POST` bodies.

---

## 6. Env Vars & Configuration

Extend `src/app/config/env.ts` (add to the `EnvConfig` interface, the `requiredEnvVariables` array, and the returned object):

| Var | Required | Purpose |
|-----|----------|---------|
| `SSLCOMMERZ_STORE_ID` | Y | Merchant store id |
| `SSLCOMMERZ_STORE_PASS` | Y | Merchant store password |
| `SSLCOMMERZ_IS_LIVE` | Y (`"true"`/`"false"`) | Select sandbox vs live endpoints |
| `SSLCOMMERZ_SANDBOX_BASE_URL` | Y | `https://sandbox.sslcommerz.com` |
| `SSLCOMMERZ_LIVE_BASE_URL` | Y | `https://securepay.sslcommerz.com` |
| `PAYMENT_SUCCESS_URL` | Y | Success callback (backend route base URL) |
| `PAYMENT_FAIL_URL` | Y | Fail callback |
| `PAYMENT_CANCEL_URL` | Y | Cancel callback |
| `PAYMENT_IPN_URL` | Y | IPN endpoint |
| `PAYMENT_FRONTEND_REDIRECT_URL` | Y | Frontend page to redirect users after callback verification |

> `NODE_ENV` already exists; keep `SSLCOMMERZ_IS_LIVE` explicit so sandbox vs live is decoupled from `NODE_ENV` (allows live-testing). Base URLs could also be derived from `SSLCOMMERZ_IS_LIVE`, but explicit vars are clearer and testable.

Update `README.md` `.env` example and add the vars.

---

## 7. API / Controllers / Services Design

All controllers follow the existing `catchAsync` + `sendResponse` pattern in `src/app/modules/payment/payment.controller.ts`, delegating to `payment.service.ts`. Do **not** invent new response shapes — reuse `sendResponse`.

### 7.1 Initiate payment — `POST /api/payments/initiate`

**Request body (Zod — `payment.validation.ts`):**
```ts
z.object({ rideId: z.string() })
```

**Service logic (`PaymentService.initiate(riderId, rideId)`):**
1. `checkAuth(Role.RIDER)` guarantees `riderId`; also validate `rideId` with `isValidObjectId`.
2. Load the `Ride`; ensure it belongs to `riderId` (ownership check — `ride.rider.toString() === riderId`) else `AppError(FORBIDDEN)`.
3. Require `ride.status === RideStatus.COMPLETED` else `AppError(BAD_REQUEST, "Ride is not completed")`.
4. Require `ride.isPaid === false` else `AppError(BAD_REQUEST, "Ride already paid")`.
5. **Duplicate prevention**: ensure no existing `Payment` with `ride` + status in (`INITIATED`, `PENDING`, `VALID`) — if a pending/valid payment exists, reject or return the existing `GatewayPageURL` (reuse) rather than creating a new one.
6. Generate a unique `tranId` (e.g. `ride-<rideId>-<timestamp/random>`), truncated to ≤30 chars.
7. POST form-encoded to the SSLCommerz **init API** (`<base>/gwprocess/v4/api.php`) with:
   - `store_id`, `store_passwd`, `total_amount = ride.fare`, `currency = BDT`, `tran_id`
   - `success_url`, `fail_url`, `cancel_url`, `ipn_url` (from env)
   - customer params from the rider `User` (`cus_name`, `cus_email`, `cus_phone`, `cus_add1`, `cus_city`, `cus_country`, `cus_postcode`)
   - `product_name="Ride Booking"`, `product_category="Ride"`, `product_profile="general"`
   - `value_a = rideId` (echoed back on validation to cross-check)
8. Persist a `Payment` doc with `status: INITIATED`, `tranId`, `amount`, `raw` (init response).
9. Return the session response including `GatewayPageURL`.

**Response:** `{ success, statusCode: 200, message: "Payment session created", data: { gatewayUrl, tranId, paymentId } }`

### 7.2 IPN webhook — `POST /api/payments/ipn`

Called by SSLCommerz. **Public** but protected by signature/validation logic in the service (read form body, `express.urlencoded`).

**Service logic (`PaymentService.handleIpn(body)`):**
1. Extract `status`, `tran_id`, `val_id`, `amount`, `currency_amount`, `verify_key`, `verify_sign`, `value_a` from the POST body.
2. **Signature verification** — rebuild the hash from `verify_key` + received values and compare to `verify_sign` (see §9). If mismatch → log & return success-noop (never trust unsigned calls).
3. Find `Payment` by `tranId`; if not found → record in `raw` and return 200 (avoid leaking existence; no state change).
4. **Idempotency**: if `payment.status === VALID` already → return 200 with no state change (prevents duplicate credit).
5. Update `payment.raw`, `ipnReceivedAt`, and set `status` to a transient `PENDING` (verification started).
6. **Server-side verification** — call the SSLCommerz **Validation API**:
   `GET <base>/validator/api/validationserverAPI.php?val_id=<val_id>&store_id=...&store_passwd=...&format=json`
   - Require response `status === "VALID"` or `"VALIDATED"`.
   - Cross-check `tran_id` matches `payment.tranId`, and `currency_amount` (or `amount`) ≈ `payment.amount` (tolerance, e.g. within 1 BDT). Mismatch → mark `FAILED`/log as suspicious.
7. On success, atomically transition the specific payment from `INITIATED/PENDING` → `VALID` (use `findByIdAndUpdate` with a status filter to avoid double-commit), set `valId`, `paidAt`, `verifiedAt`, then:
   - Set `ride.isPaid = true`.
   - **Idempotently** credit driver: only if not already credited (see §9 — guarded by a checked atomic update / credited flag on the ride or payment).
8. Respond `200` to SSLCommerz immediately.

### 7.3 Redirect callbacks — `POST /api/payments/success|fail|cancel`

SSLCommerz redirects the browser to these after the user leaves the gateway. Each:
1. Reads the `POST` body (same form params).
2. Calls the same verification/status-update logic as the IPN (for `success`, run full verification; for `fail`/`cancel` mark corresponding status if not already terminal).
3. Redirects (HTTP 302) the browser to `PAYMENT_FRONTEND_REDIRECT_URL?status=<VALID|FAILED|CANCELLED|EXPIRED>&tranId=<id>&rideId=<value_a>` so the frontend can reflect the result (the frontend also polls `/payments/:rideId/status` for ground truth).

### 7.4 Payment status — `GET /api/payments/:rideId/status`

Rider (owner) or `ADMIN`. Returns the latest `Payment` for the ride (status, amount, paidAt). Ownership check: rider must own the ride. Used for frontend polling.

### 7.5 Payment history — `GET /api/payments/me`

RIDER — returns payments where `rider = userId`, newest first (reuse `QueryBuilder` if list filtering/pagination is desired).

---

## 8. Ride / Driver integration changes

Update the existing completion path so settlement is gateway-driven, not hard-coded:

- **`src/app/modules/driver/driver.service.ts` → `updateRideStatus`**: when transitioning `IN_TRANSIT → COMPLETED`:
  - **Remove** the eager `ride.isPaid = true` and `driver.earnings += ride.fare` on completion.
  - Leave `ride.isPaid = false` and set `ride.timestamps.completedAt` (as today); driver availability returns `ONLINE` (as today).
  - Define a `PaymentService.creditDriver(paymentId/rideId)` that is called **only** from the verified IPN path. Do **not** credit earnings here.
- **`src/app/modules/ride/ride.interface.ts`**: keep `isPaid`; no structural change required. (Optional: add a `paidAt` timestamp on the ride for reporting.)
- Keep the rider-facing **"Pay Now"** state discoverable: `GET /rides/me` already returns `isPaid` and `status`, so the frontend can show a "Pay for completed ride" action when `status === COMPLETED && isPaid === false`.

---

## 9. Security & Duplicate-Payment Prevention

1. **Server-side verification is mandatory.** Never trust the browser redirect or the bare `success` URL. The **IPN + Validation API** round-trip is the source of truth. All `VALID` transitions happen only after the Validation API confirms `status = VALID/VALIDATED` **and** `tran_id`/`amount` match the stored `Payment`.
2. **Signature / `verify_sign` verification** on every callback/IPN body. Recompute the hash from `verify_key` (the ordered list of keys) and the corresponding posted values, compare to `verify_sign`. Reject mismatches (log + 200 noop). This is additional defense-in-depth over the Validation API.
3. **Amount cross-check.** Validation API `currency_amount`/`amount` must match `Payment.amount` (within tolerance). Reject any mismatch. Prevents payer tampering with `total_amount`.
4. **`tran_id` uniqueness.** Unique DB index on `tranId` prevents two payments sharing a transaction id.
5. **Ownership checks.** Initiate is gated by the JWT rider identity and `ride.rider === riderId`. A rider can never initiate payment for another rider's ride.
6. **Role gating.** `checkAuth(Role.RIDER, Role.ADMIN)` on monetary endpoints; `ADMIN` is read-only for payments.
7. **Idempotent crediting (duplicate IPN / concurrent IPN).** Because SSLCommerz may deliver the IPN more than once, crediting `driver.earnings` must be atomic and exactly-once:
   - Transition the `Payment` with a **status filter** e.g. `findOneAndUpdate({ _id, status: { $in: [INITIATED, PENDING] } }, { $set: { status: VALID, ... } })` — only the call that flips to `VALID` proceeds to credit.
   - Alternatively/also guard driver credit with an atomic `Driver.findOneAndUpdate({ _id, earnings: <old> }, { $inc: { earnings: fare } })` or a "credited" flag on the payment/ride, and re-check `ride.isPaid` before crediting.
   - If a payment is already `VALID` (duplicate IPN) → no-op, no re-credit.
8. **Fare trust (hardening, flagged).** The client currently supplies `fare` at ride request and the server trusts it. For production correctness, compute/validate the fare server-side (e.g. server-side fare calculation or an admin-set pricing table) so a malicious client cannot pay 10 BDT for an expensive ride. **Out of scope** for a minimal delivery but must be documented as a known weakness; at minimum cross-check `payment.amount === ride.fare` at initiation (derived from the stored ride, not the request).

---

## 10. Failure & Cancellation Handling

- **User cancels / backs out on the gateway** (`CANCELLED`): mark `Payment.CANCELLED` if not terminal; `ride.isPaid` stays `false`; rider may retry.
- **Payment declined / failed** (`FAILED`): mark `FAILED`; rider may retry (initiate again → new `tranId` + new `Payment` doc, or reuse the pending one).
- **Timeout** (`EXPIRED` handled by validation response guard): mark `EXPIRED`; retryable.
- **Gateway unreachable at initiation**: catch the HTTP error, persist `raw` and a `FAILED`/no session, return a friendly `AppError(502/500)`; do not create a dangling `INITIATED` payment without a session where possible (or mark it retryable).
- **Validation API unreachable at IPN time**: keep payment `PENDING` (do **not** mark `VALID`), respond 200 to SSLCommerz; rely on the **success callback** (browser) to retry verification, or optionally a retry/`GET .../status` reconcile that re-verifies pending payments. Frontend must not assume success until `status === VALID`.
- **Ride still unpaid after N attempts**: frontend shows "Payment pending/failed — retry".

---

## 11. Frontend / API Integration Requirements (documentation only — no frontend files)

> The frontend lives in a separate repo. This section documents the API contract the frontend must implement; no frontend files are created or modified here.

1. **Initiate**: when a ride is `COMPLETED && isPaid === false`, rider calls `POST /api/payments/initiate` with `{ rideId }` (authenticated). Response returns `data.gatewayUrl` → frontend redirects the browser to it.
2. **Callbacks**: set SSLCommerz admin-panel callback/IPN URLs to the backend `PAYMENT_SUCCESS_URL`, `PAYMENT_FAIL_URL`, `PAYMENT_CANCEL_URL`, `PAYMENT_IPN_URL` (backend handles verification and 302-redirects the browser to `PAYMENT_FRONTEND_REDIRECT_URL?status=...&tranId=...&rideId=...`).
3. **Status polling**: after redirect back, frontend calls `GET /api/payments/:rideId/status` to fetch ground truth (`status`, `amount`, `paidAt`) and updates the ride UI only on `VALID`.
4. **History**: `GET /api/payments/me` for the rider's payment history.
5. **Ride list**: `GET /rides/me` already exposes `status` and `isPaid` — frontend uses these to show the "Pay Now"/"Paid" states. No new ride fields required for v1.
6. **Never show success** from the redirect alone; always confirm via the status endpoint.

---

## 12. Implementation Checklist (files to create/modify)

**Create**
- `src/app/modules/payment/payment.interface.ts`
- `src/app/modules/payment/payment.model.ts`
- `src/app/modules/payment/payment.validation.ts`
- `src/app/modules/payment/payment.constant.ts` (status enum + endpoint/URL builders)
- `src/app/modules/payment/payment.service.ts` (initiate, handleIpn, verify, creditDriver, fail/cancel handlers, status, history)
- `src/app/modules/payment/payment.controller.ts`
- `src/app/modules/payment/payment.route.ts`
- `src/app/utils/sslcommerz.ts` (HTTP helpers: initiate session, call validation API, signature verify; sandbox/live endpoint selection)

**Modify**
- `src/app/config/env.ts` — add SSLCommerz + callback URL env vars (and update `.env`/README example)
- `src/app/routes/index.ts` — register `PaymentRoutes` under `/api/payments`
- `src/app/modules/driver/driver.service.ts` — decouple driver earnings / `isPaid` from the completion transition; move crediting to verified IPN
- `src/app.ts` — ensure `express.urlencoded({ extended: true })` is added so SSLCommerz form `POST` bodies (IPN/callbacks) are parsed

**Verify**
- `npm run lint`
- `npm run build`
- (No test suite exists — `npm test` errors by design; rely on lint + build.)

---

## 13. Out of Scope / Future

- Refund flows (`VALID → REFUNDED` via SSLCommerz refund API) — model field reserved, not implemented in v1.
- Server-side fare pricing table / fare calculation engine (see §9.8 hardening).
- Wallet / ledger / driver payout settlement (out of band).
- Realtime payment notifications (WebSockets).
