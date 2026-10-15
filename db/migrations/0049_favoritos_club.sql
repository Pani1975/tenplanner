ALTER TABLE "exercise_lists" ADD COLUMN "club_id" uuid;--> statement-breakpoint
ALTER TABLE "exercise_lists" ADD CONSTRAINT "exercise_lists_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_lists_club_id_idx" ON "exercise_lists" USING btree ("club_id");