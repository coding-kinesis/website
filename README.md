# OntoWeaver website (local sample)

Static landing page for OntoWeaver.

## Preview locally

From this directory:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080

Or open `index.html` directly in a browser.

## Deploy later (Cloudflare Pages)

1. Put this folder in its own GitHub repo.
2. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build settings: framework preset **None**, output directory `/` (or leave empty for root static files).
4. Attach your custom domain when ready.

No Workers required for this static site.
