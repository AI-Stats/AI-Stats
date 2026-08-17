create table "ssoProvider" (
  "id" text not null primary key,
  "issuer" text not null,
  "oidcConfig" text,
  "samlConfig" text,
  "userId" text references "user" ("id") on delete cascade,
  "providerId" text not null unique,
  "organizationId" text,
  "domain" text not null
);

create index "ssoProvider_userId_idx" on "ssoProvider" ("userId");
