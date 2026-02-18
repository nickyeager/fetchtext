/**
 * Organization Context
 *
 * Provides organization state and management throughout the application.
 * Handles organization selection, caching, and real-time updates.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  PropsWithChildren,
} from 'react';
import { useAuth } from '@/context/auth-context';
import { OrganizationService } from '@/lib/organization-service';
import type {
  Organization,
  OrganizationWithRole,
  OrganizationRole,
} from '@/types/organization';

const STORAGE_KEY = 'fetchtext_active_organization_id';

interface OrganizationContextValue {
  // State
  organizations: OrganizationWithRole[];
  activeOrganization: OrganizationWithRole | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setActiveOrganization: (org: OrganizationWithRole) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (name: string, description?: string) => Promise<Organization>;

  // Helpers
  isOwner: boolean;
  isAdmin: boolean;
  canManage: boolean;
  userRole: OrganizationRole | null;
}

const OrganizationContext = createContext<OrganizationContextValue>({
  organizations: [],
  activeOrganization: null,
  isLoading: true,
  error: null,
  setActiveOrganization: () => {},
  refreshOrganizations: async () => {},
  createOrganization: async () => {
    throw new Error('Not initialized');
  },
  isOwner: false,
  isAdmin: false,
  canManage: false,
  userRole: null,
});

export const OrganizationProvider = ({ children }: PropsWithChildren) => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [activeOrganization, setActiveOrganizationState] =
    useState<OrganizationWithRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadIdRef = useRef(0);

  // Load organizations when user changes
  const loadOrganizations = useCallback(async () => {
    if (!user) {
      setOrganizations([]);
      setActiveOrganizationState(null);
      setIsLoading(false);
      return;
    }

    // Increment load ID so stale responses from previous calls are ignored
    const currentLoadId = ++loadIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const orgs = await OrganizationService.getUserOrganizations();

      // If a newer load was started while we were awaiting, discard this result
      if (currentLoadId !== loadIdRef.current) return;

      setOrganizations(orgs);

      // Try to restore last active organization from localStorage
      const savedOrgId = localStorage.getItem(STORAGE_KEY);
      let activeOrg: OrganizationWithRole | null = null;

      if (savedOrgId) {
        activeOrg = orgs.find((o) => o.id === savedOrgId) || null;
      }

      // Fall back to personal organization or first available
      if (!activeOrg) {
        activeOrg =
          orgs.find((o) => o.organization_type === 'personal') || orgs[0] || null;
      }

      setActiveOrganizationState(activeOrg);

      if (activeOrg) {
        localStorage.setItem(STORAGE_KEY, activeOrg.id);
      }
    } catch (err) {
      // If a newer load was started, don't surface this error
      if (currentLoadId !== loadIdRef.current) return;

      // Suppress network aborts during navigation (ERR_ABORTED / Failed to fetch).
      // Supabase PostgREST errors are plain objects with a message property, not Error instances.
      const message =
        err instanceof Error ? err.message :
        (typeof err === 'object' && err !== null && 'message' in err)
          ? String((err as Record<string, unknown>).message)
          : String(err);
      if (message.includes('Failed to fetch') || message.includes('AbortError')) {
        console.warn('Organization load aborted (navigation in progress), will retry');
        return;
      }

      console.error('Failed to load organizations:', err);
      setError(message);
    } finally {
      if (currentLoadId === loadIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    loadOrganizations();
    return () => {
      // Invalidate any in-flight load when effect re-runs or component unmounts
      loadIdRef.current++;
    };
  }, [loadOrganizations]);

  // Set active organization
  const setActiveOrganization = useCallback((org: OrganizationWithRole) => {
    setActiveOrganizationState(org);
    localStorage.setItem(STORAGE_KEY, org.id);
  }, []);

  // Refresh organizations
  const refreshOrganizations = useCallback(async () => {
    await loadOrganizations();
  }, [loadOrganizations]);

  // Create a new organization
  const createOrganization = useCallback(
    async (name: string, description?: string): Promise<Organization> => {
      const newOrg = await OrganizationService.createOrganization({
        name,
        description,
      });

      // Refresh the list to include the new org
      await refreshOrganizations();

      return newOrg;
    },
    [refreshOrganizations]
  );

  // Computed values
  const userRole = activeOrganization?.role || null;
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'admin';
  const canManage = isOwner || isAdmin;

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      activeOrganization,
      isLoading,
      error,
      setActiveOrganization,
      refreshOrganizations,
      createOrganization,
      isOwner,
      isAdmin,
      canManage,
      userRole,
    }),
    [
      organizations,
      activeOrganization,
      isLoading,
      error,
      setActiveOrganization,
      refreshOrganizations,
      createOrganization,
      isOwner,
      isAdmin,
      canManage,
      userRole,
    ]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => useContext(OrganizationContext);

/**
 * Hook to get the active organization ID
 * Throws if no organization is selected
 */
export const useActiveOrganizationId = (): string => {
  const { activeOrganization } = useOrganization();

  if (!activeOrganization) {
    throw new Error('No active organization selected');
  }

  return activeOrganization.id;
};

/**
 * Hook to check if user has a specific role or higher
 */
export const useHasRole = (requiredRole: OrganizationRole): boolean => {
  const { userRole } = useOrganization();

  if (!userRole) return false;

  const roleHierarchy: Record<OrganizationRole, number> = {
    member: 1,
    admin: 2,
    owner: 3,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};
