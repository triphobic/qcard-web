'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSupabaseAuth';
import Button from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';

export default function CastingSurveyPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="md" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    router.push('/sign-in');
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <Link href="/studio/casting-surveys" className="flex items-center">
          Back to Casting Surveys
        </Link>
      </div>
      
      <div className="text-center py-12 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Casting Survey Details</h2>
        <p className="mb-6">
          This feature is currently being implemented.
        </p>
        <div className="space-x-4">
          <Link href="/studio/casting-surveys">
            <Button>Back to Casting Surveys</Button>
          </Link>
          <Link href={`/studio/casting-surveys/${params.id}/questions/new`}>
            <Button>Add Question</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}