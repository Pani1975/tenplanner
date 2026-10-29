ALTER TABLE "class_lists" ADD COLUMN "club_id" uuid;--> statement-breakpoint
ALTER TABLE "class_lists" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "club_id" uuid;--> statement-breakpoint
ALTER TABLE "class_lists" ADD CONSTRAINT "class_lists_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_lists_club_id_idx" ON "class_lists" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "class_lists_is_public_idx" ON "class_lists" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "exercises_club_id_idx" ON "exercises" USING btree ("club_id");