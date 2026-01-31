-- Insert test users into Supabase
-- Run this in your Supabase SQL Editor

INSERT INTO users (id, email, role, permissions, full_name, created_at)
VALUES 
  (gen_random_uuid(), '23it3028@rgipt.ac.in', 'head', '{}', 'Head Admin', NOW()),
  (gen_random_uuid(), '23it3043@rgipt.ac.in', 'co_head', '{}', 'Co-Head Admin', NOW()),
  (gen_random_uuid(), 'mohitkumar2512@gmail.com', 'executive', ARRAY['canAddEvents', 'canUploadPhotos'], 'Executive User', NOW())
ON CONFLICT (email) DO NOTHING;

-- Verify the data was inserted
SELECT id, email, role, full_name FROM users;
