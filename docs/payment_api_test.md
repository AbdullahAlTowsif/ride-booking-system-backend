# Payment API — End-to-End Testing Guide

This guide walks a developer through the complete payment pipeline from scratch:
**register → login → become a driver → complete a ride → pay via SSLCommerz (sandbox) → verify status & driver payout**.

It references the actual routes, payloads, and response shapes in this repository, so the steps below are copy-paste ready.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Running backend | `npm run dev` (port `5000`) or the deployed Vercel backend |
| `.env` configured | All 11 `SSL_*` + standard vars present (see `docs/ssl_payment.md`) |
| Publicly reachable callback URLs | SSLCommerz must reach `SSL_IPN_URL` etc. over the internet (see §10) |
| Postman / cURL / REST client | Any would work; `jq` optional for pretty-printing |
| Browser | Required for the SSLCommerz checkout page (§7) |

### Base URLs

- **Local dev:** `http://localhost:5000/api`
- **Production (Vercel):** `https://ride-booking-system-backend.vercel.app/api`

> Every example below uses `$BASE` as a stand-in. Replace it with one of the above.

---

## 2. Auth Basics — how to authenticate

- Login returns `accessToken` in the JSON body **and** sets `accessToken`/`refreshToken` httpOnly cookies.
- `checkAuth` accepts the token from **either**:
  - Header: `Authorization: <raw-accessToken>` — note: the code uses the header value *verbatim* as the JWT, so **do NOT prefix `Bearer `**.
  - Cookie: `Cookie: accessToken=<raw-accessToken>`

Store the returned `accessToken` in an environment variable `$TOKEN` and send it as:

```bash
-H "Authorization: $TOKEN"
```

Every protected call in this guide assumes `$TOKEN` is set.

---

## 3. Step 0 — Start the server

```bash
npm run dev
```

The app connects to MongoDB, seeds the admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD`), and listens on `http://localhost:5000`. Verify with a public route:

```bash
curl -s http://localhost:5000/api/payments/ipn -X POST -d "ping" | head -c 50
```

(Any response other than a 4xx/5xx HTML error means the server is up.)

---

## 4. Step 1 — Register two users (rider + future driver)

Registration requires: `name`, `email`, `password` (≥8 chars, 1 uppercase, 1 number, 1 special char). `phone` is **recommended** because SSLCommerz sends it to the payment gateway as `cus_phone`.

### 4.1 Rider

```bash
curl -s -X POST $BASE/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Rider",
    "email": "rider@test.com",
    "password": "Test@123",
    "phone": "01711112222",
    "address": "Banani, Dhaka"
  }'
```

Response (envelope is always `{ statusCode, success, message, data }`):

```json
{
  "statusCode": 200,
  "success": true,
  "data": { "_id": "<userId>", "role": "rider", "isVerified": true, "email": "rider@test.com", "...": {...} }
}
```

> New users are created with `isVerified: true`, so login works immediately.

### 4.2 Future driver (a second account)

```bash
curl -s -X POST $BASE/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Driver",
    "email": "driver@test.com",
    "password": "Test@123",
    "phone": "01733334444"
  }'
```

Record both user IDs. You'll use `rider` from now until §6, then switch to `driver`.

---

## 5. Step 2 — Login

Credentials login uses the local Passport strategy: body fields are `email` and `password`.

### Rider login

```bash
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "rider@test.com", "password": "Test@123" }'
```

Response `data` contains:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<jwt>",
  "user": { "role": "rider", "email": "rider@test.com", "...": "..." }
}
```

```bash
# put it in a shell variable for the rest of the session
$TOKEN = "<jwt from above>"
```

> Admin login is identical — use the `ADMIN_EMAIL`/`ADMIN_PASSWORD` from `.env`; the seeded admin's `role` is `admin`.

---

## 6. Step 3 — Turn the second user into an approved driver

A rider cannot see/accept rides until their driver application is **APPROVED** by an admin.

### 6.1 Apply to be a driver (rider token)

Switch to the driver token:

```bash
curl -s -X POST $BASE/driver/apply-driver \
  -H "Authorization: $TOKEN_DRIVER" \
  -H "Content-Type: application/json" \
  -d '{ "vehicleType": "Sedan", "vehicleNumber": "DHAKA-11-1234" }'
