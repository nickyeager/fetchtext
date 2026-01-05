import { HTMLAttributes, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { IconBrandGithub } from '@tabler/icons-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { supabase } from '@/lib/supabase'
import { OrganizationService } from '@/lib/organization-service'

interface SignUpFormProps extends HTMLAttributes<HTMLFormElement> {
  defaultEmail?: string
  isInviteFlow?: boolean
}

const formSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'Please enter your email' })
      .email({ message: 'Invalid email address' }),
    password: z
      .string()
      .min(1, {
        message: 'Please enter your password',
      })
      .min(7, {
        message: 'Password must be at least 7 characters long',
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

export function SignUpForm({ className, defaultEmail, isInviteFlow, ...props }: SignUpFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/(auth)/sign-up' })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: defaultEmail || '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      })

      if (error) {
        toast.error('Sign up failed: ' + error.message)
        form.setError('email', {
          message: error.message,
        })
      } else if (authData.user && authData.session) {
        // User is authenticated immediately (email verification disabled or auto-confirmed)
        const isInviteFlow = redirect?.includes('/invite/accept')

        if (isInviteFlow) {
          // Extract token from redirect URL and accept the invitation
          const tokenMatch = redirect.match(/token=([^&]+)/)
          const inviteToken = tokenMatch?.[1]

          if (inviteToken) {
            try {
              await OrganizationService.acceptInvitationByToken(inviteToken)
              toast.success('Welcome! You\'ve joined the team successfully.')
              navigate({ to: '/dashboard' })
              return
            } catch (inviteError) {
              console.error('Error accepting invitation:', inviteError)
              toast.error('Account created, but failed to accept invitation. Please try again from the invite link.')
            }
          }
        }

        toast.success('Account created successfully!')
        navigate({ to: '/dashboard' })
      } else if (authData.user) {
        // User created but needs email verification
        toast.success('Account created! Please check your email for verification.')
        navigate({ to: '/sign-in', search: { redirect: redirect || '' } })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder='name@example.com'
                  {...field}
                  readOnly={isInviteFlow && !!defaultEmail}
                  className={isInviteFlow && defaultEmail ? 'bg-muted' : ''}
                />
              </FormControl>
              {isInviteFlow && defaultEmail && (
                <p className="text-xs text-muted-foreground">
                  This email is linked to your invitation and cannot be changed.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          Create Account
        </Button>

        <div className='relative my-2'>
          <div className='absolute inset-0 flex items-center'>
            <span className='w-full border-t' />
          </div>
          <div className='relative flex justify-center text-xs uppercase'>
            <span className='bg-background text-muted-foreground px-2'>
              Or continue with
            </span>
          </div>
        </div>

        <Button
          variant='outline'
          className='w-full'
          type='button'
          disabled={isLoading}
        >
          <IconBrandGithub className='h-4 w-4' /> GitHub
        </Button>
      </form>
    </Form>
  )
}
