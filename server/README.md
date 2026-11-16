# The meeting point for Fly together

Two browsers that want to talk straight to each other first have to be handed each other's description of how they can be reached. `rooms.js` does that and nothing else. It is a small script that runs on Cloudflare Workers, on the free plan. The site itself stays on GitHub Pages; only Fly together uses this.

It never sees a place, a world or any music: once two browsers are joined they do not use it again. It does see the network address of everyone who invites or joins, because that is what it passes on, and it keeps nothing.

## What it can cost

Nothing, as long as the Cloudflare account is on the free plan. The free plan has daily limits (100,000 requests a day at the time of writing), and past a limit Cloudflare refuses requests until the next day (midnight UTC); it does not charge. The worst that misuse can do is stop Fly together for the rest of that day. Joining two people takes about three requests, and an open invitation costs nothing while nobody joins.

Charges are only possible if the account is moved to the Workers Paid plan. Do not do that for this.

There is no relay here on purpose. A relay would carry the music and is charged by volume. Without one, people on networks that block direct connections cannot join.

## Putting it on your account

You need Node, and a Cloudflare account. In this folder:

```
npx wrangler login      # opens Cloudflare in your browser; press Allow
npx wrangler deploy     # puts rooms.js on your account
```

The first time, Cloudflare may ask you to choose a `workers.dev` name for the account. `deploy` ends by printing the script's address, like

```
https://mirrorfold-rooms.<your-name>.workers.dev
```

Put that address in `TG_ROOMS` near the top of `js/together.js`, and publish the site. Opening the address in a browser should show one line of text.

If the site is served from somewhere other than `https://gcrabtree.github.io`, put its address in `ORIGINS` in `wrangler.toml` first (several with commas between them; no path and no slash at the end). Pages from any other address are refused.

To take it down: `npx wrangler delete`.

## What keeps it small

- Only pages from the addresses in `ORIGINS` may use it. This stops other websites from using it. It does not stop a program that pretends to be the site, which is what the other limits are for.
- One network address may open at most 30 connections a minute. The count is kept by each running copy of the script, so it is rough.
- A guest may send one message, has one minute, and at most six wait in a room at once.
- A room lasts at most twelve hours, and no message may be longer than 12,000 letters.
- A room's code is eight letters and digits made up by the host's page. The host's page also holds a secret key, so that only it can take its room back after a broken connection.

## Checking it

```
npx wrangler dev --port 8799     # a copy on this computer
node server/test.mjs             # in another terminal, from the folder above
node server/test.mjs wss://mirrorfold-rooms.<your-name>.workers.dev   # the same checks against the one on Cloudflare
```
