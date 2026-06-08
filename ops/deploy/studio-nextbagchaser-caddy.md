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
