# AGENTS.md — Portfolio

## Commands

| Action | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` (runs `tsc -b && vite build`) |
| Lint | `npm run lint` |
| Preview build | `npm run preview` |

## Notable quirks

- **No tests.** There is no test framework installed.
- **SASS** for styles (`.scss` files co-located with components).
- **`verbatimModuleSyntax: true`** — must use `import type` for type-only imports.
- **`noUnusedLocals` / `noUnusedParameters`** — both on. Unused vars/params cause build failure.
- **React Compiler** enabled via `babel-plugin-react-compiler` in `vite.config.ts`. Impacts dev/build perf.
- **Navbar filename is `Navar.tsx`** (typo). Component imported as `Navar` in `AppHolder.tsx`. Don't rename without updating the import.
- **Router:** 6 routes — `/`, `/home`, `/about`, `/projects`, `/projects/:projectId`, `/posts`, `/posts/:postId`.

## Architecture

```
src/
  Pages/            # Route-level page components
    Home/, About/, Projects/, ProjectDetail/, Posts/, PostDetail/
  Components/
    AppHolder/      # Layout wrapper (Navar + P5Canvas + Router)
    Navbar/         # Navar.tsx (typo in filename)
    Router/         # Route definitions
    Canvas/         # p5.js animated background
    Markdown/       # Markdown article renderer (marked + highlight.js)
    Breadcrumb/     # Breadcrumb.tsx (unused?)
  content/          # Long-form content for posts AND projects (see Writing posts)
    _TEMPLATE.md         # Article skeleton — copy this, don't write from scratch
    _TEMPLATE.project.md # Same eight sections, mapped to a build log
    frontmatter.ts  # Minimal YAML frontmatter parser
    collection.ts   # Shared glob loading + frontmatter coercion helpers
    posts.ts        # Loads ./posts/*.md via import.meta.glob, sorted by date
    projects.ts     # Loads ./projects/*.md the same way
    types.ts        # PostMeta / Post / ProjectMeta / Project
    posts/*.md      # One file per post
    projects/*.md   # One file per project
  styles/
    article.scss    # Shared chrome for .post-detail / .project-detail (imported by index.scss)
```

- All routes are static, client-side rendered. No SSR, no API calls.
- `p5` renders a canvas background. It is not interactive content.
- **All** post and project data comes from `src/content/`. Nothing is hardcoded in the pages.
  Do not duplicate content back into the components.

## Writing posts and projects

- One markdown file per item, in `src/content/posts/` or `src/content/projects/`. The slug is the
  filename and the URL, so renaming a file breaks a published link.
- Post frontmatter: `title`, `description`, `category`, `tags`, `featured`, `date` (`YYYY-MM-DD`).
  Project frontmatter adds `team` (`Red Team` / `Blue Team`), `timeline`, `githubUrl`, `liveUrl`.
  Types live in `content/types.ts`. `tags` accepts a YAML list or a comma-separated string.
- Both collections use the same eight `##` sections. Articles start from `_TEMPLATE.md`:
  The question → The target model → The surface criteria → The inventory →
  From element to vector → Execution → In plain terms → Carry-over.
  Projects start from `_TEMPLATE.project.md`:
  The problem → The context → The constraints → The components →
  From requirement to design → Implementation → In plain terms → What I'd do differently.
- `##` headings build the article's table of contents automatically, so keep them meaningful.
- Writing rules for these articles:
  - Never a real machine or host. Targets are **fictional specifications**; the transferable
    artifact is the reasoning, not the outcome.
  - Technical layer first, then plain-language layer. Inline explanations go in a blockquote
    starting with `> **Plain terms**` (the renderer lifts that into a labelled callout).
  - Always include candidates that were **rejected**, with the criterion that killed them. In a
    project that means rejected *designs*, with the constraint that killed each.
  - State what could not be proved. A method with stated limits is usable.
- Blockquotes are rendered as the "plain terms" callout. Fenced code blocks are highlighted by
  `highlight.js`; only the languages registered in `Components/Markdown/Markdown.tsx` are available,
  and anything else falls back to `plaintext`.
- The 6 `htb-*` posts and all 8 project pages currently hold their original two-line descriptions.
  They are placeholders pending real write-ups — do not treat them as finished.

## Style conventions

- Terminal/hacker aesthetic. Dark background (`#090909`), monospace (`Courier New`), accent color `#eda8d8` / `#c4a7e7`.
- CSS class naming: `.kebab-case` with BEM-like nesting in SCSS.
- Firefox scrollbar hiding uses `scrollbar-width: none` (or `thin` for filter bars).
- Portfolio positions as "Web Developer → Pentester". Do not add DevSecOps content.