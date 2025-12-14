'use client';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from '@/hooks/useSupabaseAuth';
import Button from '@/components/ui/button';
import Card, { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Badge from '@/components/ui/badge';
import Spinner from '@/components/ui/spinner';
import { PlusCircle, ClipboardList, Send, CheckCircle, XCircle } from 'lucide-react';

// Define TypeScript interfaces
interface CastingSurvey {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    questions: number;
    invitations: number;
    responses: number;
  };
}

export default function CastingSurveysPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [castingSurveys, setCastingSurveys] = useState<CastingSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/sign-in');
      return;
    }

    const fetchCastingSurveys = async () => {
      try {
        const response = await fetch('/api/studio/casting-surveys');

        if (!response.ok) {
          throw new Error('Failed to fetch casting surveys');
        }

        const data = await response.json();
        setCastingSurveys(data);
      } catch (err) {
        console.error('Error fetching casting surveys:', err);
        setError('Failed to load casting surveys. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCastingSurveys();
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="md" />
        <span className="ml-2">Loading casting surveys...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Casting Surveys</h1>
          <p className="text-muted-foreground">Create and manage custom forms to gather information from talent</p>
        </div>
        <Link href="/studio/casting-surveys/new">
          <Button className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New Casting Survey
          </Button>
        </Link>
      </div>

      {castingSurveys.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-lg">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">No casting surveys yet</h2>
          <p className="text-muted-foreground mb-6">
            Create your first casting survey to gather information from talent.
          </p>
          <Link href="/studio/casting-surveys/new">
            <Button>Create Casting Survey</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {castingSurveys.map((survey) => (
            <Card key={survey.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="truncate">{survey.title}</CardTitle>
                  <Badge variant={survey.isActive ? "default" : "secondary"}>
                    {survey.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {survey.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex gap-4 text-sm">
                  <div className="flex items-center">
                    <ClipboardList className="h-4 w-4 mr-1" />
                    <span>{survey._count?.questions || 0} Questions</span>
                  </div>
                  <div className="flex items-center">
                    <Send className="h-4 w-4 mr-1" />
                    <span>{survey._count?.invitations || 0} Invites</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    <span>{survey._count?.responses || 0} Responses</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between pt-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Created {new Date(survey.createdAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2">
                  <Link href={`/studio/casting-surveys/${survey.id}`}>
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                  <Link href={`/studio/casting-surveys/${survey.id}/invitations`}>
                    <Button size="sm">Invite Talents</Button>
                  </Link>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}