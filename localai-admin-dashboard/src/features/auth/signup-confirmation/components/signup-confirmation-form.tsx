import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { sendWelcomeEmail } from '@/lib/email-client';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { CheckCircle, Clock, AlertCircle, Mail } from 'lucide-react';

interface SignupConfirmationFormProps {
  onConfirmationComplete?: () => void;
}

export function SignupConfirmationForm({ onConfirmationComplete }: SignupConfirmationFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [confirmationStatus, setConfirmationStatus] = useState<'pending' | 'confirmed' | 'expired' | 'error'>('pending');
  const [lastSentTime, setLastSentTime] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const navigate = useNavigate();
  
  // Get URL parameters for confirmation token
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token') || '';
  const tokenHash = urlParams.get('token_hash') || '';

  // Cooldown timer effect
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds(cooldownSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Auto-confirm if token is present in URL
  useEffect(() => {
    if (token || tokenHash) {
      handleTokenConfirmation();
    }
  }, [token, tokenHash]);

  const handleTokenConfirmation = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash || token,
        type: 'signup',
      });

      if (error || !data.user) {
        setConfirmationStatus('expired');
        toast.error('Confirmation link is invalid or expired. Please request a new one.');
        return;
      }

      // Send welcome email after successful confirmation
      if (data.user.email) {
        const welcomeResult = await sendWelcomeEmail(
          data.user.email, 
          data.user.user_metadata?.full_name || data.user.email.split('@')[0]
        );
        
        if (!welcomeResult.success) {
          // Welcome email failed to send but don't block signup confirmation
        }
      }

      setConfirmationStatus('confirmed');
      toast.success('Account confirmed successfully! Welcome to FetchText.');
      onConfirmationComplete?.();
      
      // Navigate to dashboard after successful confirmation
      setTimeout(() => {
        navigate({ to: '/dashboard' });
      }, 2000);

    } catch (_error) {
      setConfirmationStatus('error');
      toast.error('An unexpected error occurred during confirmation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds} seconds before resending`);
      return;
    }

    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        toast.error(`Failed to resend confirmation: ${error.message}`);
      } else {
        toast.success('Confirmation email sent! Please check your inbox.');
        setLastSentTime(Date.now());
        setCooldownSeconds(60); // 60-second cooldown
      }
    } catch (_error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  const renderStatusContent = () => {
    switch (confirmationStatus) {
      case 'confirmed':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <div>
              <h3 className="text-lg font-medium text-green-800 dark:text-green-200">
                Account Confirmed!
              </h3>
              <p className="text-sm text-green-600 dark:text-green-300">
                Your account has been successfully activated. Redirecting to dashboard...
              </p>
            </div>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                Confirmation Link Expired
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300">
                Please request a new confirmation email below.
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                Confirmation Failed
              </h3>
              <p className="text-sm text-red-600 dark:text-red-300">
                Something went wrong. Please try again or contact support.
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center space-y-4">
            <Mail className="mx-auto h-12 w-12 text-blue-500" />
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Check Your Email
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We've sent a confirmation link to your email address. Click the link to activate your account.
              </p>
            </div>
          </div>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="text-center space-y-4">
        <Clock className="mx-auto h-12 w-12 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Confirming your account...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderStatusContent()}
      
      {(confirmationStatus === 'pending' || confirmationStatus === 'expired' || confirmationStatus === 'error') && (
        <form onSubmit={handleResendConfirmation} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isResending}
              required
            />
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isResending || cooldownSeconds > 0}
          >
            {isResending ? 'Sending...' : cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Confirmation Email'}
          </Button>
          
          {lastSentTime && (
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              Last sent: {new Date(lastSentTime).toLocaleTimeString()}
            </p>
          )}
        </form>
      )}
      
      {confirmationStatus === 'confirmed' && (
        <div className="text-center">
          <Button
            onClick={() => navigate({ to: '/dashboard' })}
            className="w-full"
          >
            Go to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}

export default SignupConfirmationForm; 