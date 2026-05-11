import { useEffect, useState } from 'react'
import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { IconArrowUpRight, IconLoader2 } from '@tabler/icons-react'
import { SignedIn, useAuth, UserButton } from '@clerk/clerk-react'
import { ClerkLogo } from '@/assets/clerk-logo'
import { Button } from '@/components/ui/button'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { LearnMore } from '@/components/learn-more'

export const Route = createFileRoute('/clerk/_authenticated/user-management')({
  component: UserManagement,
})

function UserManagement() {
  const [opened, setOpened] = useState(true)
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()

  if (!isLoaded) {
    return (
      <div className='flex h-svh items-center justify-center'>
        <IconLoader2 className='size-8 animate-spin' />
      </div>
    )
  }

  if (!isSignedIn) {
    return <Unauthorized />
  }

  return (
    <>
      <SignedIn>
        <Header fixed />

        <Main>
          <div className='mb-2 flex flex-wrap items-center justify-between space-y-2'>
            <div>
              <h2 className='text-2xl font-bold tracking-tight'>
                User Management
              </h2>
              <div className='flex gap-1'>
                <p className='text-muted-foreground'>
                  User management has moved to the Team Members page.
                </p>
                <LearnMore
                  open={opened}
                  onOpenChange={setOpened}
                  contentProps={{ side: 'right' }}
                >
                  <p>
                    This demo page used to show mock user data. The main user
                    management is now at{' '}
                    <Link
                      to='/users'
                      className='text-blue-500 underline decoration-dashed underline-offset-2'
                    >
                      '/users'
                    </Link>{' '}
                    which manages organization members.
                  </p>

                  <p className='mt-4'>
                    You can sign out or manage/delete your account via the User
                    Profile menu in the top-right corner of the page.
                    <IconArrowUpRight className='inline-block size-4' />
                  </p>
                </LearnMore>
              </div>
            </div>
          </div>

          <div className='mt-8 flex flex-col items-center justify-center gap-4'>
            <p className='text-muted-foreground'>
              Team member management is now handled through the organization
              system.
            </p>
            <Button onClick={() => navigate({ to: '/users' })}>
              Go to Team Members
            </Button>
          </div>
        </Main>
      </SignedIn>
    </>
  )
}

const COUNTDOWN = 5 // Countdown second

function Unauthorized() {
  const navigate = useNavigate()
  const { history } = useRouter()

  const [opened, setOpened] = useState(true)
  const [cancelled, setCancelled] = useState(false)
  const [countdown, setCountdown] = useState(COUNTDOWN)

  // Set and run the countdown conditionally
  useEffect(() => {
    if (cancelled || opened) return
    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(interval)
  }, [cancelled, opened])

  // Navigate to sign-in page when countdown hits 0
  useEffect(() => {
    if (countdown > 0) return
    navigate({ to: '/clerk/sign-in' })
  }, [countdown, navigate])

  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>401</h1>
        <span className='font-medium'>Unauthorized Access</span>
        <p className='text-muted-foreground text-center'>
          You must be authenticated via Clerk{' '}
          <sup>
            <LearnMore open={opened} onOpenChange={setOpened}>
              <p>
                This is the same as{' '}
                <Link
                  to='/users'
                  className='text-blue-500 underline decoration-dashed underline-offset-2'
                >
                  '/users'
                </Link>
                .{' '}
              </p>
              <p>You must first sign in using Clerk to access this route. </p>

              <p className='mt-4'>
                After signing in, you'll be able to sign out or delete your
                account via the User Profile dropdown on this page.
              </p>
            </LearnMore>
          </sup>
          <br />
          to access this resource.
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate({ to: '/clerk/sign-in' })}>
            <ClerkLogo className='invert' /> Sign in
          </Button>
        </div>
        <div className='mt-4 h-8 text-center'>
          {!cancelled && !opened && (
            <>
              <p>
                {countdown > 0
                  ? `Redirecting to Sign In page in ${countdown}s`
                  : `Redirecting...`}
              </p>
              <Button variant='link' onClick={() => setCancelled(true)}>
                Cancel Redirect
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
