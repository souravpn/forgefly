alter table businesses
  add column if not exists getting_started_dismissed boolean not null default false;
