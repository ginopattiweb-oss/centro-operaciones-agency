CREATE TYPE "public"."access_type" AS ENUM('hosting', 'dominio', 'wordpress', 'ftp', 'base_datos', 'email', 'analytics', 'redes', 'otro');--> statement-breakpoint
CREATE TYPE "public"."agreement_mode" AS ENUM('unico', 'mensual');--> statement-breakpoint
CREATE TYPE "public"."briefing_status" AS ENUM('borrador', 'enviado');--> statement-breakpoint
CREATE TYPE "public"."client_project_status" AS ENUM('briefing', 'diseno', 'desarrollo', 'revision', 'publicado', 'mantenimiento');--> statement-breakpoint
CREATE TYPE "public"."contact_source" AS ENUM('manual', 'gumroad', 'instagram', 'tiktok', 'youtube', 'web', 'referido', 'import', 'formulario_web', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."content_idea_format" AS ENUM('reel', 'carrusel', 'post', 'historia');--> statement-breakpoint
CREATE TYPE "public"."content_idea_status" AS ENUM('idea', 'planificada', 'grabada', 'publicada', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."crm_evento_tipo" AS ENUM('contacto_creado', 'contacto_editado', 'derivacion_creada', 'derivacion_quitada', 'estado_cambiado', 'fusion', 'importacion', 'migracion');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('ARS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."deliverable_kind" AS ENUM('link', 'archivo');--> statement-breakpoint
CREATE TYPE "public"."expense_recurrence" AS ENUM('unico', 'mensual', 'anual');--> statement-breakpoint
CREATE TYPE "public"."instagram_account_status" AS ENUM('conectada', 'token_vencido', 'revocada', 'error');--> statement-breakpoint
CREATE TYPE "public"."lead_currency" AS ENUM('ARS', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."lead_interaction_channel" AS ENUM('email', 'instagram', 'whatsapp', 'llamada', 'reunion', 'otro');--> statement-breakpoint
CREATE TYPE "public"."lead_lost_reason" AS ENUM('precio', 'timing', 'no_responde', 'eligio_otro', 'no_calificaba', 'otro');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('frio', 'referido', 'contenido', 'inbound', 'reactivacion', 'otro', 'formulario_web');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('nuevo', 'contactado', 'en_conversacion', 'cotizado', 'ganado', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('unidad', 'transversal');--> statement-breakpoint
CREATE TYPE "public"."task_location" AS ENUM('hoy', 'bandeja', 'hecha');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('alta', 'normal');--> statement-breakpoint
CREATE TYPE "public"."tiktok_account_status" AS ENUM('conectada', 'token_vencido', 'revocada', 'error');--> statement-breakpoint
CREATE TYPE "public"."video_platform" AS ENUM('instagram', 'tiktok');--> statement-breakpoint
CREATE TABLE "briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"status" "briefing_status" DEFAULT 'borrador' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "briefings_client_project_id_unique" UNIQUE("client_project_id")
);
--> statement-breakpoint
CREATE TABLE "budget_concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_id" uuid,
	"client_project_id" uuid,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"month" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_entries_concept_month" UNIQUE("concept_id","month")
);
--> statement-breakpoint
CREATE TABLE "client_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"type" "access_type" DEFAULT 'otro' NOT NULL,
	"url" text,
	"username" text,
	"secret_cipher" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"project_id" uuid NOT NULL,
	"portal_enabled" boolean DEFAULT false NOT NULL,
	"ga_property_id" text,
	"stats_visible_to_client" boolean DEFAULT false NOT NULL,
	"finance_visible_to_client" boolean DEFAULT false NOT NULL,
	"client_can_upload_payments" boolean DEFAULT false NOT NULL,
	"status" "client_project_status" DEFAULT 'briefing' NOT NULL,
	"service" text,
	"owner_person_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid,
	"batch_id" uuid NOT NULL,
	"brief" text,
	"title" text NOT NULL,
	"format" "content_idea_format" NOT NULL,
	"hook" text NOT NULL,
	"rationale" text NOT NULL,
	"script" jsonb NOT NULL,
	"caption" text,
	"hashtags" text[],
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "content_idea_status" DEFAULT 'idea' NOT NULL,
	"scheduled_for" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext",
	"telefono_e164" text,
	"telefono_crudo" text,
	"nombre" text,
	"instagram" text,
	"sitio_web" text,
	"origen" "contact_source" DEFAULT 'manual' NOT NULL,
	"origen_detalle" text,
	"importacion_id" uuid,
	"suscripto" boolean DEFAULT true NOT NULL,
	"baja_at" timestamp with time zone,
	"baja_motivo" text,
	"consentimiento_at" timestamp with time zone,
	"consentimiento_fuente" text,
	"baja_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"whatsapp_opt_in" boolean DEFAULT false NOT NULL,
	"whatsapp_opt_in_at" timestamp with time zone,
	"whatsapp_opt_in_fuente" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_contactos_baja_token_uk" UNIQUE("baja_token")
);
--> statement-breakpoint
CREATE TABLE "crm_derivaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contacto_id" uuid NOT NULL,
	"unidad_project_id" uuid NOT NULL,
	"estado" text NOT NULL,
	"derivado_at" timestamp with time zone DEFAULT now() NOT NULL,
	"derivado_por" uuid,
	"notas" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_derivaciones_contacto_unidad_uk" UNIQUE("contacto_id","unidad_project_id")
);
--> statement-breakpoint
CREATE TABLE "crm_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contacto_id" uuid NOT NULL,
	"derivacion_id" uuid,
	"tipo" "crm_evento_tipo" NOT NULL,
	"ocurrido_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor" uuid,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_importaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archivo" text NOT NULL,
	"mapeo" jsonb NOT NULL,
	"derivar_a_project_id" uuid,
	"estado_inicial" text,
	"filas_total" integer DEFAULT 0 NOT NULL,
	"filas_creadas" integer DEFAULT 0 NOT NULL,
	"filas_actualizadas" integer DEFAULT 0 NOT NULL,
	"filas_omitidas" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_unidades" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"clave" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_unidades_clave_uk" UNIQUE("clave")
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text NOT NULL,
	"kind" "deliverable_kind" DEFAULT 'link' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"recurrence" "expense_recurrence" DEFAULT 'mensual' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"category" text,
	"project_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspiration_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text,
	"biography" text,
	"avatar_url" text,
	"website" text,
	"followers_count" integer,
	"media_count" integer,
	"median_likes" integer,
	"last_scanned_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspiration_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "inspiration_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"ig_media_id" text NOT NULL,
	"caption" text,
	"media_type" text,
	"product_type" text,
	"thumbnail_url" text,
	"permalink" text,
	"published_at" timestamp with time zone NOT NULL,
	"like_count" integer,
	"comments_count" integer,
	"performance_ratio" real,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspiration_media_ig_media_id_unique" UNIQUE("ig_media_id")
);
--> statement-breakpoint
CREATE TABLE "instagram_account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"follower_count" integer NOT NULL,
	"follows_count" integer NOT NULL,
	"media_count" integer NOT NULL,
	CONSTRAINT "instagram_account_snapshots_account_day_uk" UNIQUE("account_id","captured_on")
);
--> statement-breakpoint
CREATE TABLE "instagram_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"ig_user_id" text NOT NULL,
	"username" text,
	"name" text,
	"avatar_url" text,
	"biography" text,
	"account_type" text,
	"follower_count" integer,
	"follows_count" integer,
	"media_count" integer,
	"access_token_cipher" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"granted_scope" text,
	"status" "instagram_account_status" DEFAULT 'conectada' NOT NULL,
	"last_error" text,
	"last_profile_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_accounts_ig_user_id_unique" UNIQUE("ig_user_id")
);
--> statement-breakpoint
CREATE TABLE "lead_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"channel" "lead_interaction_channel" DEFAULT 'otro' NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"business" text,
	"source" "lead_source" DEFAULT 'otro' NOT NULL,
	"email" text,
	"instagram" text,
	"whatsapp" text,
	"website" text,
	"status" "lead_status" DEFAULT 'nuevo' NOT NULL,
	"lost_reason" "lead_lost_reason",
	"estimated_value" numeric(14, 2),
	"currency" "lead_currency" DEFAULT 'USD' NOT NULL,
	"first_contact_at" date DEFAULT now() NOT NULL,
	"last_contact_at" date,
	"next_follow_up_at" date,
	"closed_at" date,
	"notes" text,
	"client_project_id" uuid,
	"location" text,
	"origin" text DEFAULT 'manual' NOT NULL,
	"payload_raw" jsonb,
	"external_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	"crm_contacto_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "manual_incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"description" text NOT NULL,
	"received_at" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"project_id" uuid,
	"concept_id" uuid,
	"method" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fb_user_id" text NOT NULL,
	"fb_user_name" text,
	"page_id" text NOT NULL,
	"page_name" text,
	"ig_business_account_id" text NOT NULL,
	"ig_username" text,
	"access_token_cipher" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"granted_scope" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_connections_fb_user_id_unique" UNIQUE("fb_user_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar_color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portal_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "project_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"mode" "agreement_mode" DEFAULT 'unico' NOT NULL,
	"signed_at" date,
	"file_url" text,
	"file_name" text,
	"notes" text,
	"internal_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"number" text NOT NULL,
	"issued_at" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" "currency" DEFAULT 'ARS' NOT NULL,
	"agreement_id" uuid,
	"file_url" text,
	"file_name" text,
	"notes" text,
	"internal_only" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_date" date,
	"done" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"paid_at" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"method" text,
	"file_url" text,
	"file_name" text,
	"notes" text,
	"uploaded_by_portal_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "project_type" NOT NULL,
	"color" text,
	"ga_property_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"sort_order" numeric(20, 6) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"location" "task_location" DEFAULT 'bandeja' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"project_id" uuid,
	"client_project_id" uuid,
	"sort_order" numeric(20, 6) DEFAULT 0 NOT NULL,
	"moved_to_today_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tiktok_account_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"follower_count" integer NOT NULL,
	"following_count" integer NOT NULL,
	"likes_count" bigint NOT NULL,
	"video_count" integer NOT NULL,
	CONSTRAINT "tiktok_account_snapshots_account_day_uk" UNIQUE("account_id","captured_on")
);
--> statement-breakpoint
CREATE TABLE "tiktok_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"open_id" text NOT NULL,
	"union_id" text,
	"display_name" text,
	"avatar_url" text,
	"bio_description" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"profile_deep_link" text,
	"follower_count" integer,
	"following_count" integer,
	"likes_count" bigint,
	"video_count" integer,
	"access_token_cipher" text NOT NULL,
	"refresh_token_cipher" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"granted_scope" text,
	"status" "tiktok_account_status" DEFAULT 'conectada' NOT NULL,
	"last_error" text,
	"last_profile_sync_at" timestamp with time zone,
	"last_video_sync_at" timestamp with time zone,
	"last_snapshot_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiktok_accounts_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "tiktok_video_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"captured_on" date NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" bigint NOT NULL,
	"like_count" bigint NOT NULL,
	"comment_count" bigint NOT NULL,
	"share_count" bigint NOT NULL,
	CONSTRAINT "tiktok_video_snapshots_video_day_uk" UNIQUE("video_id","captured_on")
);
--> statement-breakpoint
CREATE TABLE "tiktok_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"tiktok_id" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"title" text,
	"video_description" text,
	"cover_image_url" text,
	"share_url" text,
	"embed_link" text,
	"duration" integer,
	"width" integer,
	"height" integer,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint,
	"share_count" bigint,
	"available" boolean DEFAULT true NOT NULL,
	"unavailable_since" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tiktok_videos_tiktok_id_unique" UNIQUE("tiktok_id")
);
--> statement-breakpoint
CREATE TABLE "video_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "video_platform" NOT NULL,
	"external_id" text NOT NULL,
	"text" text NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text,
	"duration_seconds" integer,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_transcripts_platform_external_uk" UNIQUE("platform","external_id")
);
--> statement-breakpoint
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_concepts" ADD CONSTRAINT "budget_concepts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_concepts" ADD CONSTRAINT "budget_concepts_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_entries" ADD CONSTRAINT "budget_entries_concept_id_budget_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."budget_concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_accesses" ADD CONSTRAINT "client_accesses_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_projects" ADD CONSTRAINT "client_projects_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_account_id_instagram_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."instagram_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contactos" ADD CONSTRAINT "crm_contactos_importacion_id_crm_importaciones_id_fk" FOREIGN KEY ("importacion_id") REFERENCES "public"."crm_importaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_derivaciones" ADD CONSTRAINT "crm_derivaciones_contacto_id_crm_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."crm_contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_derivaciones" ADD CONSTRAINT "crm_derivaciones_unidad_project_id_crm_unidades_project_id_fk" FOREIGN KEY ("unidad_project_id") REFERENCES "public"."crm_unidades"("project_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_eventos" ADD CONSTRAINT "crm_eventos_contacto_id_crm_contactos_id_fk" FOREIGN KEY ("contacto_id") REFERENCES "public"."crm_contactos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_eventos" ADD CONSTRAINT "crm_eventos_derivacion_id_crm_derivaciones_id_fk" FOREIGN KEY ("derivacion_id") REFERENCES "public"."crm_derivaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_importaciones" ADD CONSTRAINT "crm_importaciones_derivar_a_project_id_crm_unidades_project_id_fk" FOREIGN KEY ("derivar_a_project_id") REFERENCES "public"."crm_unidades"("project_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_unidades" ADD CONSTRAINT "crm_unidades_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspiration_media" ADD CONSTRAINT "inspiration_media_account_id_inspiration_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."inspiration_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_account_snapshots" ADD CONSTRAINT "instagram_account_snapshots_account_id_instagram_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."instagram_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_incomes" ADD CONSTRAINT "manual_incomes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_incomes" ADD CONSTRAINT "manual_incomes_concept_id_budget_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."budget_concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_agreements" ADD CONSTRAINT "project_agreements_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invoices" ADD CONSTRAINT "project_invoices_agreement_id_project_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."project_agreements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_milestones" ADD CONSTRAINT "project_milestones_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_invoice_id_project_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."project_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_payments" ADD CONSTRAINT "project_payments_uploaded_by_portal_user_id_portal_users_id_fk" FOREIGN KEY ("uploaded_by_portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_project_id_client_projects_id_fk" FOREIGN KEY ("client_project_id") REFERENCES "public"."client_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiktok_account_snapshots" ADD CONSTRAINT "tiktok_account_snapshots_account_id_tiktok_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tiktok_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiktok_accounts" ADD CONSTRAINT "tiktok_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiktok_video_snapshots" ADD CONSTRAINT "tiktok_video_snapshots_video_id_tiktok_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."tiktok_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiktok_videos" ADD CONSTRAINT "tiktok_videos_account_id_tiktok_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."tiktok_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_ideas_status_idx" ON "content_ideas" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "content_ideas_batch_idx" ON "content_ideas" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "crm_contactos_origen_idx" ON "crm_contactos" USING btree ("origen");--> statement-breakpoint
CREATE INDEX "crm_contactos_suscripto_idx" ON "crm_contactos" USING btree ("suscripto");--> statement-breakpoint
CREATE INDEX "crm_contactos_opt_in_idx" ON "crm_contactos" USING btree ("whatsapp_opt_in");--> statement-breakpoint
CREATE INDEX "crm_contactos_tags_idx" ON "crm_contactos" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "crm_derivaciones_unidad_estado_idx" ON "crm_derivaciones" USING btree ("unidad_project_id","estado");--> statement-breakpoint
CREATE INDEX "crm_derivaciones_contacto_idx" ON "crm_derivaciones" USING btree ("contacto_id");--> statement-breakpoint
CREATE INDEX "crm_eventos_contacto_idx" ON "crm_eventos" USING btree ("contacto_id","ocurrido_at");--> statement-breakpoint
CREATE INDEX "crm_eventos_tipo_idx" ON "crm_eventos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "inspiration_media_account_published_idx" ON "inspiration_media" USING btree ("account_id","published_at");--> statement-breakpoint
CREATE INDEX "inspiration_media_ratio_idx" ON "inspiration_media" USING btree ("performance_ratio");--> statement-breakpoint
CREATE INDEX "instagram_accounts_project_idx" ON "instagram_accounts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lead_interactions_lead_idx" ON "lead_interactions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_status_idx" ON "leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leads_next_follow_up_idx" ON "leads" USING btree ("next_follow_up_at");--> statement-breakpoint
CREATE INDEX "leads_client_project_idx" ON "leads" USING btree ("client_project_id");--> statement-breakpoint
CREATE INDEX "subtasks_task_idx" ON "subtasks" USING btree ("task_id","sort_order");--> statement-breakpoint
CREATE INDEX "tasks_location_order_idx" ON "tasks" USING btree ("location","sort_order");--> statement-breakpoint
CREATE INDEX "tasks_client_project_idx" ON "tasks" USING btree ("client_project_id");--> statement-breakpoint
CREATE INDEX "tiktok_accounts_project_idx" ON "tiktok_accounts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tiktok_video_snapshots_day_idx" ON "tiktok_video_snapshots" USING btree ("captured_on");--> statement-breakpoint
CREATE INDEX "tiktok_videos_account_published_idx" ON "tiktok_videos" USING btree ("account_id","published_at");--> statement-breakpoint
CREATE INDEX "tiktok_videos_account_available_idx" ON "tiktok_videos" USING btree ("account_id","available");