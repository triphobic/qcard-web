import { db, handleDbOptional, handleDbResult, generateId, now } from '@/lib/supabase-db';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/supabase-auth';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

// POST /api/talent/profile/images - Upload profile images
export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.profile?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = db();

    // Get user profile
    const profileResult = await supabase
      .from('Profile')
      .select('id')
      .eq('userId', session.profile.id)
      .single();

    const profile = handleDbOptional(profileResult);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get profile images count
    const profileImagesResult = await supabase
      .from('ProfileImage')
      .select('id', { count: 'exact', head: true })
      .eq('profileId', profile.id);

    const profileImagesCount = profileImagesResult.count || 0;

    // Check if already has 10 images
    if (profileImagesCount >= 10) {
      return NextResponse.json(
        { error: "Maximum number of images (10) already reached" },
        { status: 400 }
      );
    }

    // Process multipart form data
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    // Limit the number of files
    const remainingSlots = 10 - profileImagesCount;
    if (files.length > remainingSlots) {
      return NextResponse.json(
        { error: `You can only upload ${remainingSlots} more images` },
        { status: 400 }
      );
    }

    // Process images one by one to provide better error handling
    const uploadedImages = [];

    for (const file of files) {
      try {
        // Generate unique filename
        const fileName = `${generateId()}-${file.name.replace(/\s+/g, '-')}`;
        const buffer = Buffer.from(await file.arrayBuffer());

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');

        // Ensure the uploads directory exists
        if (!existsSync(uploadsDir)) {
          console.log("Creating uploads directory at", uploadsDir);
          await mkdir(uploadsDir, { recursive: true });
        }

        // Write the file
        console.log(`Writing file ${fileName} to ${uploadsDir}`);
        await writeFile(path.join(uploadsDir, fileName), buffer);

        // Determine if this should be the primary image
        const isPrimary: boolean = profileImagesCount === 0 && uploadedImages.length === 0;

        // Generate a unique ID for the image
        const imageId = generateId();
        const timestamp = now();

        console.log(`Creating database record for image ${imageId}`);

        // Create image record in database
        const imageRecordResult = await supabase
          .from('ProfileImage')
          .insert({
            id: imageId,
            profileId: profile.id,
            url: `/uploads/${fileName}`,
            isPrimary,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .select()
          .single();

        const imageRecord = handleDbResult(imageRecordResult);

        uploadedImages.push(imageRecord);
        console.log(`Successfully processed image: ${fileName}`);
      } catch (error) {
        console.error(`Error processing image ${file.name}:`, error);
        // Continue with next image
      }
    }

    return NextResponse.json(uploadedImages, { status: 201 });
  } catch (error) {
    console.error("Error uploading images:", error);

    // Provide more detailed error info
    let errorMessage = "Failed to upload images";
    let errorDetails = null;

    if (error instanceof Error) {
      if (error.message.includes("EACCES") || error.message.includes("permission denied")) {
        errorMessage = "Permission denied when writing files";
        errorDetails = "The server does not have permission to write to the uploads directory";
      } else if (error.message.includes("ENOENT")) {
        errorMessage = "Directory not found";
        errorDetails = "Could not find or create the uploads directory";
      }
    }

    return NextResponse.json({
      error: errorMessage,
      details: errorDetails,
      originalError: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
