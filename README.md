# thuttu

sample code

A static deals site built with [Astro](https://astro.build). The MVP is the home page, with sample data in `src/data/deals.json`.

## Develop

```sh
npm install
npm run dev      # http://localhost:4321/thuttu/
npm run build    # outputs to dist/
```

## Edit content

- `src/data/site.json`: site name, tagline, banner text
- `src/data/deals.json`: deals shown on the home page
- `src/data/discover.json`: "Discover more" tags and sidebar links

## Deploy

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
In the repo settings, set **Pages → Source** to **GitHub Actions**.
