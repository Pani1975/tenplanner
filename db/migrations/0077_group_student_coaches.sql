CREATE TABLE IF NOT EXISTS "group_coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student_coaches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_coaches" ADD CONSTRAINT "group_coaches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_coaches" ADD CONSTRAINT "group_coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_coaches" ADD CONSTRAINT "group_coaches_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_coaches" ADD CONSTRAINT "student_coaches_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_coaches" ADD CONSTRAINT "student_coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student_coaches" ADD CONSTRAINT "student_coaches_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_coaches_group_user_uniq" ON "group_coaches" USING btree ("group_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_coaches_group_id_idx" ON "group_coaches" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_coaches_user_id_idx" ON "group_coaches" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_coaches_student_user_uniq" ON "student_coaches" USING btree ("student_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_coaches_student_id_idx" ON "student_coaches" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_coaches_user_id_idx" ON "student_coaches" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "group_coaches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student_coaches" ENABLE ROW LEVEL SECURITY;
