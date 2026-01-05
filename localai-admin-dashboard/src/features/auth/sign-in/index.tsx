import { Link, useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users } from 'lucide-react'
import AuthLayout from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export default function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' });
  const isInviteFlow = redirect?.includes('/invite/accept')

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>Login</CardTitle>
          <CardDescription>
            Enter your email and password below to <br />
            log into your account. Don't have an account?{' '}
            <Link
              to='/sign-up'
              search={redirect ? { redirect } : undefined}
              className='hover:text-primary underline underline-offset-4'
            >
              Sign Up
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInviteFlow && (
            <Alert className="mb-4 border-primary/50 bg-primary/5">
              <Users className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join a team! Sign in with the email address that received the invitation to accept.
              </AlertDescription>
            </Alert>
          )}
          <UserAuthForm />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By clicking login, you agree to our{' '}
            <a
              href='/terms'
              className='hover:text-primary underline underline-offset-4'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='hover:text-primary underline underline-offset-4'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
