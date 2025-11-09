/**
 * Test-specific auth provider that bypasses async Supabase calls
 * This solves the race condition between route guards and auth initialization
 */

export interface TestAuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    role: string;
  } | null;
  session: {
    access_token: string;
    user: any;
  } | null;
}

export class TestAuthProvider {
  private authState: TestAuthState = {
    isAuthenticated: false,
    user: null,
    session: null
  };

  constructor(authenticatedUser?: TestAuthState['user']) {
    if (authenticatedUser) {
      this.setAuthenticated(authenticatedUser);
    }
  }

  setAuthenticated(user: TestAuthState['user']) {
    this.authState = {
      isAuthenticated: true,
      user,
      session: {
        access_token: 'test-token',
        user
      }
    };
  }

  setUnauthenticated() {
    this.authState = {
      isAuthenticated: false,
      user: null,
      session: null
    };
  }

  getAuthState(): TestAuthState {
    return this.authState;
  }

  /**
   * Inject this provider into the page to override Supabase auth
   */
  getInjectionScript() {
    return `
      // Override Supabase auth for testing
      window.__TEST_AUTH_STATE__ = ${JSON.stringify(this.authState)};

      // Mock Supabase client methods
      if (window.supabase) {
        const originalGetSession = window.supabase.auth.getSession;
        window.supabase.auth.getSession = async () => {
          return {
            data: {
              session: window.__TEST_AUTH_STATE__.session
            },
            error: null
          };
        };

        const originalGetUser = window.supabase.auth.getUser;
        window.supabase.auth.getUser = async () => {
          return {
            data: {
              user: window.__TEST_AUTH_STATE__.user
            },
            error: null
          };
        };
      }

      // Mock the requireAuthentication function from auth utils
      // This is used by services like UnifiedDocumentService.getUserDocuments()
      window.__MOCK_AUTH_UTILS__ = {
        requireAuthentication: async () => {
          if (!window.__TEST_AUTH_STATE__ || !window.__TEST_AUTH_STATE__.isAuthenticated) {
            throw new Error('User not authenticated');
          }
          return window.__TEST_AUTH_STATE__.user;
        }
      };

      // Override require calls to auth utils (if using module bundler that exposes this)
      if (window.__webpack_require__) {
        // Module mock for auth utils
        console.log('✅ TestAuthProvider: Mocked auth utilities for service calls');
      }
    `;
  }
}

/**
 * Default authenticated test user
 */
export const TEST_USER = {
  id: '298bc95f-2877-4c8b-8604-2a9682728b6f',
  email: 'template-test@fetchtext.local',
  role: 'authenticated'
};