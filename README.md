# kewldashboard

Chad and Nick's LCARS-inspired command dashboard: weather, traffic, markets, and RSS headlines for your chosen location.

## Screenshot

![Kewl Dashboard — overview with station time, weather, markets, masthead bar, and location controls.](docs/dashboard-screenshot.png)

## Prerequisites

- [Git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/) **20.x or newer** (includes `npm`; matches current Next.js toolchains)

## Local installation

Clone the repo, install dependencies, and start the dev server:

```bash
git clone https://github.com/lahmanbrownproductions/kewldashboard.git
cd kewldashboard
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build locally

```bash
npm install
npm run build
npm start
```

The app listens on port **3000** by default (`next start`). Use `npx next start -p <port>` if you need another port.

### Typecheck only

```bash
npm install
npm run typecheck
```

No `.env` file is required for a basic checkout; APIs use server-side fetching to public endpoints. If you fork the repo under your own GitHub account, substitute your clone URL in the `git clone` step (`https://github.com/<you>/kewldashboard.git` or SSH `git@github.com:<you>/kewldashboard.git`).
