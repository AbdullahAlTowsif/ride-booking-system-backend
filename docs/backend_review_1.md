# Ride Booking System Backend — Comprehensive Review (v1)

> **Purpose:** a learning/reference document for the developer building the **frontend** of this project.
> It explains everything implemented in the backend, how parts communicate, every available API,
> the exact data the frontend must send/receive, and the complete Ride Booking workflow.
>
> Everything below is derived from reading the source code (`src/`). File paths are referenced so you
> can open any detail you want to verify.

---

## Table of contents

1. [Project overview](#1-project-overview)
2. [Technology stack](#2-technology-stack)
3. [How a request flows through the backend](#3-how-a-request-flows-through-the-backend)
4. [Folder structure](#4-folder-structure)
5. [Data model (collections & fields)](#5-data-model-collections--fields)
6. [Authentication & authorization](#6-authentication--authorization)
7. [Response & error envelope](#7-response--error-envelope)
8. [QueryBuilder (pagination, search, sort, fields)](#8-querybuilder-pagination-search-sort-fields)
9. [API endpoint catalog](#9-api-endpoint-catalog)
10. [SSLCommerz payment integration](#10-sslcommerz-payment-integration)
11. [Complete workflows](#11-complete-workflows)
12. [Frontend integration guide](#12-frontend-integration-guide)
13. [Known quirks & observations](#13-known-quirks--observations)
14. [Environment variables & commands](#14-environment-variables--commands)

---

## 1. Project overview

This is the **backend** of a **Ride Booking System** (like Uber/Pathao). Three actors exist:

| Role | What they do |
|---|---|
| **RIDER** | Registers, requests rides, pays for completed rides, manages safety contacts |
| **DRIVER** | Applies to be a driver, gets approved, accepts ride requests, drives them through PICKED_UP → IN_TRANSIT → COMPLETED, earns money |
| **ADMIN** | Approves/suspends drivers, blocks users, views all users/drivers/rides, sees stats (report) |

The whole system:

| Concern | Implementation |
|---|---|
| REST API | Express 5, all routes mounted under `/api` |
| Database | MongoDB + Mongoose 8 (models: `User`, `Ride`, `Driver`, `Payment`, `SafetyContact`) |
| Validation | Zod schemas (run by `validateRequest` middleware before the controller) |
| Auth | Passport.js (`local` + `google` strategies) + JWT access/refresh tokens |
| Passwords | bcryptjs hashing |
| Payments | SSLCommerz (Bangladeshi payment gateway) sandbox/live via axios |
| Errors | Centralized `globalErrorHandler` with typed error shapes |
| Deployment | Vercel (serverless) — runs the committed `dist/` build |

Key convention: each feature is a **module** under `src/app/modules/<name>/` containing
`route.ts → controller.ts → service.ts → model.ts/interface.ts/validation.ts/constant.ts`.
`src/app/routes/index.ts` is the single registry where every module route is mounted.

---

## 2. Technology stack

From `package.json`:

| Dependency | Version | Used for |
|---|---|---|
| express | ^5.1.0 | HTTP framework |
| mongoose | ^8.16.5 | ODM / schema modeling |
| passport, passport-local, passport-google-oauth20 | ^0.7.0 | Local + Google auth |
| jsonwebtoken | ^9.0.2 | JWT access/refresh tokens |
| bcryptjs | ^3.0.2 | Password hashing |
| cookie-parser | ^1.4.7 | Reading cookies (session/tokens) |
| express-session | ^1.18.2 | Passport session persistence |
| cors | ^2.8.5 | Cross-origin config (frontend URL) |
| zod | ^4.0.10 | Request body/param validation |
| axios | ^1.20.0 | SSLCommerz HTTP calls |
| http-status-codes | ^2.3.0 | HTTP status constants |

Scripts:

| Command | What it does |
|---|---|
| `npm run dev` | dev server via `ts-node-dev`, hot reload |
| `npm run build` | `tsc` compile to `dist/` |
| `npm run lint` | ESLint (flat config, typescript-eslint strict) |
| `npm start` | run compiled `dist/server.js` (used on Vercel) |

---

## 3. How a request flows through the backend

`src/app.ts` builds the middleware stack **in order** (this exact order matters):

```
cors(FRONTEND_URL, credentials:true)
  → expressSession(EXPRESS_SESSION_SECRET)
  → cookieParser()
  → express.json()                        // JSON bodies
  → express.urlencoded({extended:true})   // form bodies (SSLCommerz callbacks!)
  → passport.initialize() + passport.session()
  → router (all /api routes)
  → globalErrorHandler                    // any error ends here
  → notFound                              // unmatched routes
```

Then each protected route layer works like this:

```
Request
  → route.ts: match method + path
  → validateRequest(zodSchema)     // parse/validate body (skipped when route has no schema)
  → checkAuth(...roles)            // verify JWT + user state + role
  → controller                     // read req.user / req.body / req.params
  → service                        // business logic + DB queries
  → sendResponse(res, {data})      // uniform JSON envelope
```

Flow rules you should absorb:

1. `validateRequest` also handles the case where the frontend posts `{ data: "<json string>" }`
   (a workaround for multipart uploads) — it will `JSON.parse(req.body.data)` first.
2. `checkAuth` stamps `req.user` with the decoded JWT: `{ userId, email, role }`.
3. Controllers never do DB logic; services never touch `req`/`res`.
4. Errors thrown inside services bubble up through `catchAsync` → `next(error)`
   → `globalErrorHandler`.

### Entry point (`src/server.ts`)

1. Connects to MongoDB (`envVars.DB_URL`).
2. Starts express on `envVars.PORT`.
3. Seeds the admin user (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from env) if it doesn't exist.
4. Handles graceful shutdown for `SIGTERM` / `SIGINT` / `unhandledRejection` / `uncaughtException`.

---

## 4. Folder structure

```
src/
├── server.ts                      # bootstrap: DB connect, listen, seedAdmin, graceful shutdown
├── app.ts                         # express app: middleware order + /api mount + error handlers
├── app/
│   ├── config/
│   │   ├── env.ts                 # env loading, required-var check (throws on missing)
│   │   └── passport.ts            # local + google strategies, serialize/deserialize
│   ├── constants.ts               # excludeField list for QueryBuilder
│   ├── errorHelpers/AppError.ts   # custom error class {statusCode, message}
│   ├── helpers/                   # error→response normalizers
│   │   ├── handleZodError.ts
│   │   ├── handleValidationError.ts     # mongoose ValidationError
│   │   ├── handleDuplicateError.ts      # index 11000 (email etc.)
│   │   └── handleCastError.ts           # invalid ObjectId
│   ├── interfaces/                # Express.Request.user typing, TErrorSources
│   ├── middlewares/
│   │   ├── checkAuth.ts           # JWT + user-state + role guard
│   │   ├── validateRequests.ts    # zod schema runner
│   │   ├── globalErrorHandler.ts  # maps every error to {success,message,errorSources,...}
│   │   └── notFound.ts            # 404 handler
│   ├── modules/
│   │   ├── user/      # register, update profile, me
│   │   ├── auth/      # login, refresh-token, logout, set/change password, google
│   │   ├── ride/      # request, cancel, my rides, single ride
│   │   ├── driver/    # apply, available rides, accept/reject, status, earnings, profile
│   │   ├── admin/     # approve/suspend driver, block user, lists, report
│   │   ├── alert/     # emergency alert (currently logs only)
│   │   ├── safetyContact/ # rider emergency contacts CRUD
│   │   └── payment/   # SSLCommerz initiate, IPN/callbacks, status, history
│   ├── routes/index.ts            # central route registry (all modules)
│   └── utils/
│       ├── jwt.ts                 # sign/verify JWT
│       ├── userTokens.ts          # create access+refresh; refresh→new access
│       ├── setCookie.ts           # httpOnly accessToken/refreshToken cookies
│       ├── sendResponse.ts        # uniform {statusCode,success,message,data,meta}
│       ├── catchAsync.ts          # wraps async controllers, forwards errors
│       ├── QueryBuilder.ts        # chainable list-query builder
│       ├── seedAdmin.ts           # auto-create admin from env
│       └── sslcommerz.ts          # initiateSession, verifyTransaction, verifySignature
```

---

## 5. Data model (collections & fields)

### 5.1 Enums (they appear literally in API responses — match them exactly)

Source: `modules/{user,ride,driver,payment}/{*.interface.ts}`

| Enum | Values |
|---|---|
| `Role` | `"ADMIN"`, `"RIDER"`, `"DRIVER"` |
| `IsBlock` | `"BLOCK"`, `"UNBLOCK"` |
| `RideStatus` | `"REQUESTED"`, `"ACCEPTED"`, `"PICKED_UP"`, `"IN_TRANSIT"`, `"COMPLETED"`, `"CANCELLED"`, `"REJECTED"` |
| `IsApprove` (driver approval) | `"APPROVED"`, `"PENDING"`, `"SUSPENDED"`, `"BLOCKED"` |
| `IsAvailable` (driver) | `"ONLINE"`, `"OFFLINE"` |
| `PaymentStatus` | `"INITIATED"`, `"PENDING"`, `"VALID"`, `"FAILED"`, `"CANCELLED"`, `"EXPIRED"`, `"REFUNDED"` |

### 5.2 `User` (`user.model.ts`)

| Field | Type | Notes |
|---|---|---|
| `name` | string | required |
| `email` | string | required, unique |
| `password` | string? | hashed; missing for Google-only accounts |
| `role` | `"RIDER"` default | `"ADMIN"/"RIDER"/"DRIVER"` |
| `phone` | string? | BD format when submitted via API |
| `picture` | string? | Google profile photo |
| `address` | string? | used as `cus_add1` in SSLCommerz |
| `isDeleted` | bool default `false` | soft delete flag |
| `isBlock` | `"UNBLOCK"` default | `"BLOCK"/"UNBLOCK"` |
| `isVerified` | bool default `false` | register sets `true`; checkAuth rejects unverified |
| `auths` | [{provider: `"credentials"`/`"google"`, providerId}] | how the account was created / can log in |
| `createdAt`/`updatedAt` | timestamps | Mongoose auto |

> **Frontend note:** registration/login responses include the user document **without** password
> on login, **but registration returns the full doc including the password hash** — never display
> or persist `password` on the frontend.

### 5.3 `Ride` (`ride.model.ts`)

| Field | Type | Notes |
|---|---|---|
| `rider` | ObjectId → `User` | required |
| `driver` | ObjectId → `User` *(see quirk below)* | `null` until accepted |
| `pickupLocation` | `{ address: string, coordinates: { lat, lng } }` | required |
| `destinationLocation` | same shape | required |
| `status` | `RideStatus` default `"REQUESTED"` | drives the whole state machine |
| `fare` | number | **client-supplied** at request time (BDT) |
| `timestamps` | `{requestedAt, acceptedAt?, pickedUpAt?, inTransitAt?, completedAt?, cancelledAt?}` | filled as ride progresses |
| `isPaid` | bool default `false` | set `true` by payment settlement |

> ⚠️ **Critical quirk:** `ride.driver` stores the **Driver document `_id`**, even though the schema
> declares `ref: "User"`. This matters for the frontend — see
> [Known quirks §13](#driverid-vs-userid-confusion).

### 5.4 `Driver` (`driver.model.ts`) — one per user

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → `User` | unique — 1:1 with a user account |
| `vehicleType` | string | e.g. "Sedan" |
| `vehicleNumber` | string | unique |
| `approvalStatus` | `"PENDING"` default | admin flips to `"APPROVED"`/`"SUSPENDED"` |
| `availabilityStatus` | `"OFFLINE"` default | toggled by driver + automatically on accept/complete |
| `earnings` | number default `0` | **increased only by validated payments** |

**Two different IDs:** `Driver._id` (the driver record) vs `Driver.user` (the account id). The API
mostly uses `req.user.userId` (the **account** id), but a few responses return roads where the
**Driver** id is used (see §13).

### 5.5 `Payment` (`payment.model.ts`)

| Field | Type | Notes |
|---|---|---|
| `rider` | ObjectId → `User` | who pays |
| `ride` | ObjectId → `Ride` | indexed `{ride:1}`, `{ride:1,status:1}` |
| `driver` | ObjectId → `User` (actually Driver id, as above) | captured at initiate |
| `amount` | number | = `ride.fare` at initiate |
| `currency` | `"BDT"` | enum |
| `tranId` | string | unique, max 30 chars, format `RIDE<rideId><timestamp>` |
| `valId` | string? | SSLCommerz validation reference (set on VALID) |
| `status` | `PaymentStatus` | lifecycle, see §11.3 |
| `paidAt` / `ipnReceivedAt` / `verifiedAt` | Date? | audit timestamps |
| `raw` | Mixed object | stores raw initiate/IPN/validation responses — useful for debugging; returned by `/payments/me` |

### 5.6 `SafetyContact` (`safetyContact.model.ts`) — rider emergency contacts

| Field | Type | Notes |
|---|---|---|
| `riderId` | string | unique (the **user** id as a string!) |
| `contacts` | [{ name, phone, email? }] | array, replaced wholesale on save |

---

## 6. Authentication & authorization

### 6.1 Registration (`POST /api/user/register`)

- Body: `{ name, email, password, phone?, address? }`.
- Password rules (Zod): ≥ 8 chars, **1 uppercase, 1 number, 1 special char**.
- Phone rule: `+8801XXXXXXXXX` or `01XXXXXXXXX`.
- Registers with `role: RIDER`, `isVerified: true`, `auths: [{provider:"credentials"}]`.
- **Response also creates & sets auth cookies + returns no tokens in the body.**
  The user is considered "logged in" immediately after registering (cookie is set).

### 6.2 Login (`POST /api/auth/login`)

- Body: `{ email, password }` (Passport local strategy field names).
- Validates: user exists → verified → not blocked → not deleted → password matches.
  (Google-only accounts without a password get a clear message to set a password first.)
- On success sets **httpOnly cookies** `accessToken` + `refreshToken` and returns in the body:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User Logged In Successfully!",
  "data": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "user": { "role": "RIDER", "email": "...", "...rest...": "" }
  }
}
```

### 6.3 JWT contents and how the token is read

`createUserTokens` signs the payload `{ userId, email, role }`.

`checkAuth` (`middlewares/checkAuth.ts`) accepts the access token from **either** source:

- `Authorization` header — **the raw JWT, NO `Bearer ` prefix in this codebase**, or
- `accessToken` cookie.

Then it verifies the JWT, reloads the user, and rejects if:

| Condition | Message |
|---|---|
| no token | `No Token Recieved` (403) |
| user deleted | `User is Deleted` |
| not verified | `User is not Verified` |
| blocked | `User is Blocked` |
| role not allowed | `You are not permitted to view this route` (403) |

### 6.4 Cookie details (`setCookie.ts`)

```js
res.cookie("accessToken", ... , { httpOnly: true, secure: true, sameSite: "none" })
```

- httpOnly → JS can't read them (XSS-safe).
- `secure: true` + `sameSite: none` → requires **HTTPS and cross-site cookie support**.
  This is why the deployed version works with the Vercel frontend, but a `localhost` frontend
  calling `localhost` backend over plain HTTP may not persist cookies. In that case, frontend
  devs can pass the token in the `Authorization` header instead.

### 6.5 Refresh token flow

- `POST /api/auth/refresh-token` reads the `refreshToken` **from the cookie**,
  verifies it against `JWT_REFRESH_SECRET`, re-checks user state, and returns:
  `{ accessToken }` and re-sets the cookies.

### 6.6 Google OAuth

- `GET /api/auth/google?redirect=<path>` → takes the user to Google.
- `GET /api/auth/google/callback` → Passport creates-or-finds the user (role RIDER), sets cookies,
  redirects to `${FRONTEND_URL}/${redirect}`.
- Google-only users have no password. They can call `POST /api/auth/set-password` (authenticated)
  to add a password (adds a `credentials` auth provider), or `POST /api/auth/change-password`
  to change an existing one.

### 6.7 Logout

- `POST /api/auth/logout` (public) clears both cookies. Frontend should call this, then clear any
  local state.

---

## 7. Response & error envelope

### 7.1 Success (`sendResponse.ts`)

```json
{
  "statusCode": 200,
  "success": true,
  "message": "…",
  "meta": { "page": 1, "limit": 10, "total": 100, "totalPage": 10 },  // only list endpoints
  "data": { }
}
```

Your frontend API helper should read `data.data` (and `data.meta` for pagination).

### 7.2 Error (`globalErrorHandler.ts`)

```json
{
  "success": false,
  "message": "…",
  "errorSources": [ { "path": "email", "message": "Invalid email address format." } ]  // zod/validation only
}
```

`error` and `stack` are only present in development. Error classes handled:

| Error | Status | Message style |
|---|---|---|
| ZodError | 400 | `"Zod Error"` + per-field `errorSources` |
| Mongoose ValidationError | 400 | `"Validation Error"` + `errorSources` |
| Duplicate key (code 11000) | 400 | `"<value> already exists"` |
| CastError (bad ObjectId) | 400 | `"Invalid MongoDB ObjectID. Please provide a valid id."` |
| AppError (thrown by services) | whatever service set | exact service message |
| Any other Error | 500 | `error.message` |

> **Frontend tip:** always handle the case where `errorSources` has per-field messages and show them
> next to inputs (signup forms). Otherwise just show `message`.

---

## 8. QueryBuilder (pagination, search, sort, fields)

Used by admin list endpoints (`GET /admin/users`, `GET /admin/rides`). Supported query params:

| Param | Example | Effect |
|---|---|---|
| `searchTerm` | `?searchTerm=rafi` | regex, case-insensitive on configured fields |
| `page` | `?page=2` | default `1` |
| `limit` | `?limit=20` | default `10` |
| `sort` | `?sort=-createdAt` | default `-createdAt` |
| `fields` | `?fields=name,email` | projection (space-joined) |
| any other key | `?status=COMPLETED` | exact equality filter |

Searchable fields are defined in `admin.constant.ts`:
- Users: `["name","email","role"]`
- Rides: `["date","status"]` (note: `date` isn't a real field — it's a harmless leftover)

Paginated responses include `meta`:

```json
"meta": { "page": 1, "limit": 10, "total": 84, "totalPage": 9 }
```

---

## 9. API endpoint catalog

All paths are prefixed with `/api`. Body/query fields are the **exact** ones the backend reads.

### 9.1 User — `/api/user`

| Method | Path | Auth | Body / Query | Data returned |
|---|---|---|---|---|
| POST | `/user/register` | public | `{name, email, password, phone?, address?}` | full user doc (incl. password hash!) |
| GET | `/user/me` | any role | — | user profile (no password) |
| PATCH | `/user/:id` | any role (self or admin) | any of `name, phone, role, isBlock, isDeleted, isVerified, address` | updated user |

Notes: riders/drivers may only update themselves; only admins may change `role`/`isBlock`/etc.

### 9.2 Auth — `/api/auth`

| Method | Path | Auth | Body / Query | Data returned |
|---|---|---|---|---|
| POST | `/auth/login` | public | `{email, password}` | `{accessToken, refreshToken, user}` + cookies |
| POST | `/auth/refresh-token` | public (reads cookie) | — | `{accessToken}` + cookies |
| POST | `/auth/logout` | public | — | clears cookies |
| POST | `/auth/set-password` | any role | `{password}` (for Google accounts first time) | null |
| POST | `/auth/change-password` | any role | `{oldPassword, newPassword}` | null |
| GET | `/auth/google` | public | `?redirect=` | redirects to Google |
| GET | `/auth/google/callback` | public | — | sets cookies, redirects to frontend |

### 9.3 Ride — `/api/rides`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| POST | `/rides/request` | RIDER, ADMIN | `{ pickupLocation: {address, coordinates:{lat,lng}}, destinationLocation: same, fare }` | created ride |
| PATCH | `/rides/:id/cancel` | RIDER (owner) | — | cancelled ride |
| GET | `/rides/me` | RIDER | — | rides owned by this rider, newest first |
| GET | `/rides/:id` | RIDER (owner) | — | single ride |

Ride request rules:
- One active ride per rider — new request rejected with `"You already have an active ride in progress"`.
- `fare` must be ≥ 10.

### 9.4 Driver — `/api/driver`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| POST | `/driver/apply-driver` | RIDER | `{vehicleType, vehicleNumber}` | Driver doc (`approvalStatus: "PENDING"`) |
| GET | `/driver/rides-available` | DRIVER | — | rides with `driver: null` and `status: REQUESTED`, newest first |
| PATCH | `/driver/rides/:id/accept` | DRIVER | — | accepted ride |
| PATCH | `/driver/rides/:id/reject` | DRIVER | — | ride set to `REJECTED`, driver null again |
| PATCH | `/driver/rides/:id/status` | DRIVER (assigned) | — | advances `ACCEPTED → PICKED_UP → IN_TRANSIT → COMPLETED` (one call per step) |
| PATCH | `/driver/availability` | DRIVER | **`{ availabilityStatus: "ONLINE"/"OFFLINE" }`** | updated Driver doc |
| GET | `/driver/me-driver` | DRIVER | — | Driver doc for the current user |
| GET | `/driver/my-rides` | DRIVER | — | rides assigned to this driver, newest first |
| GET | `/driver/profile` | DRIVER | — | Driver doc **populated with the User** (name, phone…) |
| PATCH | `/driver/update-driver-profile` | DRIVER | `{name?, phone?, address?, vehicleType?, vehicleNumber?}` | `{ user, driver }` |
| GET | `/driver/earning-history` | DRIVER | — | `{ totalRides, totalEarnings, rides[] }` |

Driver rules:
- Accepting a ride sets `driver` = Driver `_id`, status `ACCEPTED`, driver availability → `OFFLINE`.
- The status endpoint is idempotent per transition and rejects invalid jumps
  (`"Invalid ride status transition from …"`).
- On `COMPLETED` the driver is set back `ONLINE`.
- Availability only allowed when `approvalStatus` is `APPROVED` (PENDING/SUSPENDED/BLOCKED rejected).

### 9.5 Admin — `/api/admin`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| PATCH | `/admin/driver/approve/:driverId` | ADMIN | — | Driver doc (`APPROVED`), user role flipped to `DRIVER` |
| PATCH | `/admin/driver/suspend/:driverId` | ADMIN | — | Driver doc (`SUSPENDED`), user role flipped back to `RIDER` |
| PATCH | `/admin/user/block/:userId` | ADMIN | — | User doc (`isBlock: BLOCK`) |
| PATCH | `/admin/user/unblock/:userId` | ADMIN | — | User doc (`isBlock: UNBLOCK`) |
| GET | `/admin/users` | ADMIN | QueryBuilder params (searchTerm, page, limit, sort, fields, role, …) | `{ data: User[], meta }` |
| GET | `/admin/drivers` | ADMIN | — | Driver[] with the **user populated** (`-password`) |
| GET | `/admin/rides` | ADMIN | QueryBuilder params | `{ data: Ride[], meta }` |
| GET | `/admin/report` | ADMIN | — | `{ totalUsers, totalDrivers, totalRides, completedRides, ongoingRides, totalEarnings }` |

### 9.6 Alert — `/api/alert`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| POST | `/alert/` | public | `{ rideId, location:{lat,lng}, contacts:[{name,phone,email?}], message }` | `{ ok: true }` |

> Currently a **placeholder** — `sendAlerts` only `console.log`s each contact. No DB write, no SMS.

### 9.7 SafetyContact — `/api/safetyContact`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| GET | `/safetyContact/` | RIDER | — | array of contact docs for the rider |
| POST | `/safetyContact/` | RIDER | **raw array**: `[{name, phone, email?}, …]` | saved contacts array |

### 9.8 Payment — `/api/payments`

| Method | Path | Auth | Body | Data returned |
|---|---|---|---|---|
| POST | `/payments/initiate` | RIDER (owner) | `{ rideId }` | `{ gatewayUrl, tranId, paymentId }` |
| POST | `/payments/ipn` | public (sig-verified) | SSLCommerz form POST | `"OK"` (text) |
| POST | `/payments/success` | public (sig-verified) | SSLCommerz form POST | 302 redirect to frontend success page |
| POST | `/payments/fail` | public (sig-verified) | SSLCommerz form POST | 302 redirect to frontend fail page |
| POST | `/payments/cancel` | public (sig-verified) | SSLCommerz form POST | 302 redirect to frontend cancel page |
| GET | `/payments/:rideId/status` | RIDER (owner) or ADMIN | — | `{ status, amount, tranId, paidAt }` |
| GET | `/payments/me` | RIDER | — | full Payment docs (incl. `raw`), newest first |

Full payment behavior is documented in §10 and §11.3.

---

## 10. SSLCommerz payment integration

### 10.1 Environment (renamed to the `SSL_*` scheme)

| Var | Value / purpose |
|---|---|
| `SSL_STORE_ID` | sandbox store id (e.g. `mysel6a96efd51ebd5`) |
| `SSL_STORE_PASS` | store password |
| `SSL_PAYMENT_API` | full session URL, sandbox: `https://sandbox.sslcommerz.com/gwprocess/v4/process.php` |
| `SSL_VALIDATION_API` | `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php` |
| `SSL_IPN_URL` | `https://ride-booking-system-backend.vercel.app/api/payments/ipn` |
| `SSL_SUCCESS_BACKEND_URL` | `…/api/payments/success` |
| `SSL_FAIL_BACKEND_URL` | `…/api/payments/fail` |
| `SSL_CANCEL_BACKEND_URL` | `…/api/payments/cancel` |
| `SSL_SUCCESS_FRONTEND_URL` | frontend page for success (e.g. `…/payment/success`) |
| `SSL_FAIL_FRONTEND_URL` | frontend page for fail |
| `SSL_CANCEL_FRONTEND_URL` | frontend page for cancel |

### 10.2 Initiate step (backend → SSLCommerz)

`initiate` in `payment.service.ts`:
1. Checks: ride exists, requester is the rider, ride `status === COMPLETED`, ride not already paid,
   no payment already IN PROGRESS/active for that ride.
2. Builds the payload with `total_amount = ride.fare`, generated `tran_id`
   (`RIDE<rideId><Date.now()>`, sliced to 30 chars), the four callback URLs, product details, and
   user info (`cus_*`, `ship_*` — name, email, phone, address, "Dhaka", postcode 1200, …).
3. `POST`s to `SSL_PAYMENT_API` (`initiateSession` in `sslcommerz.ts`).
4. If SSLCommerz returns `status !== "SUCCESS"` → 502 with its message.
5. Creates the `Payment` doc (status `INITIATED`) and returns
   `{ gatewayUrl, tranId, paymentId }`.

**Frontend:** call initiate → `window.location.href = data.gatewayUrl`.

### 10.3 Verification chain (IPN + redirect callbacks)

SSLCommerz posts callback/IPN data as `application/x-www-form-urlencoded` to both the IPN URL and
the success URL. `handleIpn` (`payment.controller` → `payment.service`) performs:

1. **Signature check** — `verifySignature(body, body.verify_key, body.verify_sign)`: MD5 over
   `key=value` pairs joined by `&`, **in the exact order** of `verify_key`.
2. Marks payment `PENDING`, stores the IPN body in `raw.ipn`.
3. **Validation API** — `GET SSL_VALIDATION_API?val_id=…&store_id=…&store_passwd=…&format=json&v=1`.
4. **Amount check** — validation amount must match within `PAYMENT_AMOUNT_TOLERANCE` (1).
5. Validates `validation.status` is `VALID`/`VALIDATED` and `tran_id` matches.
6. On success → `markValidAndSettle`:
   - Payment → `VALID` (+ `valId`, `paidAt`, `verifiedAt`).
   - Ride → `isPaid: true` (and ensures `completedAt`).
   - Driver → `earnings += ride.fare`.
7. On failure of any check → payment `FAILED`, **no settlement**.

Guards:
- If `payment.status === VALID` already, IPN is ignored (no double credit).
- Signature-invalid IPNs mark the payment `PENDING` then bail — a forged IPN never settles.
- Only `INITIATED`/`PENDING` payments can be settled (atomic `findOneAndUpdate` guard).

The browser redirect callbacks (`/success`, `/fail`, `/cancel`) run the same settle logic
(`/success` runs `handleIpn`) then **302-redirect** the browser to the matching frontend URL with
query params `status`, `tranId`, `rideId`.

> **Frontend:** the redirect target page should call
> `GET /api/payments/:rideId/status` for the authoritative state (it maps exactly to this flow),
> not trust the `status` query param alone.

### 10.4 Payment statuses (who sees what)

- `INITIATED` — session created, user is on the gateway.
- `PENDING` — callback/IPN received, being verified.
- `VALID` — paid & settled (ride marked paid, driver credited).
- `FAILED` — signature/validation/amount failed, or the manual fail callback.
- `CANCELLED` — user cancelled on the gateway.
- `EXPIRED` / `REFUNDED` — defined in the enum but not yet automated anywhere in services.

---

## 11. Complete workflows

### 11.1 Rides state machine

```
            driver accepts
 REQUESTED ───────────────► ACCEPTED ──(status)→ PICKED_UP ──(status)→ IN_TRANSIT ──(status)→ COMPLETED
   ▲   │                       │
   │   │ rider cancels         │ rider cancels (only REQUESTED/ACCEPTED can be cancelled)
   │   ▼                       ▼
   └──────────── CANCELLED ────┘

 REQUESTED ──(driver reject)→ REJECTED   (driver back to null)
```

Transition table:

| From | Via | Who | Next |
|---|---|---|---|
| `REQUESTED` | rider `POST /rides/:id/cancel` | rider | `CANCELLED` |
| `REQUESTED` | driver `PATCH /driver/rides/:id/accept` | driver | `ACCEPTED` (+driver assigned, driver→OFFLINE) |
| `REQUESTED` | driver `PATCH …/reject` | driver | `REJECTED` (driver stays null) |
| `ACCEPTED` | `PATCH …/status` ×1 | driver | `PICKED_UP` |
| `PICKED_UP` | `PATCH …/status` ×1 | driver | `IN_TRANSIT` |
| `IN_TRANSIT` | `PATCH …/status` ×1 | driver | `COMPLETED` (driver→ONLINE) |
| `ACCEPTED` | rider cancel | rider | `CANCELLED` |

Once completed, the ride is eligible for payment.

### 11.2 Driver onboarding

```
RIDER registers
   └─> POST /driver/apply-driver {vehicleType, vehicleNumber}
        └─> Driver {approvalStatus: PENDING, availabilityStatus: ONLINE}
             └─> Admin PATCH /admin/driver/approve/:driverId
                  ├─> Driver.approvalStatus → APPROVED
                  └─> User.role → DRIVER    (now it can hit /driver/* routes)
```

Suspension reverses the role to RIDER. Blocking a user stops all authenticated calls.

### 11.3 Payment lifecycle

```
Ride COMPLETED
  └─> RIDER POST /payments/initiate {rideId}
       └─> Payment INITIATED → user redirected to gatewayUrl
            ├─ user pays ↗
            │   SSLCommerz → IPN (+ success redirect)
            │     └─> Payment PENDING → verify signature → validation API → amount
            │          ├─ ok  → VALID   → ride.isPaid=true, driver.earnings+=fare
            │          └─ bad → FAILED
            ├─ user fails payment → FAILED (redirect to fail page)
            └─ user cancels     → CANCELLED (redirect to cancel page)
```

### 11.4 End-to-end happy path (user story → API calls)

| Step | Actor | API call | Result |
|---|---|---|---|
| 1 | Both users | `POST /user/register` ×2 | 2 riders created |
| 2 | Driver user | `POST /auth/login` | driver token |
| 3 | Driver user | `POST /driver/apply-driver` | Driver PENDING |
| 4 | Admin | `POST /auth/login` + `PATCH /admin/driver/approve/:driverId` | role→DRIVER |
| 5 | Rider | `POST /rides/request` | ride REQUESTED, `rideId` |
| 6 | Driver | `GET /driver/rides-available` → `PATCH /driver/rides/:id/accept` | ACCEPTED |
| 7 | Driver | `PATCH …/status` ×3 | COMPLETED |
| 8 | Rider | `POST /payments/initiate {rideId}` | gatewayUrl |
| 9 | Rider (browser) | open gatewayUrl, pay with sandbox card | IPN + redirect |
| 10 | Rider | `GET /payments/:rideId/status` | `VALID` |
| 11 | Driver | `GET /driver/earning-history` | `totalEarnings` increased |

---

## 12. Frontend integration guide

### 12.1 API client setup

- Base URL: `https://ride-booking-system-backend.vercel.app/api` (prod),
  `http://localhost:5000/api` (dev).
- Send `credentials: "include"` on every `fetch` so the httpOnly `accessToken`/`refreshToken`
  cookies are attached (the two sites are cross-origin but CORS + `sameSite:none` handle it).
- Alternative to cookies: read `accessToken` from the login JSON body and send
  `Authorization: <raw JWT>` (no `Bearer` prefix — the backend uses the header verbatim).
- Read the envelope: `res.ok ? data.data : handle(data.message, data.errorSources)`.
- On 401/403 during an API call → try `POST /auth/refresh-token`, retry once, else logout.

### 12.2 Which screen calls which API

| Frontend screen | Calls |
|---|---|
| Sign up | `POST /user/register` (auto-logged-in via cookie) |
| Login | `POST /auth/login` |
| Profile | `GET /user/me`, `PATCH /user/:id` |
| Password | `POST /auth/set-password` (Google), `POST /auth/change-password` |
| Home / map (rider) | `POST /rides/request` |
| Rider ride history | `GET /rides/me`, `GET /rides/:id` |
| Rider cancels ride | `PATCH /rides/:id/cancel` |
| Rider payment | `POST /payments/initiate`, `GET /payments/me`, `GET /payments/:rideId/status` |
| Rider safety contacts | `GET/POST /safetyContact` |
| Emergency button | `POST /alert` |
| Apply driver | `POST /driver/apply-driver`, `GET /driver/me-driver`, `GET /driver/profile` |
| Driver live requests | `GET /driver/rides-available`, accept/reject |
| Driver current ride | `PATCH /driver/rides/:id/status` (button per step) |
| Driver earnings | `GET /driver/earning-history`, `GET /driver/my-rides` |
| Driver availability toggle | `PATCH /driver/availability` body `{ availabilityStatus }` |
| Admin list pages | `GET /admin/users`, `/admin/rides`, `/admin/drivers` (QueryBuilder params) |
| Admin actions | approve/suspend driver, block/unblock user |
| Admin dashboard | `GET /admin/report` |

### 12.3 Data contracts to remember

- List responses always have `data` (array) + `meta {page, limit, total, totalPage}` on admin endpoints.
- Ride object's `driver` is a **Driver `_id`** (or `null`) — see §13 before assuming you can populate names.
- `GET /driver/my-rides` returns rides where `driver === <this driver's _id>`.
- `GET /driver/profile` populates the **User** (has `user.name`, `user.phone`) — the right endpoint
  when the frontend needs the driver's human data. `GET /driver/me-driver` returns the raw Driver doc.
- Payment status endpoint returns `{status, amount, tranId, paidAt}` only.
- The payment success/fail/cancel redirect pages receive query params `status`, `tranId`, `rideId`.

---

## 13. Known quirks & observations

> These are honest findings from reading the code. They don't block the frontend, but you should
> design around them.

1. **`ride.driver` stores a Driver `_id`, not a User `_id`.**
   In `driver.service.acceptRide` the ride is assigned `driver: driver._id`. The `Ride` schema
   declares `ref: "User"`, which is inaccurate. Consequence: `Ride.populate("driver")` would
   return `null`. **Workaround on the frontend:** don't rely on populated driver data from rides;
   use `GET /driver/my-rides` or a service to join driver/user info as needed.

2. **Driver id vs user id confusion across modules.**
   `getMyRides` passes `driver._id` (a Driver id) into `DriverService.getMyRides`, which does
   `Driver.findById(<that id>)` — natural only because of quirk #1. `getRideHistory` uses the
   **user** id and looks up `Driver.findOne({user})` correctly. Be careful to keep IDs straight
   when writing new endpoints.

3. **`cancelRide` driver-availability restore looks wrong.**
   `ride.service.cancelRide` calls `Driver.findOneAndUpdate({ user: ride.driver }, …)` — but
   `ride.driver` is a Driver `_id`, not a `user` field, so the assigned driver is *not* matched
   and their availability won't reset on cancel. Low impact for the frontend, worth knowing.

4. **Registration response leaks the password hash.**
   `user.controller.createUser` returns the full created user (including `password`). Login strips
   it; register doesn't. Don't log/store it on the frontend.

5. **`checkAuth` reads the Authorization header verbatim** — no `Bearer ` support. If your frontend
   axios/fetch interceptor adds `Bearer `, requests will fail with a JWT error. Strip it or use
   cookies.

6. **Cookies are forced `secure: true` + `sameSite: none`** even in dev (`setCookie.ts`). Locally
   over `http://localhost` cookies may not be set by the browser; switch to the Authorization header
   for local dev, or use the cookie mode against HTTPS.

7. **Admin report earnings vs driver earnings can differ.**
   `generateAdminReport` sums `fare` of all `COMPLETED` rides; driver `earnings` only increase on
   validated payments. Unpaid completed rides inflate the admin's `totalEarnings` relative to real
   **driver** earnings.

8. **`fare` is client-supplied and unverified.**
   There is no fare estimation/distance logic; the rider sets the price. So test amounts are
   whatever you choose (≥ 10).

9. **`GET /admin/rides` searchable field `"date"` doesn't exist on the schema**
   (`admin.constant.ts`) — searching by "date" silently returns nothing. Search by `status`
   works. Filtering (`?status=…`, `?isPaid=…`) works and is the recommended way.

10. **Alert is a stub** — `POST /alert` logs to the console only. Treat its `{ok:true}` as a
    placeholder until a real SMS/email provider is wired.

11. **No automated tests.** `npm test` is a placeholder. Everything is verified by running the
    server and hitting the endpoints (see `docs/payment_api_test.md`).

12. **`Payment.raw` is returned to the frontend** in `GET /payments/me`. It contains SSLCommerz
    initiate/IPN/validation payloads — fine for debugging, but don't render it raw.

13. **Availability toggle key is `availabilityStatus`**, not `status` — the controller destructures
    `req.body.availabilityStatus`. (Earlier docs in this repo used `status`; corrected.)

14. **Callback endpoints are public but guarded by signature + validation**, so don't wrap them in
    `checkAuth`, and never send `Authorization` headers to SSLCommerz. Forms must be
    `application/x-www-form-urlencoded` (Express `urlencoded` middleware is already enabled).

---

## 14. Environment variables & commands

15 required (from `env.ts` required-array) — the app **throws at boot** if any is missing:

| Var | Purpose |
|---|---|
| `PORT` | server port (dev: `5000`) |
| `DB_URL` | MongoDB connection string |
| `NODE_ENV` | `development` / `production` (toggles error detail, logs) |
| `BCRYPT_SALT_ROUND` | hash cost |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES` | access token signing/ttl |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES` | refresh token signing/ttl |
| `EXPRESS_SESSION_SECRET` | express-session |
| `FRONTEND_URL` | allowed CORS origin + google redirect base |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seeded admin credentials |
| `SSL_*` (11 vars) | SSLCommerz — see §10.1 |

Commands:

```bash
npm install
npm run dev        # develop
npm run build      # type-check + compile to dist/
npm run lint       # eslint
npm start          # run dist/server.js
```

---

### Suggested companion documents

- `docs/payment_api_test.md` — step-by-step **testing** pipeline (register → pay → verify) with cURL.
- `docs/ssl_payment.md` — SSLCommerz integration plan/checklist.
- `.opencode/specs/01-sslcommerz-payment-integration.md` — the original implementation spec.