```

Response `data` contains the **Driver document** — note its `_id` (this is the **driver id**, distinct from the user id):

```json
{
  "data": {
    "_id": "<driverId>",
    "user": "<driverUserId>",
    "approvalStatus": "PENDING",
    "availabilityStatus": "ONLINE",
    "earnings": 0
  }
}
```

### 6.2 Approve the driver (admin token)

```bash
curl -s -X PATCH $BASE/admin/driver/approve/<driverId> \
  -H "Authorization: $TOKEN_ADMIN"
```

### 6.3 (Optional) Confirm driver is eligible

```bash
curl -s $BASE/driver/me-driver -H "Authorization: $TOKEN_DRIVER"
```

The driver is `ONLINE` by default after applying. If a previous ride left them `OFFLINE`, set them back online:

```bash
curl -s -X PATCH $BASE/driver/availability \
  -H "Authorization: $TOKEN_DRIVER" \
  -H "Content-Type: application/json" \
  -d '{ "availabilityStatus": "ONLINE" }'
```

---

## 7. Step 4 — Rider requests a ride

Switch back to the rider token (`$TOKEN_RIDER`). Ride request body requires `pickupLocation`, `destinationLocation`, and `fare` (≥ 10, in BDT).

```bash
curl -s -X POST $BASE/rides/request \
  -H "Authorization: $TOKEN_RIDER" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLocation": {
      "address": "Banani, Dhaka",
      "coordinates": { "lat": 23.7937, "lng": 90.4066 }
    },
    "destinationLocation": {
      "address": "Dhanmondi, Dhaka",
      "coordinates": { "lat": 23.7461, "lng": 90.3744 }
    },
    "fare": 150
  }'
```

Record the returned `data._id` as `$RIDE_ID`. The ride is created with `status: REQUESTED`.

---

## 8. Step 5 — Driver accepts and completes the ride

### 8.1 Driver sees the available ride (driver token)

```bash
curl -s $BASE/driver/rides-available -H "Authorization: $TOKEN_DRIVER"
```

### 8.2 Driver accepts it

```bash
curl -s -X PATCH $BASE/driver/rides/$RIDE_ID/accept \
  -H "Authorization: $TOKEN_DRIVER"
```

### 8.3 Progress it to completion (3×status toggles)

`PATCH /driver/rides/:id/status` advances one step per call:
`ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED`

```bash
curl -s -X PATCH $BASE/driver/rides/$RIDE_ID/status -H "Authorization: $TOKEN_DRIVER"
curl -s -X PATCH $BASE/driver/rides/$RIDE_ID/status -H "Authorization: $TOKEN_DRIVER"
curl -s -X PATCH $BASE/driver/rides/$RIDE_ID/status -H "Authorization: $TOKEN_DRIVER"
```

Optionally confirm:

```bash
curl -s $BASE/driver/my-rides -H "Authorization: $TOKEN_DRIVER"
# last ride's status should be COMPLETED
```

> **Why this matters for payment:** payment can only be initiated on a `COMPLETED` ride that `isPaid === false`. Earnings are **not** credited here anymore — they're credited only after a verified payment (§9.1).

---

## 9. Step 6 — Initiate the SSLCommerz payment (rider token)

```bash
curl -s -X POST $BASE/payments/initiate \
  -H "Authorization: $TOKEN_RIDER" \
  -H "Content-Type: application/json" \
  -d '{ "rideId": "'$RIDE_ID'" }'
