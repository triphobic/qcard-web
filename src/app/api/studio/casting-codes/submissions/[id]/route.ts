import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { db, handleDbOptional, handleDbResult, now } from '@/lib/supabase-db';
import { z } from 'zod';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Schema for validation
const updateSubmissionSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CONVERTED']),
});

// PATCH - Update a submission status
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

    // Find the submission and verify it belongs to this studio
    const submissionResult = await supabase
      .from('CastingSubmission')
      .select(`
        *,
        CastingCode:castingCode!inner (
          studioId
        )
      `)
      .eq('id', params.id)
      .single();

    const submission = handleDbOptional(submissionResult);

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Check if the submission belongs to the studio
    if (submission.CastingCode.studioId !== studio.id) {
      return NextResponse.json({ error: 'Not authorized to update this submission' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateSubmissionSchema.parse(body);

    // Update the submission
    const updatedSubmissionResult = await supabase
      .from('CastingSubmission')
      .update({
        status: validatedData.status,
        updatedAt: now(),
      })
      .eq('id', params.id)
      .select()
      .single();

    const updatedSubmission = handleDbResult(updatedSubmissionResult);

    return NextResponse.json(updatedSubmission);
  } catch (error) {
    console.error('Error updating submission:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.format() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update submission' },
      { status: 500 }
    );
  }
}
