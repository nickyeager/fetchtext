import { Link, useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users } from 'lucide-react'
import AuthLayout from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export default function SignUp() {
  const { redirect, email } = useSearch({ from: '/(auth)/sign-up' })
  const isInviteFlow = redirect?.includes('/invite/accept')

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Create an account
          </CardTitle>
          <CardDescription>
            Enter your email and password to create an account. <br />
            Already have an account?{' '}
            <Link
              to='/sign-in'
              search={redirect ? { redirect } : undefined}
              className='hover:text-primary underline underline-offset-4'
            >
              Sign In
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isInviteFlow && (
            <Alert className="mb-4 border-primary/50 bg-primary/5">
              <Users className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join a team! Create an account with the email address that received the invitation to accept.
              </AlertDescription>
            </Alert>
          )}
          <SignUpForm defaultEmail={email} isInviteFlow={isInviteFlow} />
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <p className='text-muted-foreground px-8 text-center text-sm'>
            By creating an account, you agree to our{' '}
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
          <div className="w-full text-center">
            <p className="text-sm text-muted-foreground mb-2">
              Already have an account?
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/sign-in">
                Sign In to Your Account
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
