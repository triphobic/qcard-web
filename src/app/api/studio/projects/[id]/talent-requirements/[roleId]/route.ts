import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/studio/projects/[id]/talent-requirements/[roleId] - Get a specific talent requirement
export async function GET(
  request: Request,
  { params }: { params: { id: string, roleId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, roleId } = params;

    const supabase = db();

    // Find the user's role (can be studio or talent)
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Tenant (*)
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant) {
      return NextResponse.json({ error: "User not associated with a tenant" }, { status: 403 });
    }

    // If studio, check if the project belongs to this studio
    if (user.Tenant.type === "STUDIO") {
      const studioResult = await supabase
        .from('Studio')
        .select('*')
        .eq('tenantId', user.Tenant.id)
        .single();

      const studio = handleDbOptional(studioResult);

      if (!studio) {
        return NextResponse.json({ error: "Studio not found" }, { status: 404 });
      }

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
    }

    // Get the specific talent requirement
    const talentRequirementResult = await supabase
      .from('TalentRequirement')
      .select('*')
      .eq('id', roleId)
      .eq('projectId', projectId)
      .single();

    const talentRequirement = handleDbOptional(talentRequirementResult);

    if (!talentRequirement) {
      return NextResponse.json({ error: "Talent requirement not found" }, { status: 404 });
    }

    return NextResponse.json(talentRequirement);
  } catch (error) {
    console.error("Error fetching talent requirement:", error);
    return NextResponse.json({
      error: "Failed to fetch talent requirement",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/studio/projects/[id]/talent-requirements/[roleId] - Update a talent requirement
export async function PATCH(
  request: Request,
  { params }: { params: { id: string, roleId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, roleId } = params;
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

    // Find the talent requirement
    const existingRequirementResult = await supabase
      .from('TalentRequirement')
      .select('*')
      .eq('id', roleId)
      .eq('projectId', projectId)
      .single();

    const existingRequirement = handleDbOptional(existingRequirementResult);

    if (!existingRequirement) {
      return NextResponse.json({ error: "Talent requirement not found" }, { status: 404 });
    }

    // Update the talent requirement
    const updateData: any = {
      updatedAt: new Date().toISOString(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.minAge !== undefined) updateData.minAge = data.minAge;
    if (data.maxAge !== undefined) updateData.maxAge = data.maxAge;
    if (data.ethnicity !== undefined) updateData.ethnicity = data.ethnicity;
    if (data.height !== undefined) updateData.height = data.height;
    if (data.skills !== undefined) updateData.skills = data.skills;
    if (data.otherRequirements !== undefined) updateData.otherRequirements = data.otherRequirements;
    if (data.survey !== undefined) updateData.survey = data.survey;

    const updatedRequirementResult = await supabase
      .from('TalentRequirement')
      .update(updateData)
      .eq('id', roleId)
      .select()
      .single();

    const updatedRequirement = handleDbResult(updatedRequirementResult);

    return NextResponse.json(updatedRequirement);
  } catch (error) {
    console.error("Error updating talent requirement:", error);
    return NextResponse.json({
      error: "Failed to update talent requirement",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// DELETE /api/studio/projects/[id]/talent-requirements/[roleId] - Delete a talent requirement
export async function DELETE(
  request: Request,
  { params }: { params: { id: string, roleId: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: projectId, roleId } = params;

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

    // Find the talent requirement
    const existingRequirementResult = await supabase
      .from('TalentRequirement')
      .select('*')
      .eq('id', roleId)
      .eq('projectId', projectId)
      .single();

    const existingRequirement = handleDbOptional(existingRequirementResult);

    if (!existingRequirement) {
      return NextResponse.json({ error: "Talent requirement not found" }, { status: 404 });
    }

    // Delete the talent requirement
    await supabase
      .from('TalentRequirement')
      .delete()
      .eq('id', roleId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting talent requirement:", error);
    return NextResponse.json({
      error: "Failed to delete talent requirement",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
