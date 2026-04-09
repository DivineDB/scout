const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres:DBkaalter%40456@db.oqpvuvkddyrdyrrtwlfz.supabase.co:5432/postgres";

async function migrate() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("Connected to Supabase Postgres.");

    // 1. Ensure the status column exists (Double check, although verified earlier)
    await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'casual';
    `);
    console.log("Verified 'status' column exists.");

    // 2. Enable RLS (Usually enabled by default in Supabase, but let's be sure)
    await client.query(`
      ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
    `);
    console.log("Row Level Security enabled.");

    // 3. Create Update Policy
    // PostgreSQL doesn't have 'CREATE POLICY IF NOT EXISTS' natively, so we use a DO block
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'jobs' AND policyname = 'Allow update for everyone'
        ) THEN
          CREATE POLICY "Allow update for everyone" ON jobs FOR UPDATE USING (true) WITH CHECK (true);
        END IF;
      END
      $$;
    `);
    console.log("Update policy 'Allow update for everyone' verified/created.");

    // 4. Create Select Policy (Usually needed to see the jobs)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'jobs' AND policyname = 'Allow select for everyone'
        ) THEN
          CREATE POLICY "Allow select for everyone" ON jobs FOR SELECT USING (true);
        END IF;
      END
      $$;
    `);
    console.log("Select policy 'Allow select for everyone' verified/created.");

    // 5. Create Insert Policy (Needed for the pipeline)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = 'jobs' AND policyname = 'Allow insert for everyone'
        ) THEN
          CREATE POLICY "Allow insert for everyone" ON jobs FOR INSERT WITH CHECK (true);
        END IF;
      END
      $$;
    `);
    console.log("Insert policy 'Allow insert for everyone' verified/created.");

    console.log("Migration successful! Your database is now ready for 'Serious Mode'.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await client.end();
  }
}

migrate();
