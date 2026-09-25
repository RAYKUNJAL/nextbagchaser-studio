# Likkle Legends games (traffic lead magnet)

Static source for `https://likkle-games.nextbagchaser.com/`, recovered from the live Caddy file server because these files were not in git.

The studio ops docs (`ops/deploy/server-bootstrap.md`, `ops/deploy/studio-nextbagchaser-caddy.md`) only place the Node app at `/var/www/opaija` and reverse-proxy `studio.nextbagchaser.com` to `127.0.0.1:8787`. They do not name the likkle-games document root. On the VPS, read the Caddy site block for `likkle-games.nextbagchaser.com` before copying this folder. Do not deploy from this change.

`games/reef-rescue/` is the Reef Rescue page. `platform.js` is the shared helper for Reef Rescue, Block Carnival, and Island Quiz. Guest levels 1–3 stay playable. `styles.css` is the shared sheet the reef page already links.
