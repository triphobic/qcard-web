import { NextResponse } from 'next/server';
import { getSession, getStudioIdFromSession } from '@/lib/supabase-auth';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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
    return NextResponse.json([
      {
        id: "placeholder-1",
        title: "Example Questionnaire 1",
        description: "This is a placeholder questionnaire",
        isActive: true,
        requiresApproval: false,
        studioId: studioId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: {
          questions: 5,
          invitations: 3,
          responses: 2
        }
      },
      {
        id: "placeholder-2",
        title: "Example Questionnaire 2",
        description: "This is another placeholder questionnaire",
        isActive: false,
        requiresApproval: true,
        studioId: studioId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _count: {
          questions: 3,
          invitations: 0,
          responses: 0
        }
      }
    ]);
  } catch (error) {
    console.error('Error fetching questionnaires:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questionnaires' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    
    if (!session?.profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const studioId = await getStudioIdFromSession();
    
    if (!studioId) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }
    
    // Return a success response without actually creating a questionnaire
    return NextResponse.json({
      id: "placeholder-new-questionnaire",
      title: "New Questionnaire",
      description: "This is a placeholder questionnaire",
      isActive: true,
      requiresApproval: false,
      studioId: studioId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating questionnaire:', error);
    return NextResponse.json(
      { error: 'Failed to create questionnaire' },
      { status: 500 }
    );
  }
}