```

Response `data`:

```json
{
  "gatewayUrl": "https://sandbox.sslcommerz.com/gwprocess/v4/process.php?...",
  "tranId": "RIDE<rideId><timestamp>",
  "paymentId": "<paymentId>"
}
```

Behind the scenes the backend:
1. Validates the ride is completed, unpaid, and belongs to you.
2. Calls SSLCommerz session API (`SSL_PAYMENT_API`) with `total_amount`, `tran_id`, the four callback URLs, and your user info as `cus_*` fields.
3. Stores a `Payment` doc with `status: INITIATED`.

---

## 10. Step 7 — Pay on the SSLCommerz sandbox gateway

The gateway must be able to **reach back** to your callback URLs, so:

- **Local dev:** the `SSL_*_BACKEND_URL`, `SSL_IPN_URL` in `.env` must point to a public URL (e.g. `https://<your-ngrok-id>.ngrok-free.app/api/payments/...`). Restart the server after changing them.
- **Vercel:** they're already the deployed `https://ride-booking-system-backend.vercel.app/...` URLs — nothing to change.

Then:

1. Open `gatewayUrl` from the initiate response in a browser.
2. Choose **Card** (or mobile wallet if set up on your sandbox account).
3. Use SSLCommerz's published **sandbox test instrument** (any future expiry / any CVV):

| Field | Value |
|---|---|
| Card number | `4711 6082 6408 0835` (VISA) or `5234 1236 7456 1122` (Mastercard) |
| Expiry | any future date, e.g. `12/35` |
| CVV | any 3 digits |
| OTP / trial | `123456` |

4. Complete checkout.

### What happens next (read this carefully)

- SSLCommerz **redirects the browser** to `SSL_SUCCESS_BACKEND_URL` (or fail/cancel URL) with form fields including `status`, `tran_id`, `val_id`, `verify_key`, `verify_sign`.
- The backend **also** receives an **IPN POST** to `SSL_IPN_URL`.
- `POST /api/payments/success` runs the IPN handler too, then 302-redirects the browser to `SSL_SUCCESS_FRONTEND_URL?status=VALID&tranId=...&rideId=...`.
- The IPN handler:
  1. Marks the payment `PENDING` and stores the IPN body.
  2. Verifies `verify_sign` (signature check).
  3. Calls the validation API (`SSL_VALIDATION_API`) with `val_id`.
  4. Confirms `status = VALID/VALIDATED`, matching `tran_id`, and amount within tolerance.
  5. If all pass → `markValidAndSettle()`: sets `status: VALID`, marks the ride `isPaid`, and **credits the driver's `earnings`**.
  6. If signature or validation fails → `status: FAILED`, **no payout**.

> A stolen/forged IPN with the wrong signature is deliberately never settled — that's the anti-fraud guard, not a bug.

---

## 11. Step 8 — Verify the outcome

### Hot path (reliable)

```bash
curl -s $BASE/payments/$RIDE_ID/status -H "Authorization: $TOKEN_RIDER"
```

Expected `data` on a successful sandbox payment:

```json
{
  "status": "VALID",
  "amount": 150,
  "tranId": "RIDE<rideId><timestamp>",
  "paidAt": "<ISO timestamp>"
}
```

### Payment history

```bash
curl -s $BASE/payments/me -H "Authorization: $TOKEN_RIDER"
```

### Driver payout

```bash
curl -s $BASE/driver/earning-history -H "Authorization: $TOKEN_DRIVER"
```

Expected: `totalEarnings` increased by the fare (150), and the ride appears with payment settled.

### Guards against double pay

- Initiating again for the same ride → `400 "A payment is already in progress or completed for this ride"`.
- A second IPN for an already-`VALID` payment is ignored (`handleIpn` returns early).

---

## 12. Step 9 — FAIL / CANCEL flows

Testing failed/cancelled outcomes:

**Manual (recommended):** on the sandbox checkout, either cancel out of the page, or use a past expiry/incorrect credential to force a failure. Then check:

```bash
curl -s $BASE/payments/$RIDE_ID/status -H "Authorization: $TOKEN_RIDER"
# status: FAILED or CANCELLED
```

The browser is redirected to `SSL_CANCEL_FRONTEND_URL` / `SSL_FAIL_FRONTEND_URL` (each gets `?status=...&tranId=...&rideId=...`).

