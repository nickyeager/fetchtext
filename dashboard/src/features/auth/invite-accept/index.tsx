/**
 * Invite Accept Page
 *
 * Handles organization invitation acceptance from email links.
 * URL format: /invite/accept?token=xxx
 *
 * Flow:
 * 1. Look up invitation by token
 * 2. If not authenticated, redirect to login with return URL
 * 3. If authenticated, verify email matches and accept invitation
 * 4. Redirect to organization dashboard
 */

import { useEffect, useState } from 'react';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/auth-context';
import { OrganizationService } from '@/lib/organization-service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, Users } from 'lucide-react';

type InviteStatus = 'loading' | 'needs-auth' | 'not-found' | 'expired' | 'email-mismatch' | 'ready' | 'accepting' | 'success' | 'error';

interface InvitationDetails {
  id: string;
  organizationName: string;
  inviterEmail: string;
  role: string;
  email: string;
}

export function InviteAcceptPage() {
  const { token, email: inviteEmail } = useSearch({ from: '/invite/accept' });
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<InviteStatus>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-redirect to sign-up when not authenticated
  useEffect(() => {
    if (status === 'needs-auth' && token) {
      // Include email in return URL and pass to sign-up for prefilling
      const returnUrl = inviteEmail
        ? `/invite/accept?token=${token}&email=${encodeURIComponent(inviteEmail)}`
        : `/invite/accept?token=${token}`;
      navigate({ to: '/sign-up', search: { redirect: returnUrl, email: inviteEmail || '' } });
    }
  }, [status, token, inviteEmail, navigate]);

  // Load invitation details on mount
  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setStatus('not-found');
        setErrorMessage('No invitation token provided');
        return;
      }

      // If user is not authenticated, redirect to sign-up
      // The RLS policy only allows users to see invitations sent to their email
      if (!user) {
        setStatus('needs-auth');
        return;
      }

      try {
        const result = await OrganizationService.getInvitationByToken(token);

        if (!result) {
          setStatus('not-found');
          setErrorMessage('Invitation not found or has already been used');
          return;
        }

        // Check if expired
        if (new Date(result.expires_at) < new Date()) {
          setStatus('expired');
          setErrorMessage('This invitation has expired');
          return;
        }

        // Check if status is still pending
        if (result.status !== 'pending') {
          setStatus('not-found');
          setErrorMessage('This invitation has already been processed');
          return;
        }

        setInvitation({
          id: result.id,
          organizationName: result.organization?.name || 'Unknown Organization',
          inviterEmail: result.inviter?.email || 'A team member',
          role: result.role,
          email: result.email,
        });

        // Check if email matches
        if (user.email?.toLowerCase() !== result.email.toLowerCase()) {
          setStatus('email-mismatch');
          setErrorMessage(
            `This invitation was sent to ${result.email}. You are currently logged in as ${user.email}. Please log out and sign in with the correct account.`
          );
          return;
        }

        setStatus('ready');
      } catch (error) {
        console.error('Error loading invitation:', error);
        setStatus('error');
        setErrorMessage('Failed to load invitation details');
      }
    }

    loadInvitation();
  }, [token, user]);

  const handleAccept = async () => {
    if (!invitation) return;

    setStatus('accepting');

    try {
      await OrganizationService.acceptInvitationByToken(token);
      setStatus('success');

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate({ to: '/dashboard' });
      }, 2000);
    } catch (error) {
      console.error('Error accepting invitation:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to accept invitation');
    }
  };

  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
    // Page will re-render with user = null
  };

  // Render based on status
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Team Invitation</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Loading invitation details...'}
            {status === 'needs-auth' && 'Sign in to view your invitation'}
            {status === 'not-found' && 'Invitation Not Found'}
            {status === 'expired' && 'Invitation Expired'}
            {status === 'email-mismatch' && 'Email Mismatch'}
            {status === 'ready' && invitation && `Join ${invitation.organizationName}`}
            {status === 'accepting' && 'Processing...'}
            {status === 'success' && 'Welcome to the team!'}
            {status === 'error' && 'Something went wrong'}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === 'needs-auth' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Redirecting to create your account...
              </p>
            </div>
          )}

          {(status === 'not-found' || status === 'expired' || status === 'error') && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {status === 'email-mismatch' && (
            <>
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
              <Button onClick={handleLogout} variant="outline" className="w-full">
                Log out and try again
              </Button>
            </>
          )}

          {status === 'ready' && invitation && (
            <>
              <div className="rounded-lg border bg-muted/50 p-4 text-sm">
                <p>
                  <strong>{invitation.inviterEmail}</strong> has invited you to join{' '}
                  <strong>{invitation.organizationName}</strong> as a{' '}
                  <strong>{invitation.role}</strong>.
                </p>
              </div>

              <Button onClick={handleAccept} className="w-full">
                Accept Invitation
              </Button>
            </>
          )}

          {status === 'accepting' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">Accepting invitation...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="mt-4 text-center text-sm text-muted-foreground">
                You've successfully joined {invitation?.organizationName}. Redirecting to dashboard...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default InviteAcceptPage;
