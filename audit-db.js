const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: 'db.hmjvjepmnvtoabddsxeu.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

async function audit() {
  await client.connect();
  console.log('Connected to database\n');

  // 1. Extensions
  console.log('=== EXTENSIONS ===');
  console.log(await query(`SELECT * FROM pg_extension`));

  // 2. ENUM types
  console.log('\n=== ENUM TYPES ===');
  console.log(await query(`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) as values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    GROUP BY t.typname
  `));

  // 3. Tables
  console.log('\n=== TABLES ===');
  console.log(await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `));

  // 4. Columns per table
  console.log('\n=== COLUMNS ===');
  const tables = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  for (const t of tables) {
    const cols = await query(`
      SELECT column_name, data_type, is_nullable, column_default,
             character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [t.table_name]);
    console.log(`\n-- ${t.table_name}`);
    console.log(cols);
  }

  // 5. Primary keys
  console.log('\n=== PRIMARY KEYS ===');
  console.log(await query(`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.ordinal_position
  `));

  // 6. Foreign keys
  console.log('\n=== FOREIGN KEYS ===');
  console.log(await query(`
    SELECT
      tc.table_name, kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `));

  // 7. Unique constraints
  console.log('\n=== UNIQUE CONSTRAINTS ===');
  console.log(await query(`
    SELECT tc.table_name, kcu.column_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `));

  // 8. Check constraints
  console.log('\n=== CHECK CONSTRAINTS ===');
  console.log(await query(`
    SELECT tc.table_name, cc.check_clause, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
      AND tc.table_schema = cc.constraint_schema
    WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = 'public'
    ORDER BY tc.table_name
  `));

  // 9. Indexes
  console.log('\n=== INDEXES ===');
  console.log(await query(`
    SELECT
      schemaname, tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `));

  // 10. RLS status
  console.log('\n=== RLS STATUS ===');
  console.log(await query(`
    SELECT
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    ORDER BY c.relname
  `));

  // 11. RLS Policies
  console.log('\n=== RLS POLICIES ===');
  console.log(await query(`
    SELECT
      schemaname, tablename, policyname,
      permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `));

  // 12. Functions
  console.log('\n=== FUNCTIONS ===');
  console.log(await query(`
    SELECT
      n.nspname as schema,
      p.proname as name,
      pg_get_function_result(p.oid) as result_type,
      pg_get_function_arguments(p.oid) as arguments,
      p.prosecdef as security_definer,
      p.prokind as kind,
      pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `));

  // 13. Function EXECUTE grants
  console.log('\n=== FUNCTION GRANTS ===');
  console.log(await query(`
    SELECT
      n.nspname as schema,
      p.proname as function_name,
      r.rolname as grantee,
      string_agg(privilege_type, ', ') as privileges
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN information_schema.routine_privileges rp
      ON rp.routine_schema = n.nspname
      AND rp.routine_name = p.proname
    JOIN pg_roles r ON r.oid = rp.grantee
    WHERE n.nspname = 'public'
      AND r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
    GROUP BY n.nspname, p.proname, r.rolname
    ORDER BY p.proname, r.rolname
  `));

  // 14. Table GRANTS
  console.log('\n=== TABLE GRANTS ===');
  console.log(await query(`
    SELECT
      table_name,
      grantee,
      string_agg(privilege_type, ', ') as privileges
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
    GROUP BY table_name, grantee
    ORDER BY table_name, grantee
  `));

  // 15. Triggers
  console.log('\n=== TRIGGERS ===');
  console.log(await query(`
    SELECT
      event_object_table as table_name,
      trigger_name,
      event_manipulation,
      action_timing,
      action_statement
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name
  `));

  // 16. Key function definitions (detailed)
  console.log('\n=== KEY FUNCTION DEFINITIONS ===');
  const keyFuncs = [
    'create_order', 'confirm_deposit_payment', 'create_delivery_when_ready',
    'update_delivery_status', 'get_order_receipt', 'get_order_tracking',
    'get_my_vendor_id', 'is_admin', 'get_my_role', 'is_driver', 'is_vendor',
    'prepare_vendor_order_notification', 'prepare_admin_order_notification',
    'prepare_order_notifications', 'trigger_order_notifications'
  ];
  for (const fn of keyFuncs) {
    const def = await query(`
      SELECT pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = $1
    `, [fn]);
    if (def.length > 0) {
      console.log(`\n-- ${fn}`);
      console.log(def[0].definition);
    } else {
      console.log(`\n-- ${fn}: NOT FOUND`);
    }
  }

  await client.end();
  console.log('\n=== AUDIT COMPLETE ===');
}

audit().catch(err => {
  console.error('Audit error:', err);
  client.end();
  process.exit(1);
});