import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import crypto from 'crypto';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/studio/projects/[id]/talent-requirements - Get talent requirements for a project
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectId = params.id;

    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can manage talent requirements" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Check if the project belongs to this studio
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // Get all talent requirements for this project
    const talentRequirementsResult = await supabase
      .from('TalentRequirement')
      .select('*')
      .eq('projectId', projectId)
      .order('createdAt', { ascending: false });

    const talentRequirements = handleDbResult(talentRequirementsResult);

    return NextResponse.json(talentRequirements);
  } catch (error) {
    console.error("Error fetching talent requirements:", error);
    return NextResponse.json({
      error: "Failed to fetch talent requirements",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/studio/projects/[id]/talent-requirements - Create a new talent requirement
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projectId = params.id;
    const data = await request.json();

    const supabase = db();

    // Find the user and their tenant
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== "STUDIO") {
      return NextResponse.json({ error: "Only studio accounts can manage talent requirements" }, { status: 403 });
    }

    // Find the studio associated with this tenant
    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.Tenant.id)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: "Studio not found" }, { status: 404 });
    }

    // Check if the project belongs to this studio
    const projectResult = await supabase
      .from('Project')
      .select('*')
      .eq('id', projectId)
      .eq('studioId', studio.id)
      .single();

    const project = handleDbOptional(projectResult);

    if (!project) {
      return NextResponse.json({ error: "Project not found or unauthorized" }, { status: 404 });
    }

    // Create a new talent requirement
    const talentRequirementData: any = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description || null,
      isActive: data.isActive === false ? false : true,
      gender: data.gender || null,
      minAge: data.minAge || null,
      maxAge: data.maxAge || null,
      ethnicity: data.ethnicity || null,
      height: data.height || null,
      skills: data.skills || null,
      otherRequirements: data.otherRequirements || null,
      survey: data.survey || null,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const talentRequirementResult = await supabase
      .from('TalentRequirement')
      .insert(talentRequirementData)
      .select()
      .single();

    const talentRequirement = handleDbResult(talentRequirementResult);

    return NextResponse.json(talentRequirement);
  } catch (error) {
    console.error("Error creating talent requirement:", error);
    return NextResponse.json({
      error: "Failed to create talent requirement",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
