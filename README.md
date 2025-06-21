<img src="./assets/logo.svg" alt="watchtower logo" width="100">

# watchtower

open-source Discord moderation bot that actually doesn't suck—powerful, privacy-friendly, and stays out of your way

**[learn more & invite →](https://wtbot.pages.dev/)**

## features

- spam detection with Perspective
- toxicity, hate speech and nsfw image detection with OpenAI
- message rate-limiting using token buckets
- duplicate message prevention
- self-harm detection
- whitelisting
- custom blocklists
- privacy-friendly

## requirements

- **openai api key** for handling moderation requests. these are free, no credit card or billing required. set this as `OPENAI_API_KEY` in your _.env_ (main filtering)

- **google cloud project** with [**perspective api** enabled](https://developers.perspectiveapi.com/s/docs-get-started?language=en_US) (used for spam filtering and as a fallback)

  you'll need to create an API key [here](https://console.developers.google.com/apis/credentials) and add it to your `.env` as `GOOGLE_API_KEY`. restricting it to "Perspective Comment Analyzer API" is optional but recommended.

- [**discord** bot](https://discord.com/developers/applications) token and client ID

- [**bun** runtime](https://bun.sh) installed

## running

to install dependencies:

```bash
bun install
```

to run:

```bash
bun run start
```

## faq

### why openai moderations instead of, for example, perspective?

perspective has an extremely high false positive rate and isn't as flexible. it's still used for spam detection tho since their spam filters are actually pretty good.

### why this instead of wick?

while wick is kind of decent-ish, it's closed-source, owned by a sketchy company, not that privacy, and also not that good.

### why not use discord's built-in moderation?

discord's built-in moderation is very much lacking and is missing a lot of features.

## roadmap

- [ ] cleanup command

---

this project was created with [Bun](https://bun.sh), a fast all-in-one JavaScript runtime.
