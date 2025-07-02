import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { sendPasswordResetEmail } from '@/lib/email-client';
import { toast } from 'sonner';

interface ForgotPasswordFormProps {
  onEmailSent?: (email: string) => void;
}

export function ForgotPasswordForm({ onEmailSent }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [errors, setErrors] = useState<{ email?: string }>({});

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
      // Generate a simple reset token (you could store this in a database or use a more secure method)
      const resetToken = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Use our custom SendGrid email service
      const emailResult = await sendPasswordResetEmail(email, resetToken);

      if (!emailResult.success) {
        // Fallback to Supabase built-in email if SendGrid fails
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
          toast.error(`Reset failed: ${error.message}`);
          return;
        }
      }

      toast.success('Password reset email sent! Check your inbox.');
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
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="Enter your email"
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
        {isLoading ? 'Sending...' : cooldownTime > 0 ? `Wait ${cooldownTime}s` : 'Send Reset Link'}
      </Button>
      
      {cooldownTime > 0 && (
        <p className="text-sm text-gray-500 text-center">
          Please wait before requesting another reset
        </p>
      )}
    </form>
  );
}

export default ForgotPasswordForm;
