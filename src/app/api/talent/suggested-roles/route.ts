import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// GET /api/talent/suggested-roles - Get suggested roles based on talent profile
export async function GET(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Find the user and their profile
    const userResult = await supabase
      .from('User')
      .select(`
        *,
        Profile (
          *,
          Skill (*),
          regions:ProfileRegion (
            region:Region (*)
          )
        ),
        regionSubscriptions:RegionSubscription (
          *,
          regionPlan:RegionPlan (
            *,
            region:Region (*)
          )
        )
      `)
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);
    
    if (!user?.Profile) {
      return NextResponse.json({ error: "Talent profile not found" }, { status: 404 });
    }
    
    // Get the user's subscribed regions
    const subscribedRegionIds = user.regionSubscriptions
      .filter((sub: any) => sub.status === 'ACTIVE' || sub.status === 'TRIALING')
      .map((sub: any) => sub.regionPlan.region.id);

    if (subscribedRegionIds.length === 0) {
      return NextResponse.json({
        message: "No active region subscriptions found. Subscribe to regions to see suggested roles.",
        suggestedRoles: []
      });
    }

    // Get all locations in the subscribed regions
    const locationsResult = await supabase
      .from('Location')
      .select('id')
      .in('regionId', subscribedRegionIds);

    const locationsInRegions = handleDbResult(locationsResult);
    const locationIds = locationsInRegions.map((loc: any) => loc.id);

    // Get talent profile attributes for matching
    const profile = user.Profile;
    const gender = profile.gender || null;
    const ethnicity = profile.ethnicity || null;
    const height = profile.height || null;
    const skills = profile.Skill?.map((s: any) => s.name.toLowerCase()) || [];

    // Calculate age if available
    let age = null;
    if (profile.dateOfBirth) {
      const birthDate = new Date(profile.dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    // Get all active projects with their casting calls and talent requirements
    // Note: Supabase doesn't support complex OR queries like Prisma, so we need to fetch separately and combine
    const projectsResult = await supabase
      .from('Project')
      .select(`
        *,
        Studio (id, name),
        CastingCall!inner (
          *,
          Location (*),
          Skill (*)
        ),
        talentRequirements:TalentRequirement (*)
      `)
      .eq('isArchived', false)
      .not('status', 'in', '(COMPLETED,CANCELLED)')
      .eq('CastingCall.status', 'OPEN')
      .in('CastingCall.locationId', locationIds);

    const projectsWithCastingCalls = handleDbResult(projectsResult);

    // Also get projects with active talent requirements (but no casting calls in the region)
    const projectsWithRequirementsResult = await supabase
      .from('Project')
      .select(`
        *,
        Studio (id, name),
        talentRequirements:TalentRequirement!inner (*)
      `)
      .eq('isArchived', false)
      .not('status', 'in', '(COMPLETED,CANCELLED)')
      .eq('talentRequirements.isActive', true);

    const projectsWithRequirements = handleDbResult(projectsWithRequirementsResult);

    // Combine and deduplicate projects
    const projectsMap = new Map();
    [...projectsWithCastingCalls, ...projectsWithRequirements].forEach((project: any) => {
      if (!projectsMap.has(project.id)) {
        projectsMap.set(project.id, {
          ...project,
          CastingCall: project.CastingCall || [],
          talentRequirements: project.talentRequirements || []
        });
      } else {
        // Merge casting calls and talent requirements
        const existing = projectsMap.get(project.id);
        if (project.CastingCall) {
          existing.CastingCall = [...(existing.CastingCall || []), ...(Array.isArray(project.CastingCall) ? project.CastingCall : [project.CastingCall])];
        }
        if (project.talentRequirements) {
          existing.talentRequirements = [...(existing.talentRequirements || []), ...(Array.isArray(project.talentRequirements) ? project.talentRequirements : [project.talentRequirements])];
        }
      }
    });

    const projects = Array.from(projectsMap.values());
    
    // Calculate role matches and scores
    const suggestedRoles = [];
    
    for (const project of projects) {
      // Process talent requirements
      for (const requirement of project.talentRequirements) {
        let matchScore = 0;
        const reasons = [];
        
        // Gender match
        if (requirement.gender && gender) {
          if (requirement.gender.toLowerCase() === gender.toLowerCase()) {
            matchScore += 20;
            reasons.push("Gender match");
          }
        } else {
          // No gender requirement or no profile gender (neutral)
          matchScore += 10;
        }
        
        // Age match
        if (age && requirement.minAge && requirement.maxAge) {
          if (age >= parseInt(requirement.minAge) && age <= parseInt(requirement.maxAge)) {
            matchScore += 20;
            reasons.push("Age match");
          }
        } else if (age && requirement.minAge && age >= parseInt(requirement.minAge)) {
          matchScore += 15;
          reasons.push("Above minimum age");
        } else if (age && requirement.maxAge && age <= parseInt(requirement.maxAge)) {
          matchScore += 15;
          reasons.push("Below maximum age");
        } else {
          // No specific age requirement or no profile age (neutral)
          matchScore += 10;
        }
        
        // Ethnicity match
        if (requirement.ethnicity && ethnicity) {
          if (requirement.ethnicity.toLowerCase() === ethnicity.toLowerCase() ||
              requirement.ethnicity.toLowerCase().includes(ethnicity.toLowerCase()) ||
              ethnicity.toLowerCase().includes(requirement.ethnicity.toLowerCase())) {
            matchScore += 15;
            reasons.push("Ethnicity match");
          }
        } else {
          // No ethnicity requirement or no profile ethnicity (neutral)
          matchScore += 5;
        }
        
        // Height match (simplified)
        if (requirement.height && height) {
          matchScore += 10;
          reasons.push("Height considered");
        }
        
        // Skills match
        if (requirement.skills && skills.length > 0) {
          const requiredSkills = requirement.skills.toLowerCase().split(',').map(s => s.trim());
          const matchingSkills = skills.filter(skill => 
            requiredSkills.some(reqSkill => skill.includes(reqSkill) || reqSkill.includes(skill))
          );
          
          if (matchingSkills.length > 0) {
            const skillScore = Math.min(25, matchingSkills.length * 5);
            matchScore += skillScore;
            reasons.push(`${matchingSkills.length} matching skills`);
          }
        }
        
        // Only include roles with a decent match score
        if (matchScore >= 30) {
          suggestedRoles.push({
            id: requirement.id,
            projectId: project.id,
            projectTitle: project.title,
            studioId: project.Studio.id,
            studioName: project.Studio.name,
            role: {
              id: requirement.id,
              title: requirement.title,
              description: requirement.description,
              gender: requirement.gender,
              ageRange: requirement.minAge || requirement.maxAge 
                ? `${requirement.minAge || ''} - ${requirement.maxAge || ''}`
                : null,
              skills: requirement.skills,
              survey: requirement.survey
            },
            matchScore,
            matchReasons: reasons,
            type: 'requirement',
            locations: project.CastingCall.map(call => ({
              id: call.Location?.id,
              name: call.Location?.name
            })).filter((loc, index, self) => 
              loc.id && self.findIndex(l => l.id === loc.id) === index
            )
          });
        }
      }
      
      // Also include active casting calls as potential roles
      for (const castingCall of project.CastingCall) {
        let matchScore = 40; // Base score for open casting calls in subscribed regions
        const reasons = ["In your subscribed region"];
        
        // Skills match if available
        if ('Skill' in castingCall && castingCall.Skill && Array.isArray(castingCall.Skill) && castingCall.Skill.length > 0 && skills.length > 0) {
          const castingSkills = castingCall.Skill.map((s: { name: string }) => s.name.toLowerCase());
          const matchingSkills = skills.filter(skill =>
            castingSkills.some((castSkill: string) => skill.includes(castSkill) || castSkill.includes(skill))
          );
          
          if (matchingSkills.length > 0) {
            const skillScore = Math.min(25, matchingSkills.length * 5);
            matchScore += skillScore;
            reasons.push(`${matchingSkills.length} matching skills`);
          }
        }
        
        suggestedRoles.push({
          id: castingCall.id,
          projectId: project.id,
          projectTitle: project.title,
          studioId: project.Studio.id,
          studioName: project.Studio.name,
          role: {
            id: castingCall.id,
            title: castingCall.title,
            description: castingCall.description,
            requirements: castingCall.requirements
          },
          matchScore,
          matchReasons: reasons,
          type: 'castingCall',
          location: castingCall.Location ? {
            id: castingCall.Location.id,
            name: castingCall.Location.name
          } : null
        });
      }
    }
    
    // Sort by match score (highest first)
    suggestedRoles.sort((a: any, b: any) => b.matchScore - a.matchScore);

    return NextResponse.json({
      suggestedRoles,
      subscribedRegions: user.regionSubscriptions.map((sub: any) => ({
        id: sub.regionPlan.region.id,
        name: sub.regionPlan.region.name
      }))
    });
  } catch (error) {
    console.error("Error fetching suggested roles:", error);
    return NextResponse.json({
      error: "Failed to fetch suggested roles",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}