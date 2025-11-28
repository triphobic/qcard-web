import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validation
const castingCodeSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  description: z.string().optional(),
  projectId: z.string().uuid().optional(),
  expiresAt: z.string().datetime().optional(),
  surveyFields: z.any().optional(),
});

// Helper function to generate a unique code
const generateUniqueCode = async (): Promise<string> => {
  const supabase = db();
  // Generate a random 6-character alphanumeric code
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;

  // Keep trying until we find a unique code
  while (true) {
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    code = result;

    // Check if this code already exists
    const existingCodeResult = await supabase
      .from('CastingCode')
      .select('code')
      .eq('code', code)
      .single();

    const existingCode = handleDbOptional(existingCodeResult);

    if (!existingCode) {
      break;
    }
  }

  return code;
};

// GET - List all casting codes for studio
export async function GET(request: Request) {
  try {
    const supabase = db();
    const session = await getSession();

    if (!session || !session.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get studio ID from user's tenant
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    // Add filtering options
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const isActive = searchParams.get('isActive');

    // Build query
    let query = supabase
      .from('CastingCode')
      .select(`
        *,
        Project:project!castingCode_projectId_fkey (
          title
        ),
        CastingSubmission:submissions (
          id
        )
      `)
      .eq('studioId', studio.id)
      .order('createdAt', { ascending: false });

    if (projectId) {
      query = query.eq('projectId', projectId);
    }

    if (isActive !== null) {
      query = query.eq('isActive', isActive === 'true');
    }

    const castingCodesResult = await query;
    const castingCodes = handleDbResult(castingCodesResult);

    return NextResponse.json(castingCodes);
  } catch (error) {
    console.error('Error fetching casting codes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch casting codes' },
      { status: 500 }
    );
  }
}

// POST - Create a new casting code
export async function POST(request: Request) {
  try {
    const supabase = db();
    console.log("POST /api/studio/casting-codes: Received request");
    const session = await getSession();

    if (!session || !session.profile) {
      console.log("POST /api/studio/casting-codes: Unauthorized - no session or user");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("POST /api/studio/casting-codes: Authenticated as user ID:", session.profile.id);

    // Get studio ID from user's tenant
    const userResult = await supabase
      .from('User')
      .select('*, Tenant(*)')
      .eq('id', session.profile.id)
      .single();

    const user = handleDbOptional(userResult);

    console.log("POST /api/studio/casting-codes: Found user:", user?.id, "with tenant type:", user?.Tenant?.type);

    if (!user?.Tenant || user.Tenant.type !== 'STUDIO') {
      console.log("POST /api/studio/casting-codes: Not authorized - not a studio user");
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const studioResult = await supabase
      .from('Studio')
      .select('*')
      .eq('tenantId', user.tenantId!)
      .single();

    const studio = handleDbOptional(studioResult);

    if (!studio) {
      console.log("POST /api/studio/casting-codes: Studio not found for tenant ID:", user.tenantId);
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    console.log("POST /api/studio/casting-codes: Found studio ID:", studio.id);

    // Parse and validate request body
    const body = await request.json();
    console.log("POST /api/studio/casting-codes: Request body:", body);

    try {
      const validatedData = castingCodeSchema.parse(body);
      console.log("POST /api/studio/casting-codes: Validated data:", validatedData);

      // Check if projectId is valid if provided
      if (validatedData.projectId) {
        console.log("POST /api/studio/casting-codes: Checking project ID:", validatedData.projectId);
        const projectResult = await supabase
          .from('Project')
          .select('*')
          .eq('id', validatedData.projectId)
          .eq('studioId', studio.id)
          .single();

        const project = handleDbOptional(projectResult);

        if (!project) {
          console.log("POST /api/studio/casting-codes: Project not found or not owned by this studio");
          return NextResponse.json(
            { error: 'Project not found or not owned by this studio' },
            { status: 404 }
          );
        }

        console.log("POST /api/studio/casting-codes: Project verified:", project.id);
      }

      // Generate a unique code
      console.log("POST /api/studio/casting-codes: Generating unique code");
      const code = await generateUniqueCode();
      console.log("POST /api/studio/casting-codes: Generated code:", code);

      // Create the casting code
      console.log("POST /api/studio/casting-codes: Creating casting code in database");
      const timestamp = now();

      const castingCodeResult = await supabase
        .from('CastingCode')
        .insert({
          code,
          name: validatedData.name,
          description: validatedData.description || null,
          studioId: studio.id,
          projectId: validatedData.projectId || null,
          surveyFields: body.surveyFields || { fields: [] },
          expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt).toISOString() : null,
          updatedAt: timestamp,
          isActive: true,
        })
        .select()
        .single();

      const castingCode = handleDbResult(castingCodeResult);

      console.log("POST /api/studio/casting-codes: Successfully created casting code:", castingCode.id);
      return NextResponse.json(castingCode);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        console.log("POST /api/studio/casting-codes: Validation error:", validationError.format());
        return NextResponse.json(
          { error: 'Validation error', details: validationError.format() },
          { status: 400 }
        );
      }
      throw validationError;
    }
  } catch (error) {
    console.error('Error creating casting code:', error);

    return NextResponse.json(
      { error: 'Failed to create casting code', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
