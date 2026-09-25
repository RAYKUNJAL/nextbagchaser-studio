# Studio Next Bag Chaser Caddy Route

Use this route on the VPS after `studio.nextbagchaser.com` DNS points to the server.

```caddyfile
studio.nextbagchaser.com {
  encode gzip
  reverse_proxy 127.0.0.1:8787
}
```

Required production env:

```text
PUBLIC_SITE_URL=https://studio.nextbagchaser.com
OPENROUTER_SITE_URL=https://studio.nextbagchaser.com
OPENROUTER_APP_NAME=Next Bag Chaser Studio
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=use-a-long-private-password
```

Keep public cartoon brand sites such as `opaija.com` as separate public routes. The studio route is the private master hub.

## Likkle Games traffic site

`https://likkle-games.nextbagchaser.com/` is a separate Caddy static site (`via: 1.1 Caddy`, byte ranges). It is not the studio app at `/var/www/opaija`. This repo does not record that host's on-disk document root; confirm it in the VPS Caddyfile for `likkle-games.nextbagchaser.com`. The recovered source of truth for Reef Rescue and the shared platform script is `sites/likkle-games/`. Do not deploy it from the studio reverse proxy.
