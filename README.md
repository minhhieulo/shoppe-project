# Shoppe Fullstack Clone

Production-ready starter for a Shopee-like e-commerce system (User + Admin), built with React/Vite/Tailwind + Node/Express/MySQL + Socket.io.
Phase 2 includes Shopee-style header/search UX, Framer Motion animations, Yup validation, search suggestion/history, and refresh-token rotation.

## 1) Tech Stack

- Frontend: React 18, Vite, TailwindCSS, Axios, React Router, React Hook Form + Yup, Zustand, Chart.js/Recharts, Socket.io client, Framer Motion
- Backend: Node.js, Express, MySQL, JWT, bcryptjs, multer, Socket.io, dotenv, cors
- Architecture: REST API + MVC backend pattern + reusable React components

## 2) Project Structure

```bash
frontend/
  src/components
  src/pages
  src/services
  src/store
backend/
  src/controllers
  src/models
  src/routes
  src/middleware
  src/config
database/
  01_schema.sql
  02_migration.sql
  03_seed.sql
```

## 3) Setup MySQL

Run SQL files in order:

1. `database/01_schema.sql`
2. `database/02_migration.sql` (includes `refresh_tokens` table)
3. `database/03_seed.sql`

## 4) Environment

### Backend

```bash
cp backend/.env.example backend/.env
```

Update DB credentials in `backend/.env`.

### Frontend

```bash
cp frontend/.env.example frontend/.env
```

## 5) Install & Run

```bash
npm run install:all
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## 6) Seed Accounts

- Admin: `admin@shoppe.vn` / `123456`
- Staff: `staff@shoppe.vn` / `123456`
- User: `user@shoppe.vn` / `123456`

## 7) API Included

- Auth: register/login/refresh/me
- Product/Category: list/detail/filter/sort + admin CRUD
- Search: debounce + suggestion dropdown + user search history
- Cart/Wishlist/Order/Notification/Profile/Review
- Payment mock webhook/session/status + refresh token rotation/logout
- Admin dashboard stats/revenue/payments/users/vouchers/flash sale
- Admin panel FINAL: dashboard + products/categories/orders/users/vouchers/flash-sales/payments management tabs
- Chat realtime socket

## 8) Notes

- This codebase is fully runnable after dependency install and MySQL init.
- Payment gateways are sandbox-mocked in this starter and can be replaced with official SDK integrations.
