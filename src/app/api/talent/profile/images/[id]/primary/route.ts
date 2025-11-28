import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// Helper function to check if a user owns the image
async function userOwnsImage(userId: string, imageId: string) {
  const supabase = db();

  const imageResult = await supabase
    .from('ProfileImage')
    .select(`
      id,
      Profile (
        id,
        User (
          id
        )
      )
    `)
    .eq('id', imageId)
    .single();

  const image = handleDbOptional(imageResult);

  return (image as any)?.Profile?.User?.id === userId;
}

// PATCH /api/talent/profile/images/[id]/primary - Set an image as primary
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();
    const { id } = params;

    // Verify ownership
    if (!(await userOwnsImage(session.profile.id, id))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get the image
    const imageResult = await supabase
      .from('ProfileImage')
      .select(`
        id,
        profileId,
        Profile (
          id
        )
      `)
      .eq('id', id)
      .single();

    const image = handleDbOptional(imageResult);

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // First, unset primary status for all images in this profile
    await supabase
      .from('ProfileImage')
      .update({ isPrimary: false })
      .eq('profileId', (image as any).profileId);

    // Set this image as primary
    await supabase
      .from('ProfileImage')
      .update({ isPrimary: true })
      .eq('id', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting primary image:", error);
    return NextResponse.json({ error: "Failed to set primary image" }, { status: 500 });
  }
}
