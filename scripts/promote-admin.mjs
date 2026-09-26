import pg from "pg";

const username = process.argv[2]?.trim().toLowerCase();
const connectionString = process.env.DATABASE_URL;

if (!username || !/^[a-z0-9_]{3,32}$/.test(username)) {
  console.error("Usage: npm run admin:promote -- <username>");
  process.exitCode = 2;
} else if (!connectionString) {
  console.error("DATABASE_URL must be set in the current environment.");
  process.exitCode = 2;
} else {
  const pool = new pg.Pool({
    connectionString,
    ssl: connectionString.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const result = await pool.query(
      "UPDATE users SET is_admin = TRUE WHERE username = $1 RETURNING username",
      [username],
    );

    if (result.rowCount === 0) {
      console.error(`No account found for username: ${username}`);
      process.exitCode = 1;
    } else {
      console.log(`Administrator access granted to ${result.rows[0].username}.`);
    }
  } catch (error) {
    console.error("Could not promote administrator:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}