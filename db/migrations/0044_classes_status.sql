ALTER TABLE "classes" ADD COLUMN "status" varchar(16) DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX "classes_status_idx" ON "classes" USING btree ("status");