**Simulating a callback via cURL (engineering the failure case):**

```bash
curl -s -X POST $BASE/payments/fail \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "status=FAILED&tran_id=RIDE<rideId><timestamp>&val_id=FAKE&value_a=$RIDE_ID"
```

- The payment doc becomes `FAILED`.
- No driver payout occurs.
- Note the IPN route (`/api/payments/ipn`) ignores bodies without a valid `verify_sign` — that is by design, so a fabricated **successful** IPN cannot be replayed.

> A `FAILED` ride can be paid again: `payment.constant.ts` treats only `INITIATED`/`PENDING` as "in progress", and initiate only blocks active/valid payments — another initiate call will create a fresh session.

---

## 13. Step 10 — Quick end-to-end checklist

- [ ] Register rider → login (`rider` token)
- [ ] Register driver user → login (`driver` token)
- [ ] Apply driver → admin approves → driver ONLINE
- [ ] Rider requests ride → `$RIDE_ID` (status `REQUESTED`)
- [ ] Driver accepts → status `ACCEPTED`
- [ ] Drive status ×3 → status `COMPLETED`
- [ ] Rider initiates payment → `gatewayUrl`
- [ ] Pay in sandbox browser → redirect hits backend → browser ends at frontend status page
- [ ] `GET /payments/:rideId/status` → `VALID`
- [ ] `GET /driver/earning-history` → earnings increased
- [ ] Repeat initiate → `400` (already paid)

---

## 14. Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Missing Environment Variable SSL_...` | New `SSL_*` vars absent from `.env` (see `docs/ssl_payment.md` table) |
| `Ride is not available for acceptance` | Ride was accepted by another driver, or status isn't `REQUESTED` |
| `Payment can only be initiated for a completed ride` | Ride not yet `COMPLETED` (`/driver/rides/:id/status` still needs calls) |
| `Ride is already paid` | A previous session succeeded and settled this ride |
| Payment stuck at `PENDING` forever | IPN never reached the backend — check `SSL_IPN_URL` is publicly reachable / ngrok is running |
| Payment stuck `PENDING` on a fake IPN | Signature check failed by design; replay only works with a genuine sandbox flow |
| SSLCommerz returns `INVALID_REQUEST` on initiate | Store credentials wrong, or `total_amount`/required cus fields missing |
| 403 on protected routes | Wrong/missing token, or token sent with `Bearer ` prefix (send the raw JWT), or `checkAuth` role mismatch |

---

## 15. Endpoint reference used in this guide

| Method | Path | Auth | Body summary |
|---|---|---|---|
| POST | `/api/user/register` | public | `name`, `email`, `password`, `phone?`, `address?` |
| POST | `/api/auth/login` | public | `email`, `password` |
| POST | `/api/driver/apply-driver` | rider | `vehicleType`, `vehicleNumber` |
| PATCH | `/api/admin/driver/approve/:driverId` | admin | — |
| PATCH | `/api/driver/availability` | driver | `{ "availabilityStatus": "ONLINE" / "OFFLINE" }` |
| POST | `/api/rides/request` | rider, admin | `pickupLocation`, `destinationLocation`, `fare` |
| GET | `/api/driver/rides-available` | driver | — |
| PATCH | `/api/driver/rides/:rideId/accept` | driver | — |
| PATCH | `/api/driver/rides/:rideId/status` | driver | advances ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED |
| POST | `/api/payments/initiate` | rider | `{ "rideId": "..." }` → `gatewayUrl` |
| POST | `/api/payments/success` / `fail` / `cancel` | public (sig-checked) | SSLCommerz form POST-back |
| POST | `/api/payments/ipn` | public (sig-checked) | SSLCommerz IPN form POST |
| GET | `/api/payments/:rideId/status` | rider, admin | — |
| GET | `/api/payments/me` | rider | payment history |
| GET | `/api/driver/earning-history` | driver | `totalRides`, `totalEarnings`, `rides` |