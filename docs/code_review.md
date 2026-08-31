# Code Review Report

**Project**: Ride Booking System Backend
**Date**: 2026-08-31
**Reviewed by**: OpenCode AI Agent

---

## Critical Bugs

### 1. Missing `return` in Google OAuth blocked-user handler
**File**: `src/app/config/passport.ts:102`
```ts
if (isUserExist && (isUserExist.isBlock === IsBlock.BLOCK)) {
  done(`User is Blocked`); // missing return!
}
```
Without `return`, execution falls through to the user-creation block below, so a blocked user could be re-created or silently passed to `done(null, isUserExist)`. Add `return` before `done(...)`.

### 2. Missing `await` on `user.save()` in `changePassword`
**File**: `src/app/modules/auth/auth.service.ts:76`
```ts
user!.save(); // not awaited
```
The password change is not guaranteed to persist before the response is sent. Use `await user!.save()`.

### 3. Null pointer risk in `changePassword`
**File**: `src/app/modules/auth/auth.service.ts:62-66`
```ts
const user = await User.findById(decodedToken.userId);
const isOldPasswordMatch = await bcryptjs.compare(oldPassword, user!.password as string);
```
If `User.findById` returns `null`, the non-null assertion `user!` will crash at runtime with a TypeError. Check for null before accessing properties.

### 4. Validation middleware runs *after* controller on `apply-driver`
**File**: `src/app/modules/driver/driver.route.ts:10`
```ts
router.post("/apply-driver", checkAuth(Role.RIDER), DriverController.applyToBeDriver, validateRequest(createDriverZodSchema));
```
`validateRequest` is the third middleware — the controller already ran. Move `validateRequest` before the controller:
```ts
router.post("/apply-driver", checkAuth(Role.RIDER), validateRequest(createDriverZodSchema), DriverController.applyToBeDriver);
```

### 5. Race condition in ride acceptance
**File**: `src/app/modules/driver/driver.service.ts:49-92`
Two drivers can accept the same ride simultaneously because `Ride.findById` + `ride.save()` is not atomic. Use `findOneAndUpdate` with a status filter:
```ts
const ride = await Ride.findOneAndUpdate(
  { _id: rideId, status: RideStatus.REQUESTED, driver: null },
  { $set: { driver: driver._id, status: RideStatus.ACCEPTED, "timestamps.acceptedAt": new Date() } },
  { new: true }
);
if (!ride) throw new AppError(...);
```

### 6. `getMeta()` counts unfiltered documents
**File**: `src/app/utils/QueryBuilder.ts:67-76`
```ts
async getMeta() {
  const totalDocuments = await this.modelQuery.model.countDocuments(); // no filter!
```
`countDocuments()` is called with no filter, so pagination metadata is wrong when filters/search are applied. Clone the query before chaining `.build()` and call `countDocuments(filter)` instead.

### 7. Type mismatches in `IUser`
**File**: `src/app/modules/user/user.interface.ts:27-28`
```ts
isDeleted?: string; // should be boolean
isBlock?: string;   // should be IsBlock enum
```
The model treats `isBlock` as `IsBlock` enum and `isDeleted` as `Boolean`, but the interface declares both as `string`. This hides type errors across the codebase.

### 8. Zod schema field name mismatch
**File**: `src/app/modules/user/user.validation.ts:54`
```ts
IsBlock: z.enum(Object.values(IsBlock) as [string]).optional(),
```
The field is `IsBlock` (capital I) but the actual model field is `isBlock`. This means the validation never matches the real field name, and any update payload with `isBlock` bypasses this check.

### 9. Ride cancellation doesn't restore driver availability
**File**: `src/app/modules/ride/ride.service.ts:64-79`
When a rider cancels a ride that was `ACCEPTED` (driver assigned), the driver's `availabilityStatus` is never set back to `ONLINE`. The driver stays offline until manually toggled.

### 10. Driver approval permanently changes user role
**File**: `src/app/modules/admin/admin.service.ts:27`
```ts
await User.findByIdAndUpdate(existingDriver.user, { role: Role.DRIVER });
```
Approving a driver sets `role: DRIVER`. Suspending the driver (`suspendDriver`) never reverts the role, so a suspended driver still has `DRIVER` role and retains role-based permissions.

---

## Security Issues

### 1. Open redirect via OAuth `state` parameter
**File**: `src/app/modules/auth/auth.controller.ts:129-145`
```ts
let redirectTo = req.query.state ? req.query.state as string : ""
res.redirect(`${envVars.FRONTEND_URL}/${redirectTo}`)
```
An attacker can craft a Google login link with `state=//evil.com` to redirect users to an external site after authentication. Validate that `redirectTo` is a relative path or against an allowlist.

### 2. Alert endpoint has no authentication
**File**: `src/app/modules/alert/alert.route.ts:6`
```ts
router.post("/", AlertController.createAlert);
```
No `checkAuth` middleware — anyone can trigger alerts without logging in.

### 3. User update allows arbitrary field modification
**File**: `src/app/modules/user/user.service.ts:60`
```ts
const newUpdatedUser = await User.findByIdAndUpdate(userId, payload, ...)
```
The raw `req.body` payload is passed directly to `findByIdAndUpdate`. A rider could send `{ "role": "ADMIN" }` or modify `password`, `auths`, `isVerified`, etc. Whitelist allowed fields per role.

