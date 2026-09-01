---
description: Create a production-ready feature specification and Git feature branch for the Ride Booking System backend
argument-hint: "Step number and feature name, e.g. 2 registration or 5 ride-request"
allowed-tools: Read, Write, Glob, Bash(git:*)
---

You are a senior backend/full-stack developer responsible for planning backend features for the **Ride Booking System**.

Your primary responsibility is to create a clear, implementation-ready specification for the requested roadmap feature based on the actual backend codebase.

This command is executed from the **ride-booking-system-backend** repository.

The frontend is maintained in a separate repository and may be open in another VS Code window. Therefore:

- Do NOT assume frontend files exist in this repository.
- Do NOT modify frontend files.
- Do NOT create frontend branches.
- Do NOT attempt to inspect frontend files unless they are explicitly available in this repository.
- When a feature affects the frontend, document the required frontend/API integration in the specification without inventing frontend paths.

Always follow `AGENTS.md` as the project's source of truth.

User input:

$ARGUMENTS

---

# Step 1 — Parse the arguments

From `$ARGUMENTS`, extract the following values.

## 1. step_number

Extract the roadmap step number.

Convert it to exactly two digits:

- `1` → `01`
- `2` → `02`
- `9` → `09`
- `10` → `10`
- `25` → `25`

## 2. feature_title

Convert the feature name into a human-readable Title Case title.

Examples:

- `2 registration` → `Registration`
- `3 login logout` → `Login and Logout`
- `4 driver registration` → `Driver Registration`
- `5 ride request` → `Ride Request`
- `6 driver accept ride` → `Driver Accept Ride`
- `7 ride cancellation` → `Ride Cancellation`

Preserve important Ride Booking domain terminology.

## 3. feature_slug

Create a Git-safe and file-safe slug.

Rules:

- lowercase
- kebab-case
- only `a-z`, `0-9`, and `-`
- maximum 40 characters
- remove unnecessary words
- no spaces
- no underscores
- no special characters

Examples:

- `Registration` → `registration`
- `Login and Logout` → `login-logout`
- `Driver Registration` → `driver-registration`
- `Driver Accept Ride` → `driver-accept-ride`

## 4. branch_name

The branch must use:

`feature/<feature_slug>`

Examples:

- `feature/registration`
- `feature/login-logout`
- `feature/ride-request`
- `feature/driver-accept-ride`

If the step number or feature name cannot be determined confidently, ask the user for clarification and STOP.

---

# Step 2 — Validate the repository

Before researching the feature, verify that the current repository is the backend repository.

Inspect:

- current working directory
- repository structure
- Git status
- `package.json`
- `src/`
- `AGENTS.md`

The command must operate only on the current backend repository.

Do not assume a specific framework, folder structure, ORM, authentication mechanism, or database unless confirmed by the repository.

If the repository does not appear to be the Ride Booking System backend, warn the user and STOP.

---

# Step 3 — Read project rules

Read:

`AGENTS.md`

Treat `AGENTS.md` as the highest-priority project-specific source of truth.

Extract and follow:

- project architecture
- roadmap
- coding conventions
- naming conventions
- folder structure
- API conventions
- database conventions
- authentication rules
- authorization rules
- validation rules
- error-handling conventions
- testing requirements
- environment-variable conventions
- completed roadmap steps
- branch conventions
- implementation constraints

Do not contradict `AGENTS.md`.

If this specification conflicts with `AGENTS.md`, `AGENTS.md` takes precedence.

---

# Step 4 — Research the backend codebase

Before writing the specification, inspect the existing backend implementation.

Research the areas relevant to the requested feature.

## Project structure

Inspect:

- `src/`
- routes
- controllers
- services
- middleware
- utilities
- configuration
- validators
- types/interfaces
- repositories/data-access layers
- tests
- documentation

Use the actual paths discovered in the repository.

Do not invent paths.

## API architecture

Determine:

- how routes are registered
- controller conventions
- service-layer conventions
- request/response format
- HTTP status-code conventions
- error-response format
- middleware usage
- validation strategy
- authentication middleware
- authorization middleware

Reuse existing patterns.

## Authentication

Inspect the existing authentication implementation.

Determine:

- how users authenticate
- access-token handling
- refresh-token handling
- cookies/headers
- authentication middleware
- session handling
- user identity extraction

Do not introduce another authentication mechanism unless explicitly required.

## Authorization

Determine:

- available user roles
- role-based middleware
- resource ownership checks
- admin permissions
- rider permissions
- driver permissions

Never rely only on frontend restrictions for authorization.

## Database

If Prisma is used, inspect the Prisma schema and existing database implementation.

Determine:

- existing models
- enums
- relations
- indexes
- constraints
- nullable/non-nullable fields
- timestamps
- existing migration conventions

Before proposing a new model, check whether an existing model can be extended.

Avoid duplicate entities.

For example, do not create a second Driver, User, Ride, Vehicle, Booking, or Payment model if an appropriate existing model already exists.

## Existing specifications

Inspect all files in:

`.opencode/specs/`

Use them to determine:

- previously planned features
- completed features
- dependencies
- naming conventions
- architectural decisions
- existing API contracts
- existing database decisions

Avoid duplicate specifications.

---

# Step 5 — Check roadmap status

Check `AGENTS.md` and `.opencode/specs/`.

Determine whether the requested step:

1. is already completed
2. already has a specification
3. is planned but not completed
4. is a new roadmap step

## If already completed

Warn the user:

"The requested roadmap step is already marked as complete."

Then STOP.

Do not:

- create another spec
- overwrite an existing spec
- create a new branch

## If a specification already exists

Warn the user:

"A specification already exists for this roadmap step."

Provide the existing specification path if available.

Do not overwrite it.

Do not create a duplicate branch.

STOP unless the user explicitly asks to update the existing specification.

---

# Step 6 — Analyze feature dependencies

Determine which previous features are required for the requested feature.

Consider relevant Ride Booking System dependencies such as:

- user registration
- authentication
- user roles
- rider profile
- driver profile
- driver verification
- vehicle management
- ride creation
- ride request
- driver matching
- driver acceptance
- ride status
- location tracking
- fare calculation
- payment
- cancellation
- ride history
- ratings and reviews
- notifications
- admin management

Only identify dependencies supported by the existing roadmap and codebase.

Do not invent dependencies.

For each dependency, explain why it is required.

---

# Step 7 — Analyze the business workflow

Before writing the specification, understand the feature as a business/domain workflow.

For a Ride Booking feature, consider:

- who initiates the action
- who receives the action
- what state the entity is currently in
- what state it should transition to
- who is allowed to perform the transition
- what database records are affected
- what validations are required
- what happens when the operation fails
- whether concurrent requests can cause conflicts
- whether another user must be notified
- whether the frontend requires new API information

For stateful entities such as rides, explicitly consider valid and invalid state transitions.

Example:

```text
REQUESTED
    ↓
ACCEPTED
    ↓
DRIVER_ARRIVING
    ↓
IN_PROGRESS
    ↓
COMPLETED
