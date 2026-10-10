# Trumpet Trainer

Practice with generated exercises and live feedback: the app listens through your
microphone and scores each note for pitch and rhythm.

| Folder               | What's in it                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [`client/`](client/) | React + Vite frontend. **[Read the client README](client/README.md)** for the folder structure and design system. |
| [`server/`](server/) | Express API with Postgres (Prisma) and Firebase auth.                                                             |

## Running locally

```sh
npm install && npm install --prefix client && npm install --prefix server
cp client/.env.example client/.env   # Firebase keys + VITE_API_URL
cp server/.env.example server/.env   # database URL + Firebase service account
npm run db:up                        # local Postgres in Docker, with migrations
npm run dev                          # client and server together
```

`npm run db:down` stops the database.
