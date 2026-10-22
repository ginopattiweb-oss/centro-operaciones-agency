-- Lo que drizzle no expresa en el esquema: CHECKs, índices parciales y de
-- trigramas, y los triggers de `updated_at`.

-- ── CRM ──
ALTER TABLE "crm_unidades" ADD CONSTRAINT "crm_unidades_clave_no_vacia" CHECK (btrim("clave") <> '');--> statement-breakpoint
-- Derivar exige estado inicial, y un estado inicial sin unidad no significa nada.
ALTER TABLE "crm_importaciones" ADD CONSTRAINT "crm_importaciones_destino_coherente" CHECK (
	("derivar_a_project_id" IS NULL) = ("estado_inicial" IS NULL)
);--> statement-breakpoint
-- Una fila sin ninguna forma de contactar a la persona no es un contacto.
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_tiene_canal" CHECK (
	"email" IS NOT NULL
	OR "telefono_e164" IS NOT NULL
	OR "telefono_crudo" IS NOT NULL
	OR "instagram" IS NOT NULL
	OR "sitio_web" IS NOT NULL
);--> statement-breakpoint
-- Un número guardado crudo es el que NO se pudo normalizar.
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_un_solo_telefono" CHECK (
	"telefono_e164" IS NULL OR "telefono_crudo" IS NULL
);--> statement-breakpoint
-- E.164: '+', dígito 1-9, y entre 8 y 15 dígitos en total.
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_telefono_e164" CHECK (
	"telefono_e164" IS NULL OR "telefono_e164" ~ '^\+[1-9][0-9]{7,14}$'
);--> statement-breakpoint
-- Una baja siempre tiene fecha: es el respaldo de por qué no se le escribe más.
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_baja_con_fecha" CHECK (
	"suscripto" OR "baja_at" IS NOT NULL
);--> statement-breakpoint
-- No hay opt-in de WhatsApp sin número ni sin fecha.
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_opt_in_coherente" CHECK (
	NOT "whatsapp_opt_in"
	OR ("telefono_e164" IS NOT NULL AND "whatsapp_opt_in_at" IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "crm_derivaciones" ADD CONSTRAINT "crm_derivaciones_estado_no_vacio" CHECK (btrim("estado") <> '');--> statement-breakpoint

-- Únicos PARCIALES: dos filas pueden tener email NULL, pero no el mismo email.
CREATE UNIQUE INDEX "crm_contactos_email_uk" ON "crm_contactos" USING btree ("email") WHERE "email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_contactos_telefono_uk" ON "crm_contactos" USING btree ("telefono_e164") WHERE "telefono_e164" IS NOT NULL;--> statement-breakpoint
-- Trigram para el buscador: nombre y email con ILIKE '%texto%' usan estos.
CREATE INDEX "crm_contactos_nombre_trgm_idx" ON "crm_contactos" USING gin ("nombre" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "crm_contactos_email_trgm_idx" ON "crm_contactos" USING gin (("email"::text) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "crm_contactos_telefono_trgm_idx" ON "crm_contactos" USING gin ("telefono_e164" gin_trgm_ops);--> statement-breakpoint

-- ── updated_at por trigger ──
-- Y no desde la app: el importador escribe en lotes y por UPSERT, donde es
-- fácil olvidarse de tocar la fecha en alguna rama.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER crm_contactos_set_updated_at BEFORE UPDATE ON "crm_contactos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER crm_derivaciones_set_updated_at BEFORE UPDATE ON "crm_derivaciones" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER tiktok_accounts_set_updated_at BEFORE UPDATE ON "tiktok_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER tiktok_videos_set_updated_at BEFORE UPDATE ON "tiktok_videos" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER instagram_accounts_set_updated_at BEFORE UPDATE ON "instagram_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER content_ideas_set_updated_at BEFORE UPDATE ON "content_ideas" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER meta_connections_set_updated_at BEFORE UPDATE ON "meta_connections" FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER inspiration_accounts_set_updated_at BEFORE UPDATE ON "inspiration_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
