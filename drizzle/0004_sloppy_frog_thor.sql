CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'default',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "projectId" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_userId_idx" ON "projects" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;