# RageReport landing page

A static Astro page for `https://ragereport.potion.sh`, with Tailwind CSS and shadcn React components. Fonts are self-hosted. Only the command tabs and copy buttons hydrate; the page has no analytics, sign-up form, or history upload.

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build:landing
pnpm preview
pnpm check
```

`pnpm dev` builds the CLI dependency before starting Astro. `pnpm build:landing` builds the CLI first, writes the website to `apps/landing/dist`. `pnpm preview` serves that production build locally.

## Editing

- `src/config/site.ts` contains links, command examples, features, and FAQs.
- `src/utils/cli-help.ts` runs the built CLI’s `--help` during the static build. It never reads local histories.
- `src/layouts/Page.astro` owns metadata, fonts, and global styles.
- `src/components/ui` contains the checked-in shadcn Button and Tabs from the official `new-york-v4` registry. `components.json` defines aliases and styling for future components.
- Shared styles live in `src/styles`; keep responsive overrides last in the import order.

Oxlint checks TypeScript, React, and scripts, including React and accessibility rules. ESLint with `eslint-plugin-astro` checks Astro templates and accessibility. Oxfmt formats supported files; Prettier with `prettier-plugin-astro` handles `.astro` files. The [OXC compatibility matrix](https://oxc.rs/compatibility.html) does not provide full Astro template linting or Astro formatting.

The CLI is published as [`ragereport`](https://www.npmjs.com/package/ragereport). Keep install commands consistent with the published CLI. The landing page contains no dummy metrics, synthetic report previews, or private history.

## Dependency selection

Direct dependencies use exact versions, and pnpm enforces a two-day minimum release age for newly resolved packages. Releases checked on 07 Oct 2026:

| Package                 | Selected | Newer release excluded because it is under two days old |
| ----------------------- | -------- | ------------------------------------------------------- |
| Astro                   | 7.3.5    | 7.3.6                                                   |
| Astro React integration | 7.0.0    | 7.0.1                                                   |
| Radix UI                | 1.6.7    | 1.7.0                                                   |

The landing page uses TypeScript 6.0.3 because Astro Check and its ESLint parser currently support TypeScript through version 6. The CLI retains TypeScript 7.0.2. React 19.3.0 and Tailwind CSS 4.3.3 are the latest eligible stable releases. No extra shared package is needed.

## Deploying to Vercel

Create a Vercel project for this repository when ready to deploy. Use:

| Setting                                         | Value          |
| ----------------------------------------------- | -------------- |
| Root Directory                                  | `apps/landing` |
| Framework                                       | Astro          |
| Node.js                                         | 24.x           |
| Include source files outside the Root Directory | Enabled        |
| Output Directory                                | `dist`         |

The app’s `vercel.json` installs pinned pnpm 12.9.1 and runs the landing build from the workspace root. This also builds the CLI needed to generate its real help preview. These settings follow [Vercel’s Turborepo guidance](https://vercel.com/docs/monorepos/turborepo).

Add `ragereport.potion.sh` under the Vercel project’s Domains settings, then apply the DNS record Vercel supplies. No runtime adapter, environment variables, database, or secret is required for this static site. The canonical URL lives in `src/config/site.ts`; change it there if the production domain changes.

The Vercel project is `ragereport` under `pankajsanam`, connected to `antick/ragereport` on `main`. Set DNS records using the exact target supplied by that project.
