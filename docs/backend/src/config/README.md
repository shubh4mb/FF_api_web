# Backend/src/config/

Infrastructure wiring. No business logic.

| File | What | Notes |
|---|---|---|
| `db.js` | `connectDB()` — Mongoose connection to MongoDB Atlas | called first in `index.js` |
| `socket.js` | `setIO()` / `getIO()` | a module-level holder so other files can emit without a circular import |
| `cors.js` | `allowedOrigins` | used by the Express CORS middleware — **but not by Socket.IO**, which uses `origin: "*"` (finding S5) |
| `redisConfig.js` | Redis client | `@upstash/redis` + `redis`; merchant online state, session metadata |
| `RazorPay.js` | Razorpay SDK | prepaid courier orders, merchant registration fee, trial QR collection |
| `cloudinary.config.js` | Cloudinary SDK | all media |
| `swagger.js` | `swagger-jsdoc` + `swagger-ui-express` | collects the JSDoc annotations in the route files |

## Gotchas

- **`cors.js` has an allowlist; the Socket.IO server ignores it** and accepts any origin. One source for
  that fact would be better — pass `allowedOrigins` into the `Server` options.
- `@socket.io/redis-adapter` is a dependency but is **not** wired up here or in `index.js`, which is why the
  service is single-instance only.
- Environment variables are read via `dotenv` at the top of `index.js`. There is no schema validation of
  config — a missing variable surfaces as a runtime failure rather than a startup one. Principle 6
  ("fail closed") argues for validating at boot.
