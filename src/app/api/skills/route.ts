import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = db();

    // Get all skills
    const { data: skills, error } = await supabase
      .from('Skill')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching skills:', error);
      throw error;
    }

    return NextResponse.json(skills || []);
  } catch (error) {
    console.error("Error fetching skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}