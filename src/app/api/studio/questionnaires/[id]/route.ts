import { NextResponse } from 'next/server';
import { getSession, getStudioIdFromSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studioId = await getStudioIdFromSession();
    
    if (!studioId) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Return a placeholder response for now
    return NextResponse.json({ 
      id: params.id,
      title: "Example Questionnaire",
      description: "This is a placeholder questionnaire",
      isActive: true,
      requiresApproval: false,
      studioId: studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: []
    });
  } catch (error) {
    console.error('Error fetching questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questionnaire' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const studioId = await getStudioIdFromSession();
    
    if (!studioId) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Return a success response without actually updating the questionnaire
    return NextResponse.json({ 
      id: params.id,
      title: "Example Questionnaire",
      description: "This is a placeholder questionnaire",
      isActive: true,
      requiresApproval: false,
      studioId: studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questions: []
    });
  } catch (error) {
    console.error('Error updating questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to update questionnaire' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    
    if (!session?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const studioId = await getStudioIdFromSession();
    
    if (!studioId) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Return a success response without actually deleting the questionnaire
    return NextResponse.json({ 
      success: true,
      message: "Questionnaire deleted successfully"
    });
  } catch (error) {
    console.error('Error deleting questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to delete questionnaire' },
      { status: 500 }
    );
  }
}