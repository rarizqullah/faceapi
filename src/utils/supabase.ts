import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uuclazonumviuzgbfayo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1Y2xhem9udW12aXV6Z2JmYXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2NjE1OTEsImV4cCI6MjA1ODIzNzU5MX0.JgSBxtG6NK46Yp_giFgU80T6ZKOjrCHolyIfNxVtfTk'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)