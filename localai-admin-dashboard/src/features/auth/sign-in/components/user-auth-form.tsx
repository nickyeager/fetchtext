import { HTMLAttributes, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
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
import { getUserFriendlyAuthError } from '@/lib/auth-error-messages'

type UserAuthFormProps = HTMLAttributes<HTMLFormElement>

const formSchema = z.object({
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
})

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const search = useSearch({ from: '/(auth)/sign-in' })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })

      if (error) {
        const userMessage = getUserFriendlyAuthError(error.message)
        form.setError('password', { message: userMessage })
        toast.error('Login failed: ' + userMessage)
      } else if (authData.user) {
        toast.success('Successfully logged in!')
        // Redirect to the intended page or dashboard
        const redirectTo = (search as any)?.redirect || '/dashboard'
        navigate({ to: redirectTo })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const userMessage = getUserFriendlyAuthError(message)
      form.setError('password', { message: userMessage })
      toast.error('Login failed: ' + userMessage)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleGitHubLogin() {
    setIsLoading(true)
    try {
      const redirectTo = (search as any)?.redirect || '/dashboard'
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}${redirectTo}`,
        },
      })

      if (error) {
        toast.error('GitHub login failed: ' + getUserFriendlyAuthError(error.message))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error('GitHub login failed: ' + getUserFriendlyAuthError(message))
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
                <Input placeholder='name@example.com' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='text-muted-foreground absolute -top-0.5 right-0 text-sm font-medium hover:opacity-75'
              >
                Forgot password?
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          Login
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
          onClick={handleGitHubLogin}
        >
          <IconBrandGithub className='h-4 w-4' /> GitHub
        </Button>
      </form>
    </Form>
  )
}
