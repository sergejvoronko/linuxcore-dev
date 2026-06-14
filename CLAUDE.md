# linuxcore-dev — Project Handover

Tech blog linuxcore.dev. Astro v6 on **Cloudflare Worker** (NOT Pages).

## Stack & commands
- Build: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
- Deploy: `npm run deploy` (uses `dist/server/wrangler.json`)
- Env access (Astro v6 / Workers): `import { env } from 'cloudflare:workers'`

## Notes
- `/home/sergej/Downloads/linuxcore-dev_backup/` and `/home/sergej/Downloads/linuxcore/` are old copies — work only in `linuxcore-dev`
