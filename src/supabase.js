import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || "https://kpirmiziarennhwlgnll.supabase.co"
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwaXJtaXppYXJlbm5od2xnbmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzM5MTAsImV4cCI6MjA4OTM0OTkxMH0.28jsEesuFMBDuMHjFlqbfYrpVHZEsdyjucCojdgwzyw"

export const supabase = createClient(url, key)
