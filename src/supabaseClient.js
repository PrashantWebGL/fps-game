
import { createClient } from '@supabase/supabase-js'

// ------------------------------------------------------------------
// TODO: REPLACE WITH YOUR SUPABASE PROJECT CREDENTIALS
// 1. Go to https://database.new to create a free project
// 2. Go to Project Settings -> API
// 3. Copy "Project URL" and "anon" public key
// ------------------------------------------------------------------

const supabaseUrl = 'https://igmtspwswuhdbxbfcszf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbXRzcHdzd3VoZGJ4YmZjc3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MzAxMjMsImV4cCI6MjA4MTAwNjEyM30.l_JozUSqow2FqjENG9EmbzzwLKz8RfjzEdsHSXcBI40';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to check if configured
export const isSupabaseConfigured = () => {
    return supabaseUrl.length > 0 && supabaseKey.length > 0 &&
        !supabaseUrl.includes('YOUR_SUPABASE_URL') &&
        !supabaseKey.includes('YOUR_SUPABASE_ANON_KEY');
};
