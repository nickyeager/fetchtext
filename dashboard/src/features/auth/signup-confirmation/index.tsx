import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignupConfirmationForm } from './components/signup-confirmation-form';

export function SignupConfirmation() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Confirm Your Account
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Click the link in your email to activate your FetchText account
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Account Confirmation</CardTitle>
            <CardDescription>
              Verify your email address to complete signup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupConfirmationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SignupConfirmation; 