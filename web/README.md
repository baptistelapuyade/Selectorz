# Selectorz Web-App

Next.js 16 (App Router, TypeScript, Tailwind 4), Supabase (EU, Frankfurt), Deployment auf Vercel.

## Lokal starten

```bash
cd web
npm install
cp .env.example .env.local   # Werte aus Supabase eintragen
npm run dev                  # http://localhost:3000
```

## Aufbau

- `src/app/globals.css` – Design-Tokens (Projekt-Doc „Design-System v0.1“), Looks `data-look="day|night"`
- `src/app/layout.tsx` – Schriften Inter Tight und Geist Mono, selbst ausgeliefert (Fontsource, OFL 1.1)
- `src/lib/supabase/` – Supabase für Browser, Server und Proxy (`@supabase/ssr`)
- `src/proxy.ts` – erneuert die Anmeldung bei jedem Request (in Next 16 heißt Middleware „Proxy“)

## Vercel

Root Directory: `web`. Umgebungsvariablen wie in `.env.example`.
