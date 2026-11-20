# Trumpet Trainer

Practice with generated exercises and live feedback: the app listens through your
microphone and scores each note for pitch and rhythm.

Built using Typescript + React frontend (ChakraUI component library), Node.js/Express + PostgreSQL (Prisma) + Firebase Auth backend.
### 1. Generate
<img width="1728" height="895" alt="image" src="https://github.com/user-attachments/assets/7b21850d-f6aa-47d9-9a2b-066af07918ec" />

### 2. Listen
<img width="1727" height="901" alt="image" src="https://github.com/user-attachments/assets/53c92dff-ae8f-43fb-85d2-81e2b9bcb77f" />

### 3. Play
<img width="1726" height="901" alt="image" src="https://github.com/user-attachments/assets/f6541b68-8e32-46bb-9f69-d54582a16fae" />

### 4. Get Feedback
<img width="896" height="791" alt="image" src="https://github.com/user-attachments/assets/4e685206-d2ff-4272-a40c-49a858df9e64" />



| Folder               | What's in it                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [`client/`](client/) | React + Vite frontend.                                                                                               |
| [`server/`](server/) | Express API with Postgres (Prisma) and Firebase auth.                                                                |

## Running locally

```sh
npm install && npm install --prefix client && npm install --prefix server
cp client/.env.example client/.env   # Firebase keys + VITE_API_URL
cp server/.env.example server/.env   # database URL + Firebase service account
npm run db:up                        # local Postgres in Docker, with migrations
npm run dev                          # client and server together
```

`npm run db:down` stops the database.
