CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"technician_id" uuid NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy" double precision NOT NULL,
	"timestamp" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"barcode" text NOT NULL,
	"price" numeric NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "parts_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"photos" text[] DEFAULT '{}' NOT NULL,
	"form_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"signature" text,
	"pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"address" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"status" text DEFAULT 'assigned' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"category" text NOT NULL,
	"due_date" timestamp NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"estimated_time" integer NOT NULL,
	"technician_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"phone" text,
	"avatar_url" text,
	"is_online" boolean DEFAULT false,
	"last_location_lat" double precision,
	"last_location_lng" double precision,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_technician_id_users_id_fk" FOREIGN KEY ("technician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user1_id" uuid NOT NULL,
	"user2_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user1_id_users_id_fk" FOREIGN KEY ("user1_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user2_id_users_id_fk" FOREIGN KEY ("user2_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_user1_user2_idx" ON "conversations" ("user1_id", "user2_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_reads_message_user_idx" ON "message_reads" ("message_id", "user_id");
