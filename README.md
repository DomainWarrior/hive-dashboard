# hive-dashboard

A real-time, single-page dashboard for any Hive blockchain account. No backend, no build step — just open `index.html`.

**Live data from [api.hive.blog](https://api.hive.blog):**

- HIVE, HBD, and Hive Power balances
- Voting power with colour-coded progress bar
- Follower / following / post counts
- Up to 9 most recent posts with payout values
- Works for any Hive account — search by username or share via `?user=username`

---

## Quick start

```bash
git clone https://github.com/DomainWarrior/hive-dashboard.git
cd hive-dashboard
# Open in browser — no server needed for basic use
open index.html
```

Or serve locally (avoids any CORS edge cases):

```bash
python -m http.server 8000
# → http://localhost:8000
```

## URL parameter

Share a pre-loaded view:

```
index.html?user=missquibble
```

## Stack

| Layer    | Tech                                  |
|----------|---------------------------------------|
| UI       | Vanilla HTML / CSS                    |
| Logic    | Vanilla JavaScript (ES2022, no deps)  |
| Data     | Hive JSON-RPC API (`api.hive.blog`)   |
| Fonts    | Inter + JetBrains Mono (Google Fonts) |

Zero npm, zero build tools, zero dependencies.

---

## Author

**MissQuibble** · [missquibble.com](https://missquibble.com) · [@missquibble on Hive](https://ecency.com/@missquibble)
