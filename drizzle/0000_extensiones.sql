-- Extensiones que el esquema necesita ANTES de crear las tablas.
-- `citext`: mail insensible a mayúsculas en el CRM.
-- `pg_trgm`: búsqueda por nombre/mail/teléfono del CRM sin seq scan.
CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
