-- LoFu schema for Supabase (Postgres).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- The Express API is the only client of these tables. It connects with the
-- service-role key, which bypasses Row Level Security, so RLS is enabled below
-- with no policies: the public anon key can read and write nothing.

create extension if not exists pgcrypto;

-- Keeps updated_at current on every UPDATE (Mongoose `timestamps: true` equivalent).
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── users ──────────────────────────────────────────────────────────────
create table users (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (char_length(full_name) between 2 and 100),
  username        text not null unique check (char_length(username) between 3 and 30),
  email           text not null unique check (email = lower(email)),
  password_hash   text not null,
  avatar          text not null default '',
  role            text not null default 'user' check (role in ('user', 'admin')),
  profile_visible boolean not null default true,
  show_email      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── posts ──────────────────────────────────────────────────────────────
create table posts (
  id                   uuid primary key default gen_random_uuid(),
  author_id            uuid not null references users(id) on delete cascade,
  type                 text not null check (type in ('Lost', 'Found')),
  item_name            text not null,
  category             text not null,
  description          text not null,
  color                text not null default '',
  brand                text not null default '',
  landmark             text not null,
  location_details     text not null default '',
  date_lost_or_found   timestamptz not null,
  incident_time_approx text check (incident_time_approx in ('Morning', 'Afternoon', 'Evening', 'Night')),
  reward_offered       text,
  images               text[] not null default '{}',
  status               text not null default 'Active' check (status in ('Active', 'Claim Pending', 'Resolved')),
  approved_claim_id    uuid,   -- FK added after claims exists (circular reference)
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── claims ─────────────────────────────────────────────────────────────
create table claims (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  claimant_id   uuid not null references users(id) on delete cascade,
  message       text not null,
  proof_details text not null,
  contact_info  text not null default '',
  status        text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (post_id, claimant_id)   -- one claim per user per post
);

alter table posts
  add constraint posts_approved_claim_fk
  foreign key (approved_claim_id) references claims(id) on delete set null;

-- ── conversations ──────────────────────────────────────────────────────
-- post_id / claim_id use SET NULL so chat history survives deleting the post,
-- matching how the Mongo version left conversations behind.
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references posts(id) on delete set null,
  claim_id        uuid references claims(id) on delete set null,
  last_message    text not null default '',
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table conversation_participants (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  primary key (conversation_id, user_id)
);

-- ── messages ───────────────────────────────────────────────────────────
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid references users(id) on delete set null,
  content         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── indexes ────────────────────────────────────────────────────────────
create index posts_feed_idx          on posts (status, type, created_at desc);
create index posts_author_idx        on posts (author_id, created_at desc);
create index claims_post_idx         on claims (post_id);
create index claims_claimant_idx     on claims (claimant_id, created_at desc);
create index participants_user_idx   on conversation_participants (user_id);
create index conversations_post_idx  on conversations (post_id);
create index messages_convo_idx      on messages (conversation_id, created_at);

-- ── updated_at triggers ────────────────────────────────────────────────
create trigger users_updated_at         before update on users         for each row execute function set_updated_at();
create trigger posts_updated_at         before update on posts         for each row execute function set_updated_at();
create trigger claims_updated_at        before update on claims        for each row execute function set_updated_at();
create trigger conversations_updated_at before update on conversations for each row execute function set_updated_at();
create trigger messages_updated_at      before update on messages      for each row execute function set_updated_at();

-- ── Row Level Security: on, with no policies ──────────────────────────
-- Locks out the public anon/authenticated roles. The server's service-role
-- key bypasses RLS, so the Express API keeps working.
alter table users                      enable row level security;
alter table posts                      enable row level security;
alter table claims                     enable row level security;
alter table conversations              enable row level security;
alter table conversation_participants  enable row level security;
alter table messages                   enable row level security;
