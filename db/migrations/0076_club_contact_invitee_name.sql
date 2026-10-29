ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "website" varchar(255);
--> statement-breakpoint
ALTER TABLE "club_invites" ADD COLUMN IF NOT EXISTS "invitee_name" varchar(255);
