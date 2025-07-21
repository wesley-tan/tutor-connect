-- CreateEnum
CREATE TYPE "user_type_enum" AS ENUM ('student', 'tutor');

-- CreateEnum
CREATE TYPE "learning_style_enum" AS ENUM ('visual', 'auditory', 'kinesthetic', 'mixed');

-- CreateEnum
CREATE TYPE "session_type_enum" AS ENUM ('online', 'in_person');

-- CreateEnum
CREATE TYPE "message_type_enum" AS ENUM ('text', 'file', 'image', 'system');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "user_type" "user_type_enum" NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "profile_image_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "auth_provider" TEXT,
    "google_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuing_organization" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutee_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "grade_level" TEXT,
    "school_name" TEXT,
    "learning_style" "learning_style_enum",
    "budget_min" DECIMAL(10,2),
    "budget_max" DECIMAL(10,2),
    "preferred_session_length" INTEGER NOT NULL DEFAULT 60,
    "location_city" TEXT,
    "location_state" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tutee_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutee_learning_goals" (
    "id" TEXT NOT NULL,
    "tutee_id" TEXT NOT NULL,
    "goal_text" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutee_learning_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutee_subject_needs" (
    "id" TEXT NOT NULL,
    "tutee_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "urgency_level" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutee_subject_needs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hourly_rate" DECIMAL(10,2) NOT NULL,
    "education_level" TEXT,
    "university" TEXT,
    "major" TEXT,
    "graduation_year" INTEGER,
    "teaching_experience_years" INTEGER NOT NULL DEFAULT 0,
    "bio" TEXT,
    "teaching_methodology" TEXT,
    "availability_timezone" TEXT,
    "is_background_checked" BOOLEAN NOT NULL DEFAULT false,
    "background_check_date" TIMESTAMPTZ,
    "rating_average" DECIMAL(3,2) NOT NULL DEFAULT 0.0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tutor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_subjects" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "proficiency_level" INTEGER NOT NULL DEFAULT 1,
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_certifications" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "certification_id" TEXT NOT NULL,
    "earned_date" DATE,
    "expiry_date" DATE,
    "credential_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_specializations" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "specialization_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_specializations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_languages" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "language_name" TEXT NOT NULL,
    "proficiency_level" TEXT NOT NULL DEFAULT 'conversational',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_languages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_availability" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_overrides" (
    "id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "is_available" BOOLEAN NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "participant_a" TEXT NOT NULL,
    "participant_b" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "message_type" "message_type_enum" NOT NULL DEFAULT 'text',
    "file_url" TEXT,
    "file_name" TEXT,
    "file_size_bytes" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tutee_id" TEXT NOT NULL,
    "tutor_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "status_id" INTEGER NOT NULL DEFAULT 1,
    "scheduled_start" TIMESTAMPTZ NOT NULL,
    "scheduled_end" TIMESTAMPTZ NOT NULL,
    "actual_start" TIMESTAMPTZ,
    "actual_end" TIMESTAMPTZ,
    "session_type" "session_type_enum" NOT NULL DEFAULT 'online',
    "zoom_meeting_id" TEXT,
    "zoom_join_url" TEXT,
    "zoom_password" TEXT,
    "session_notes" TEXT,
    "homework_assigned" TEXT,
    "cancellation_reason" TEXT,
    "price_paid" BIGINT,
    "platform_fee" BIGINT,
    "tutor_earnings" BIGINT,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewee_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "teaching_effectiveness" INTEGER,
    "communication" INTEGER,
    "punctuality" INTEGER,
    "would_recommend" BOOLEAN,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "payer_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "status_id" INTEGER NOT NULL DEFAULT 1,
    "stripe_payment_intent_id" TEXT,
    "stripe_customer_id" TEXT,
    "amount" BIGINT NOT NULL,
    "platform_fee" BIGINT NOT NULL,
    "net_amount" BIGINT NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "payment_method" TEXT,
    "failure_reason" TEXT,
    "refund_amount" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(100) NOT NULL,
    "resource_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "processed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_user_type_idx" ON "users"("user_type");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_auth_provider_idx" ON "users"("auth_provider");

-- CreateIndex
CREATE INDEX "users_google_id_idx" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_name_key" ON "subjects"("name");

-- CreateIndex
CREATE INDEX "subjects_category_idx" ON "subjects"("category");

-- CreateIndex
CREATE INDEX "subjects_is_active_idx" ON "subjects"("is_active");

-- CreateIndex
CREATE INDEX "subjects_name_idx" ON "subjects"("name");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_name_key" ON "certifications"("name");

-- CreateIndex
CREATE INDEX "certifications_is_active_idx" ON "certifications"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "session_statuses_name_key" ON "session_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_statuses_name_key" ON "payment_statuses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tutee_profiles_user_id_key" ON "tutee_profiles"("user_id");

-- CreateIndex
CREATE INDEX "tutee_profiles_parent_id_idx" ON "tutee_profiles"("parent_id");

-- CreateIndex
CREATE INDEX "tutee_profiles_grade_level_idx" ON "tutee_profiles"("grade_level");

-- CreateIndex
CREATE INDEX "tutee_profiles_budget_min_budget_max_idx" ON "tutee_profiles"("budget_min", "budget_max");

-- CreateIndex
CREATE INDEX "tutee_learning_goals_tutee_id_idx" ON "tutee_learning_goals"("tutee_id");

-- CreateIndex
CREATE INDEX "tutee_subject_needs_urgency_level_idx" ON "tutee_subject_needs"("urgency_level");

-- CreateIndex
CREATE UNIQUE INDEX "tutee_subject_needs_tutee_id_subject_id_key" ON "tutee_subject_needs"("tutee_id", "subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_profiles_user_id_key" ON "tutor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "tutor_profiles_rating_average_idx" ON "tutor_profiles"("rating_average");

-- CreateIndex
CREATE INDEX "tutor_profiles_hourly_rate_idx" ON "tutor_profiles"("hourly_rate");

-- CreateIndex
CREATE INDEX "tutor_profiles_is_verified_idx" ON "tutor_profiles"("is_verified");

-- CreateIndex
CREATE INDEX "tutor_profiles_is_background_checked_idx" ON "tutor_profiles"("is_background_checked");

-- CreateIndex
CREATE INDEX "tutor_subjects_proficiency_level_idx" ON "tutor_subjects"("proficiency_level");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_subjects_tutor_id_subject_id_key" ON "tutor_subjects"("tutor_id", "subject_id");

-- CreateIndex
CREATE INDEX "tutor_certifications_is_verified_idx" ON "tutor_certifications"("is_verified");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_certifications_tutor_id_certification_id_key" ON "tutor_certifications"("tutor_id", "certification_id");

-- CreateIndex
CREATE INDEX "tutor_specializations_tutor_id_idx" ON "tutor_specializations"("tutor_id");

-- CreateIndex
CREATE INDEX "tutor_languages_proficiency_level_idx" ON "tutor_languages"("proficiency_level");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_languages_tutor_id_language_name_key" ON "tutor_languages"("tutor_id", "language_name");

-- CreateIndex
CREATE INDEX "tutor_availability_tutor_id_day_of_week_idx" ON "tutor_availability"("tutor_id", "day_of_week");

-- CreateIndex
CREATE INDEX "tutor_availability_is_available_idx" ON "tutor_availability"("is_available");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_availability_tutor_id_day_of_week_start_time_end_time_key" ON "tutor_availability"("tutor_id", "day_of_week", "start_time", "end_time");

-- CreateIndex
CREATE INDEX "availability_overrides_date_idx" ON "availability_overrides"("date");

-- CreateIndex
CREATE UNIQUE INDEX "availability_overrides_tutor_id_date_key" ON "availability_overrides"("tutor_id", "date");

-- CreateIndex
CREATE INDEX "conversations_participant_a_participant_b_idx" ON "conversations"("participant_a", "participant_b");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_participant_a_participant_b_key" ON "conversations"("participant_a", "participant_b");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_receiver_id_is_read_idx" ON "messages"("receiver_id", "is_read");

-- CreateIndex
CREATE INDEX "sessions_tutee_id_idx" ON "sessions"("tutee_id");

-- CreateIndex
CREATE INDEX "sessions_tutor_id_idx" ON "sessions"("tutor_id");

-- CreateIndex
CREATE INDEX "sessions_status_id_idx" ON "sessions"("status_id");

-- CreateIndex
CREATE INDEX "sessions_scheduled_start_idx" ON "sessions"("scheduled_start");

-- CreateIndex
CREATE INDEX "sessions_deleted_at_idx" ON "sessions"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tutor_id_scheduled_start_key" ON "sessions"("tutor_id", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_session_id_key" ON "reviews"("session_id");

-- CreateIndex
CREATE INDEX "reviews_reviewee_id_idx" ON "reviews"("reviewee_id");

-- CreateIndex
CREATE INDEX "reviews_rating_idx" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_session_id_key" ON "payments"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payments_payer_id_idx" ON "payments"("payer_id");

-- CreateIndex
CREATE INDEX "payments_recipient_id_idx" ON "payments"("recipient_id");

-- CreateIndex
CREATE INDEX "payments_status_id_idx" ON "payments"("status_id");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "event_logs_type_idx" ON "event_logs"("type");

-- CreateIndex
CREATE INDEX "event_logs_status_idx" ON "event_logs"("status");

-- CreateIndex
CREATE INDEX "event_logs_created_at_idx" ON "event_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_token_key" ON "magic_links"("token");

-- CreateIndex
CREATE INDEX "magic_links_email_idx" ON "magic_links"("email");

-- CreateIndex
CREATE INDEX "magic_links_token_idx" ON "magic_links"("token");

-- CreateIndex
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links"("expires_at");

-- CreateIndex
CREATE INDEX "magic_links_used_idx" ON "magic_links"("used");

-- AddForeignKey
ALTER TABLE "tutee_profiles" ADD CONSTRAINT "tutee_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutee_profiles" ADD CONSTRAINT "tutee_profiles_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutee_learning_goals" ADD CONSTRAINT "tutee_learning_goals_tutee_id_fkey" FOREIGN KEY ("tutee_id") REFERENCES "tutee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutee_subject_needs" ADD CONSTRAINT "tutee_subject_needs_tutee_id_fkey" FOREIGN KEY ("tutee_id") REFERENCES "tutee_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutee_subject_needs" ADD CONSTRAINT "tutee_subject_needs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profiles" ADD CONSTRAINT "tutor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_subjects" ADD CONSTRAINT "tutor_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_certifications" ADD CONSTRAINT "tutor_certifications_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_certifications" ADD CONSTRAINT "tutor_certifications_certification_id_fkey" FOREIGN KEY ("certification_id") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_specializations" ADD CONSTRAINT "tutor_specializations_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_languages" ADD CONSTRAINT "tutor_languages_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_availability" ADD CONSTRAINT "tutor_availability_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_a_fkey" FOREIGN KEY ("participant_a") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_b_fkey" FOREIGN KEY ("participant_b") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutee_id_fkey" FOREIGN KEY ("tutee_id") REFERENCES "tutee_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "session_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_fkey" FOREIGN KEY ("reviewee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "payment_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_email_fkey" FOREIGN KEY ("email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
