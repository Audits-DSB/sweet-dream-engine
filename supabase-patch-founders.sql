-- Add financial columns to founders table
ALTER TABLE founders 
  ADD COLUMN IF NOT EXISTS total_contributed NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
