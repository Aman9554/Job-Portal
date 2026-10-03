# Backend

## Run locally

Create a private `backend/.env` file with these settings for local development. The database account and the editor account are separate; use a unique editor password:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/gov-job-portal
ADMIN_USERNAME=your-editor-username
ADMIN_PASSWORD=your-long-unique-editor-password
ADMIN_TOKEN_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:5173
```

Generate a token secret in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Keep `.env` private and out of source control. The server will not start if the database URI, editor credentials, or a token secret of at least 32 characters is missing. `backend/.env.example` is a safe template.

From this directory, install dependencies with `npm install`, start the API with `npm start`, and run its HTTP-level tests with `npm test`. Use `npm run dev` for automatic restarts during development.

The Vite development server proxies `/api` to `http://127.0.0.1:5000`. In production, the Express server serves the built frontend and API from the same origin. `VITE_API_URL` is only needed when hosting the frontend separately.

## Deploy on Render

The repository includes a `render.yaml` Blueprint for a single Node web service. Push the project to a GitHub repository, create a new Blueprint in Render, and connect that repository. In Render's Blueprint setup, provide `MONGO_URI`, `ADMIN_USERNAME`, and a new `ADMIN_PASSWORD`; the token signing secret is generated for the service. Deploy, then open the generated `onrender.com` URL. The same URL serves the website and `/api/test`.

Before making the service public, rotate any MongoDB credential that has been shared outside the private environment file, update the Atlas database user's password and network access, then enter the new URI directly into Render's secret environment field. Do not commit `.env` files or paste production credentials into chat or source code.

## API

- `GET /api/test` — API and database status.
- `GET /api/jobs` — vacancies in newest-first order. Optional query parameters: `search`, `department`, `location`, `status=all|active|expired`. Add `page` and `limit` (1–100) for paginated results; the existing `data` array remains unchanged and pagination details are returned separately.
- `GET /api/jobs/:id` — one vacancy.
- `GET /api/stats` — vacancy and department totals.
- `POST /api/login` — returns an expiring editor token when configured credentials match.
- `POST /api/jobs`, `PUT /api/jobs/:id`, `DELETE /api/jobs/:id` — editor-only vacancy changes; send `Authorization: Bearer <token>`.

Set `CORS_ORIGIN` to a comma-separated list of exact frontend origins when deploying. The local default permits `localhost` and `127.0.0.1` on Vite's development port.
