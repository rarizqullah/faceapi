import { Pool } from 'pg';

const pool = new Pool({
  connectionString: 'postgresql://postgres:supabase2606@db.uuclazonumviuzgbfayo.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

export default pool;