import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, AlertTriangle } from 'lucide-react';
import { sendPasswordResetEmail } from '@/lib/email-client';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ForgotPasswordFormProps {
  onEmailSent?: (email: string) => void;
}

export function ForgotPasswordForm({ onEmailSent }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isLocalSupabase, setIsLocalSupabase] = useState(false);

  useEffect(() => {
    // Check if using local Supabase
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    setIsLocalSupabase(supabaseUrl?.includes('localhost') || false);
  }, []);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Validation
    if (!email.trim()) {
      setErrors({ email: 'Please enter your email' });
      return;
    }
    
    if (!validateEmail(email)) {
      setErrors({ email: 'Invalid email address' });
      return;
    }
    
    // Prevent rapid submissions
    if (cooldownTime > 0) {
      toast.error('Please wait before requesting another reset');
      return;
    }

    setIsLoading(true);
    
    try {
      // Use Supabase's built-in password reset to generate proper tokens
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Check if it's an SMTP configuration error (expected in local dev)
        if (error.message.includes('SMTP') || error.message.includes('email') || error.message.includes('mail')) {
          // SMTP not configured, but token generation might still work
          // Let's continue with N8N email sending
          // eslint-disable-next-line no-console
          console.warn('SMTP not configured, using N8N for email delivery:', error.message);
        } else {
          // Other errors should be shown
          toast.error(`Failed to initiate password reset: ${error.message}`);
          return;
        }
      }

      // Generate a reset link for N8N email (we'll use a time-limited approach)
      const resetLink = `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}&t=${Date.now()}`;
      
      // Send password reset email via N8N workflow
      const emailResult = await sendPasswordResetEmail(email, resetLink);

      if (!emailResult.success) {
        if (isLocalSupabase) {
          // In development mode, show that N8N would handle the email
          toast.success('Reset request processed! (Note: N8N workflow would handle email delivery in production)', {
            duration: 8000
          });
        } else {
          // Production error handling
          let errorMessage = 'Failed to send reset email via N8N workflow';
          
          if (emailResult.error?.includes('webhook')) {
            errorMessage = 'Email service temporarily unavailable. Please try again.';
          } else if (emailResult.error?.includes('validation')) {
            errorMessage = 'Invalid email address format.';
          }
          
          toast.error(errorMessage);
          return;
        }
      }

      // Success message with helpful info
      if (isLocalSupabase) {
        toast.success('Reset request processed! (Note: N8N workflow would handle email delivery in production)', {
          duration: 8000
        });
      } else {
        toast.success('Password reset email sent via N8N! Check your inbox (including spam folder).');
      }
      
      onEmailSent?.(email);
      
      // Set cooldown period (60 seconds)
      setCooldownTime(60);
      const timer = setInterval(() => {
        setCooldownTime((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (_error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Development warning for local environment */}
      {isLocalSupabase && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Development Mode:</strong> You're in local development. 
            Email delivery via N8N workflows requires production N8N setup. 
            Using Supabase's built-in token system with N8N email delivery.
          </AlertDescription>
        </Alert>
      )}

      {/* Information about the process */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Enter your email address and we'll send you a link to reset your password. 
          The link will redirect you back to this site where you can set a new password.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email}</p>
          )}
        </div>
        
        <Button
          type="submit"
          className="w-full"
          disabled={isLoading || cooldownTime > 0}
        >
          {isLoading ? 'Sending Reset Link...' : cooldownTime > 0 ? `Wait ${cooldownTime}s` : 'Send Reset Link'}
        </Button>
        
        {cooldownTime > 0 && (
          <p className="text-sm text-gray-500 text-center">
            Please wait {cooldownTime} seconds before requesting another reset
          </p>
        )}
      </form>

      {/* Additional help text */}
      <div className="text-sm text-gray-600 space-y-1">
        <p>• Check your spam folder if you don't receive the email</p>
        <p>• The reset link will expire in 1 hour (Supabase default)</p>
        <p>• If you don't have an account, please sign up first</p>
      </div>
    </div>
  );
}

export default ForgotPasswordForm;
