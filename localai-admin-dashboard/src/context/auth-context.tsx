import {
  createContext,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react'
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { identifyUser, resetUser } from '@/lib/posthog'

interface AuthContextValue {
  session: Session | null
  user: User | null
}

const AuthContext = createContext<AuthContextValue>({ session: null, user: null })

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      const currentSession = data.session
      setSession(currentSession)
      setUser(currentSession?.user ?? null)

      // Identify user in PostHog on initial load
      if (currentSession?.user) {
        identifyUser(currentSession.user.id, {
          email: currentSession.user.email,
          created_at: currentSession.user.created_at
        })
      }
    })

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((
      event: AuthChangeEvent,
      session: Session | null
    ) => {
      setSession(session)
      setUser(session?.user ?? null)

      // Handle PostHog user identification
      if (event === 'SIGNED_IN' && session?.user) {
        identifyUser(session.user.id, {
          email: session.user.email,
          created_at: session.user.created_at
        })
      } else if (event === 'SIGNED_OUT') {
        resetUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user }}>{children}</AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext) 