# Fabric Infinity Full Stack (Production-Style)

## What is implemented

- Frontend storefront + owner dashboard in one UI
- Backend APIs with:
  - MongoDB persistence (products, orders, users)
  - JWT authentication for owner dashboard
  - Product CRUD (add, edit, delete)
  - Order management table + status updates
  - Cart -> checkout -> order placement
  - Razorpay order creation + payment verification
  - Shipping integration hooks (Delhivery-style API call)

## Folder structure

- `frontend/index.html`
- `frontend/assets/*`
- `backend/src/server.js`
- `backend/src/models/*`
- `backend/src/middleware/*`
- `backend/src/services/*`
- `backend/.env.example`

## MongoDB

Yes, MongoDB has a free tier via MongoDB Atlas (`M0` free cluster).

Use connection string in:

`MONGODB_URI=...`


password =fabric-Infinity**787
## Setup

1. Open terminal in:
   `fabric-infinity-fullstack/backend`

2. Install dependencies:
   `npm install`

3. Create `.env` from `.env.example` and fill values:

- `MONGODB_URI` (Atlas/local)
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- Optional shipping:
  - `DELHIVERY_BASE_URL`
  - `DELHIVERY_TOKEN`

4. Start backend:
   `npm start`

5. Open app:
   `http://localhost:3000`

## Owner login

Owner now logs in with email/password (JWT based), not frontend hardcoded password.

## Payments

- Razorpay integrated via server-side order creation + signature verification
- Payment method options:
  - `COD`
  - `RAZORPAY`

## Shipping

- Shipping payload integration is coded in `backend/src/services/shipping.js`
- If Delhivery env values are not configured, order still works and shipping status is set to `NOT_CONFIGURED`

## Important security note

Your test Razorpay keys were shared in chat. For safety, rotate test secret if reused elsewhere, and keep real/live keys only in `.env` (never in frontend).
