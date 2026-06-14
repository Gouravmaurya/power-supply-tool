-- SQL Update script to add kwh, kvah, md, location, and reason fields to meter_logs

ALTER TABLE meter_logs 
ADD COLUMN IF NOT EXISTS kwh float8,
ADD COLUMN IF NOT EXISTS kvah float8,
ADD COLUMN IF NOT EXISTS md float8,
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS reason text;
