create extension if not exists pgcrypto;

create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  start_url text not null,
  status text not null check (status in ('queued','running','completed','failed','cancelled')),
  max_pages integer not null check (max_pages between 1 and 500),
  pages_crawled integer not null default 0,
  score integer check (score between 0 and 100),
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create table if not exists audit_pages (
  id bigserial primary key,
  audit_id uuid not null references audits(id) on delete cascade,
  url text not null,
  final_url text not null,
  depth integer not null,
  status_code integer not null,
  content_type text not null,
  response_ms integer not null,
  bytes integer not null,
  title text, description text, canonical text, robots text, lang text,
  h1_count integer not null default 0,
  h2_count integer not null default 0,
  word_count integer not null default 0,
  internal_links integer not null default 0,
  external_links integer not null default 0,
  created_at timestamptz not null default now(),
  unique(audit_id,url)
);
create table if not exists audit_issues (
  id bigserial primary key,
  audit_id uuid not null references audits(id) on delete cascade,
  page_id bigint not null references audit_pages(id) on delete cascade,
  code text not null,
  severity text not null check(severity in ('critical','high','medium','low','info')),
  message text not null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists audit_links (
  audit_id uuid not null references audits(id) on delete cascade,
  source_url text not null,
  target_url text not null,
  is_internal boolean not null,
  primary key(audit_id,source_url,target_url)
);
create index if not exists idx_pages_audit on audit_pages(audit_id);
create index if not exists idx_issues_audit_severity on audit_issues(audit_id,severity);
create index if not exists idx_links_target on audit_links(audit_id,target_url);

alter table audits enable row level security;
alter table audit_pages enable row level security;
alter table audit_issues enable row level security;
alter table audit_links enable row level security;
