CREATE TABLE IF NOT EXISTS "club_coach_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(32),
	"academic_training" text,
	"tennis_training" text,
	"availability" jsonb,
	"started_teaching_year" integer,
	"experience" jsonb,
	"status" varchar(10) DEFAULT 'complete' NOT NULL,
	"profile_token" varchar(128),
	"profile_token_expires_at" timestamp with time zone,
	"consent_given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_coach_profiles_profile_token_unique" UNIQUE("profile_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "club_coach_profiles" ADD CONSTRAINT "club_coach_profiles_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "club_coach_profiles_club_email_uniq" ON "club_coach_profiles" USING btree ("club_id","email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "club_coach_profiles_club_id_idx" ON "club_coach_profiles" USING btree ("club_id");
--> statement-breakpoint
ALTER TABLE "club_coach_profiles" ENABLE ROW LEVEL SECURITY;
