import { db, handleDbOptional, handleDbResult } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { unlink } from 'fs/promises';
import path from 'path';

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

// DELETE /api/talent/profile/images/[id] - Delete a profile image
export async function DELETE(
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

    // Get the image to delete
    const imageResult = await supabase
      .from('ProfileImage')
      .select('id, url, isPrimary, profileId')
      .eq('id', id)
      .single();

    const image = handleDbOptional(imageResult);

    if (!image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Delete the image file from the server
    try {
      const filePath = path.join(process.cwd(), 'public', (image as any).url.replace(/^\//, ''));
      await unlink(filePath);
    } catch (error) {
      console.error("Error deleting file:", error);
      // Continue even if file deletion fails
    }

    // Check if this is a primary image
    const isPrimary = (image as any).isPrimary;

    // Delete image from database
    await supabase
      .from('ProfileImage')
      .delete()
      .eq('id', id);

    // If this was the primary image, set another image as primary
    if (isPrimary) {
      const profileImagesResult = await supabase
        .from('ProfileImage')
        .select('id')
        .eq('profileId', (image as any).profileId)
        .order('createdAt', { ascending: false })
        .limit(1);

      const profileImages = handleDbResult(profileImagesResult);

      if (profileImages.length > 0) {
        await supabase
          .from('ProfileImage')
          .update({ isPrimary: true })
          .eq('id', profileImages[0].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json({ error: "Failed to delete image" }, { status: 500 });
  }
}
