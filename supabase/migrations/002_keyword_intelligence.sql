create table if not exists audit_page_keywords (
  audit_id uuid not null references audits(id) on delete cascade,
  page_id bigint not null references audit_pages(id) on delete cascade,
  keyword text not null,
  occurrences integer not null check(occurrences > 0),
  in_title boolean not null default false,
  in_h1 boolean not null default false,
  in_headings boolean not null default false,
  weighted_score numeric not null default 0,
  primary key(audit_id,page_id,keyword)
);
create index if not exists idx_page_keywords_audit_keyword on audit_page_keywords(audit_id,keyword);
alter table audit_page_keywords enable row level security;
