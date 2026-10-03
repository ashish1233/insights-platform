# Web template — frontend

The frontend half of the `templates/web/` scaffold (ADR-1). A team copies this
into their own repository once and then owns it; the platform team owns
`@insights-platform/ui-kit`, which this consumes.

It is a login screen, one page of rows, and a sign-out button. That is the whole
app, on purpose — a scaffold that does more is a scaffold whose extra parts every
team has to read and delete.

## Fill these in

Everything is marked `TODO(template)`:

```sh
grep -rn "TODO(template)" src index.html
```

| Where | What |
| --- | --- |
| `src/config.ts` | `APP_NAME`, `APP_DESCRIPTION`, `TENANT_ID`, `SCOPES`, `DATASET_LABEL` |
| `src/InsightsPage.tsx` | the table columns, and the card title |
| `index.html` | the page `<title>` |
| `package.json` | the package `name` |

`TENANT_ID` only pre-fills the sign-in form. It is not a security control — the
backend takes the tenant from the token, never from the frontend.

Ask for the narrowest `SCOPES` that work. `insights:read` is enough unless your
tenant is on the restricted tier.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

The backend is expected at `http://localhost:8000` and the identity stub at
`http://localhost:8081`. Override with `VITE_API_BASE_URL` and
`VITE_IDENTITY_BASE_URL` — see `.env.example`.

```sh
npm run build      # tsc --noEmit, then a production bundle in dist/
npm run typecheck
```

## How it is wired

```
main.tsx          root, imports the ui-kit stylesheet
└── App.tsx       owns the session; picks LoginPanel or AppShell
    └── InsightsPage.tsx   the one page
```

Three hooks from the kit do the talking:

- `useAuth` — `POST /token/user` on the identity service, token in
  `localStorage`.
- `useHealth` — `GET /health`, for the tenant and tier in the header. Tier comes
  from the backend rather than from `config.ts` because ADR-2 makes it a property
  of the tenant, and a frontend constant could disagree with reality.
- `useInsights` — `GET /api/insights` with the bearer token.

**An expired session is a real state here, not an afterthought.** A 401 from
`/api/insights` ends the session and returns the user to the sign-in screen with
"Session expired — your session timed out. Sign in again to continue." — rather
than leaving a blank page or a generic error behind.

## Where to grow

- Another page: add a component beside `InsightsPage` and a router. The scaffold
  ships without one because most of these apps are a single page and an unused
  router is a dependency to upgrade for nothing.
- Another endpoint: write a hook beside the kit's. Move it into the kit only if a
  second team needs it.
- A component the kit lacks: build it locally first. The kit stays small
  deliberately — see its README.

## What is not here

No router, no state-management library, no test setup, no component library.
Add what you need; nothing has been pre-chosen for you beyond React, TypeScript,
Vite and the kit.
