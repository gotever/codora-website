# React + TypeScript + Vite

## Codora local setup

From this directory run `npm ci` and `npm run dev`. Vite proxies `/api` to `http://localhost:3001`; when using another API origin, set `VITE_API_URL` in the frontend environment. The backend must allow the frontend's exact origin through `FRONTEND_ORIGIN` and enable cookies with its existing credentialed CORS configuration.

Login and registration are at `/login` and `/register`. Authentication uses the backend's HTTP-only cookie and `GET /api/auth/me` for session restoration. Registration accepts a 1–160 character full name, valid email, 3–64 character username matching `[a-zA-Z0-9_.-]+`, and 12–128 character password. Run the API using the instructions in `../backend/README.md`.

The lesson and exercise AI tutors call the authenticated backend `/api/tutor/chat` endpoint. The OpenAI key stays in `backend/.env`; migration 006 adds context-scoped chat memory. The tutor sees the learner's level, current lesson/exercise, code and recent execution/submission state, the latest eight messages, a summary of older messages capped at 500 characters, and structured learning memory.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
