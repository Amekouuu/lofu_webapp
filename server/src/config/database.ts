import { supabase } from './supabase';

// Supabase talks to Postgres over HTTPS, so there is no persistent connection to open.
// This just proves the credentials work and that schema.sql has been applied.
export async function connectDatabase(): Promise<void> {
  const { error } = await supabase
    .from('users')
    .select('id', { head: true, count: 'exact' })
    .limit(1);

  if (error) {
    console.error(
      'Supabase connection check failed. Is SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY correct, ' +
        'and has server/supabase/schema.sql been run in the SQL Editor?',
      error
    );
    process.exit(1);
  }

  console.log('Supabase connected successfully');
}