### 4. Login response returns tokens in body *and* cookie
**File**: `src/app/modules/auth/auth.controller.ts:35-36`
```ts
data: {
  accessToken: userTokens.accessToken,
  refreshToken: userTokens.refreshToken,
  user: rest
}
```
Tokens are set as httpOnly cookies (good) but also returned in the JSON body, which undermines the cookie-based security model. If tokens are only consumed via cookies, remove them from the response body.

### 5. Cookie `secure` flag hardcoded to `true`
**File**: `src/app/utils/setCookie.ts:14` and `src/app/modules/auth/auth.controller.ts:49,54`
```ts
secure: true,
```
`secure: true` means cookies are never sent over HTTP. This breaks local development on `localhost` without HTTPS. Use `secure: envVars.NODE_ENV === "production"`.

### 6. No rate limiting on auth endpoints
Login, register, refresh-token, and password-change endpoints have no rate limiting, making them vulnerable to brute-force attacks.

### 7. Logout doesn't invalidate the session
**File**: `src/app/modules/auth/auth.controller.ts:45-63`
The logout clears cookies but doesn't call `req.session.destroy()` or blacklist the JWT. A stolen access token remains valid until it expires.

### 8. `validateRequest` middleware crashes on non-string `req.body.data`
**File**: `src/app/middlewares/validateRequests.ts:7-8`
```ts
if (req.body.data) {
  req.body = JSON.parse(req.body.data)
}
```
If `req.body.data` is an object (not a string), `JSON.parse` throws a SyntaxError. Add a type check: `if (typeof req.body.data === "string")`.

---

## Improvements

### High Priority

| # | Issue | Location |
|---|-------|----------|
| 1 | No test suite exists | `package.json` — `npm test` exits with error |
| 2 | `handleDuplicateError` crashes if regex finds no match (`matchedArray[1]` on null) | `src/app/helpers/handleDuplicateError.ts:6-9` |
| 3 | `safetyContact` route has no input validation | `src/app/modules/safetyContact/safetyContact.route.ts` |
| 4 | `alert` service is a stub (only `console.log`) | `src/app/modules/alert/alert.service.ts:25` |
| 5 | `password` field validation missing on `set-password` and `change-password` endpoints | `src/app/modules/auth/auth.route.ts:14,17` |
| 6 | Unused import `urlencoded` in global error handler | `src/app/middlewares/globalErrorHandler.ts:4` |
| 7 | `password` field is required in `createUserZodSchema` but not stripped from the type, risking accidental exposure | `src/app/modules/user/user.validation.ts` |

### Medium Priority

| # | Issue | Location |
|---|-------|----------|
| 8 | Numerous `console.log` debug statements left in production code | `driver.service.ts`, `driver.controller.ts`, `safetyContact.service.ts`, `alert.service.ts` |
| 9 | Large blocks of commented-out code | `admin.service.ts:116-118`, `admin.controller.ts:71-79,103-111` |
| 10 | Typos in error messages: "recieved", "goolge", "cann't" | `server.ts:29,41`, `passport.ts:51`, `driver.service.ts:59` |
| 11 | `updateUser` response uses `httpStatus.CREATED` (201) instead of `httpStatus.OK` (200) | `src/app/modules/user/user.controller.ts:38` |
| 12 | `getMeta()` called on the same query instance used for data — may return wrong counts after `.build()` | `src/app/utils/QueryBuilder.ts:68` |
| 13 | Inconsistent route casing: `safetyContact` vs `alert` vs `rides` vs `driver` | `src/app/routes/index.ts` |
| 14 | `auths` field in user model has no duplicate-provider guard | `src/app/modules/user/user.service.ts:20` |

### Low Priority / Code Quality

| # | Issue | Location |
|---|-------|----------|
| 15 | `express-session` is configured but never meaningfully used (no session-based auth) | `src/app.ts:24-30` |
| 16 | `passport.serializeUser/deserializeUser` are defined but only used for Google OAuth callback flow — unnecessary overhead for JWT-based auth | `src/app/config/passport.ts:133-144` |
| 17 | `generateAdminReport` is exported directly from service rather than through the `AdminService` object | `src/app/modules/admin/admin.service.ts:120` |
| 18 | No `.env.example` file — developers must read README to know required env vars | Root directory |
| 19 | `QueryBuilder` accepts any `Record<string, string>` — no sanitization of `$gt`, `$lt`, `$regex` operators via query params | `src/app/utils/QueryBuilder.ts` |
| 20 | `ride.model.ts` has a custom `timestamps` field that shadows Mongoose's built-in `timestamps: true` option | `src/app/modules/ride/ride.model.ts:39-46` vs `:53` |

---

## Summary

| Category | Count |
|----------|-------|
| Critical Bugs | 10 |
| Security Issues | 8 |
| High Priority Improvements | 7 |
| Medium Priority Improvements | 7 |
| Low Priority / Code Quality | 6 |
| **Total** | **38** |

**Top 3 items to fix immediately:**
1. Race condition in ride acceptance (#5) — data integrity risk
2. User update allows arbitrary field modification (Security #3) — privilege escalation
3. Missing `return` in Google OAuth handler (#1) — blocked users can authenticate
