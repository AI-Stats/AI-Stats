alter table "user"
  add column "mfaReenrollmentRequired" boolean not null default false;

create index "user_mfaReenrollmentRequired_idx"
  on "user" ("mfaReenrollmentRequired")
  where "mfaReenrollmentRequired" is true;
