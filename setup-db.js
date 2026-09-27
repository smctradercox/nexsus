async function main() {
  const { default: fs } = await import("node:fs");
  const { Client } = await import("pg");
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl && fs.existsSync(".env.local")) {
    const envFile = fs.readFileSync(".env.local", "utf8");
    const match = envFile.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
    if (match) dbUrl = match[1];
  }

  if (!dbUrl) {
    console.error("❌ لم يتم العثور على DATABASE_URL في ملف .env.local");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  console.log("⚡ جاري الاتصال بـ Neon إنشاء الجداول...");
  await client.connect();

  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_hash'
      ) THEN
        ALTER TABLE "users" RENAME COLUMN "password" TO "password_hash";
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_active'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "is_active" boolean DEFAULT false NOT NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_admin'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'subscription_expires_at'
      ) THEN
        ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp with time zone;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'receipt_url'
      ) THEN
        ALTER TABLE "payments" ADD COLUMN "receipt_url" text;
        UPDATE "payments" SET "receipt_url" = COALESCE("screenshot_url", 'legacy:unknown') WHERE "receipt_url" IS NULL;
        ALTER TABLE "payments" ALTER COLUMN "receipt_url" SET NOT NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'reviewed_at'
      ) THEN
        ALTER TABLE "payments" ADD COLUMN "reviewed_at" timestamp with time zone;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analyses' AND column_name = 'ai_response_json'
      ) THEN
        ALTER TABLE "analyses" ADD COLUMN "ai_response_json" jsonb;
        UPDATE "analyses" SET "ai_response_json" = COALESCE(NULLIF("result_json", '')::jsonb, '{}'::jsonb) WHERE "ai_response_json" IS NULL;
        ALTER TABLE "analyses" ALTER COLUMN "ai_response_json" SET NOT NULL;
      END IF;

      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analyses' AND column_name = 'result_json'
      ) THEN
        ALTER TABLE "analyses" ALTER COLUMN "result_json" DROP NOT NULL;
      END IF;
    END $$;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "username" varchar(32) UNIQUE NOT NULL,
      "password_hash" text NOT NULL,
      "is_active" boolean DEFAULT false NOT NULL,
      "is_admin" boolean DEFAULT false NOT NULL,
      "subscription_expires_at" timestamp with time zone,
      "subscription_status" varchar(16) DEFAULT 'inactive' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "payments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "receipt_url" text NOT NULL,
      "status" text DEFAULT 'pending' NOT NULL,
      "reviewed_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS "analyses" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "image_url" text NOT NULL,
      "ai_response_json" jsonb NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  console.log("✅ تم إنشاء جميع الجداول (users, payments, analyses) بنجاح!");
  await client.end();
  process.exit(0);
}

main().catch(err => {
  console.error("❌ حدث خطأ أثناء الاتصال:", err.message);
  process.exit(1);
});
