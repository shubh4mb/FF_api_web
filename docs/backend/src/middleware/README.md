# Backend/src/middleware/

| File | What |
|---|---|
| `jwtAuth.js` | verifies the customer JWT → `req.userId`. Also exports the merchant and rider middlewares used across the route files (`authMiddlewareMerchant` → `req.merchantId`, `authMiddlewareRider` → `req.riderId`) |
| `adminAuth.middleware.js` | verifies the admin JWT → `req.adminId` |
| `error.middleware.js` | the terminal error handler; maps `ApiError` to a response |
| `multer.js` | multipart upload handling before Cloudinary |
| `nearbyMerchants.middleware.js` | resolves merchants near the request's location for customer browsing |

## Gotchas

- **Authorisation is per-route and hand-attached.** A route added without its middleware is silently public.
  Pair every new route with an authorisation integration test.
- These middlewares set identity on `req`. Controllers read it from there and **never** from the body or
  query — see [../../../ecosystem/PRINCIPLES.md](../../../ecosystem/PRINCIPLES.md) principle 3.
- **None of this applies to Socket.IO**, which has no authentication at all
  ([../sockets/README.md](../sockets/README.md)).
- `express-rate-limit` and `helmet` are applied globally in `src/app.js`, not here.
