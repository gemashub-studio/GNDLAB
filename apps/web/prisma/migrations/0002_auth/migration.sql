-- 0002_auth — token login magic link (NextAuth Email provider, sesi JWT).
-- Satu-satunya tambahan di luar architecture/03-data/schema.sql (DEC-023).
-- Pengguna tetap memakai tabel app_user (email unik, peran viewer/editor/data_admin).
CREATE TABLE auth_verification_token (
  identifier  text        NOT NULL,
  token       text        NOT NULL,   -- disimpan sebagai hash oleh NextAuth
  expires     timestamptz NOT NULL,
  PRIMARY KEY (identifier, token)
);
CREATE INDEX ix_auth_token_expires ON auth_verification_token (expires);
