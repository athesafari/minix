# Mini Twitter Clone (React + MSW + Supabase) — Ready for Vercel

A tiny Twitter-like UI with:
- **MSW** mocking the Twitter API endpoint `GET https://api.twitter.com/2/users/:id/tweets`
- **React + Vite** front-end
- **Supabase** persistence (free tier) for users, posts, comments
- **Vercel**-ready serverless functions under `/api`

## Quick Start (Local)

```bash
npm install
# This also runs: npx msw init public --save  (to place mockServiceWorker.js)
npm run dev
```

Open http://localhost:5173

## API Contract used by the UI

- `POST /api/login` → { user }
- `GET /api/posts` → { posts }
- `GET /api/posts?userId=...` → filter by user_id
- `POST /api/posts` → body: { username, text }
- `POST /api/comments` → body: { postId, username, text }

MSW handler proxies the Twitter endpoint to our API:
- `GET https://api.twitter.com/2/users/:id/tweets?...` returns a shaped response from persisted posts.

## Supabase Setup

1. Create a project on https://supabase.com (free tier)
2. In the SQL editor, run:

```sql
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  created_at timestamp with time zone default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  text text not null,
  created_at timestamp with time zone default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  text text not null,
  created_at timestamp with time zone default now()
);

-- helpful views for joins (optional)
create view posts_with_rel as
select p.*, u.username from posts p left join users u on u.id = p.user_id;

create view comments_with_rel as
select c.*, u.username from comments c left join users u on u.id = c.user_id;
```

3. (For demo) enable RLS (default) and allow open access with permissive policies.
   **Warning:** This is for mock/demo only.

```sql
alter table users enable row level security;
alter table posts enable row level security;
alter table comments enable row level security;

create policy "allow all users read/write users" on users
for all using (true) with check (true);

create policy "allow all users read/write posts" on posts
for all using (true) with check (true);

create policy "allow all users read/write comments" on comments
for all using (true) with check (true);
```

4. Grab your **Project URL** and **Anon Key** and fill `.env.local` (or use Vercel env):
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
```

## Deploy to Vercel

1. Push this repo to GitHub (or import it directly)
2. On Vercel, **Import Project** → select this repo
3. Set **Environment Variables** in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy. The static app is built from Vite, and serverless functions in `/api` will handle persistence.

## Notes

- **MSW** needs the file `public/mockServiceWorker.js`. This project runs `msw init public --save` in `postinstall`. If you see a 404 for `/mockServiceWorker.js`, run:
  ```bash
  npx msw init public --save
  ```

- The Twitter endpoint you can test:
  ```bash
  curl 'https://api.twitter.com/2/users/1099090400172634113/tweets?exclude=replies,retweets&tweet.fields=id,text,created_at,public_metrics,conversation_id'
  ```
  …from your browser console or app code — it will be intercepted by MSW and shaped from persisted posts.

## Dev Tips

- To seed data, login as a username then create a few posts; they are stored in Supabase and survive reloads/sessions.
- The UI is intentionally minimal, styled slightly like Twitter.
