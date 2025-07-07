import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, AlertTriangle, Info } from 'lucide-react';

interface ResetPasswordFormProps {
  onResetComplete?: () => void;
}

export function ResetPasswordForm({ onResetComplete: _onResetComplete }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; session?: string }>({});
  const [email, setEmail] = useState('');
  const [hasValidSession, setHasValidSession] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const navigate = useNavigate();
  
  useEffect(() => {
    // Check for valid password reset session
    const checkSession = async () => {
      try {
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const emailFromUrl = urlParams.get('email');
        
        // Check for Supabase auth session (from resetPasswordForEmail)
        const { data: session } = await supabase.auth.getSession();
        
        if (session?.session) {
          // We have a valid session from password reset
          setHasValidSession(true);
          setEmail(session.session.user?.email || emailFromUrl || '');
        } else {
          // Check for URL hash parameters (Supabase sometimes uses these)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const tokenType = hashParams.get('type');
          
          if (accessToken && refreshToken && tokenType === 'recovery') {
            // Set the session from URL parameters
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (!error) {
              setHasValidSession(true);
              // Get the user email from the session
              const { data: user } = await supabase.auth.getUser();
              setEmail(user.user?.email || emailFromUrl || '');
            } else {
              setErrors({ session: 'Invalid or expired reset link.' });
            }
          } else if (emailFromUrl) {
            // Fall back to email-based validation (simple time check)
            const timestamp = urlParams.get('t');
            if (timestamp) {
              const linkAge = Date.now() - parseInt(timestamp);
              const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
              
              if (linkAge < oneHour) {
                // Link is less than 1 hour old, consider it valid
                setHasValidSession(true);
                setEmail(emailFromUrl);
              } else {
                setErrors({ session: 'Reset link has expired. Please request a new one.' });
              }
            } else {
              setErrors({ session: 'Invalid reset link. Please request a new one.' });
            }
          } else {
            setErrors({ session: 'Invalid reset link. Please request a new password reset.' });
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error checking session:', error);
        setErrors({ session: 'Unable to validate reset link. Please try again.' });
      } finally {
        setIsCheckingSession(false);
      }
    };
    
    checkSession();
  }, []);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return 'Password must contain uppercase, lowercase, and number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});
    
    // Check if we have a valid session
    if (!hasValidSession) {
      toast.error('Invalid reset session. Please request a new password reset.');
      navigate({ to: '/forgot-password' });
      return;
    }
    
    // Validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrors({ password: passwordError });
      return;
    }
    
    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    setIsLoading(true);
    
    try {
      // Use Supabase's built-in updateUser method (works with valid session)
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast.error(`Failed to update password: ${error.message}`);
      } else {
        toast.success('Password updated successfully! You can now sign in.');
        navigate({ to: '/sign-in' });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Password reset error:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">
            <p>Validating reset link...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasValidSession) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {errors.session || 'This password reset link is invalid or has expired. Please request a new password reset.'}
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button 
              onClick={() => navigate({ to: '/forgot-password' })}
              className="w-full"
            >
              Request New Reset Link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="pt-6">
        {email && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Resetting password for: <strong>{email}</strong>
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className={errors.confirmPassword ? 'border-red-500 pr-10' : 'pr-10'}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-red-500">{errors.confirmPassword}</p>
            )}
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Updating...' : 'Reset Password'}
          </Button>
          
          <div className="text-sm text-gray-500">
            <p>Password must contain:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>At least 8 characters</li>
              <li>Uppercase and lowercase letters</li>
              <li>At least one number</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default ResetPasswordForm; 