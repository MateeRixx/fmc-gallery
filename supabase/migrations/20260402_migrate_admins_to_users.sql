-- Migration: Move data from admins table to users table
-- This fixes the authentication issue where users were in wrong table

-- First, check if admins table exists and has data
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admins') THEN
        -- Copy admins to users table if they don't already exist
        INSERT INTO users (id, email, role, full_name, created_at, user_type)
        SELECT 
            COALESCE(a.id, gen_random_uuid()) as id,
            a.email,
            COALESCE(a.role, 'member') as role,
            COALESCE(a.full_name, a.email) as full_name,
            COALESCE(a.created_at, NOW()) as created_at,
            'ADMIN' as user_type
        FROM admins a
        WHERE NOT EXISTS (
            SELECT 1 FROM users u WHERE u.email = a.email
        )
        ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Data migrated from admins to users table';
    ELSE
        RAISE NOTICE 'Admins table does not exist, skipping migration';
    END IF;
END $$;
