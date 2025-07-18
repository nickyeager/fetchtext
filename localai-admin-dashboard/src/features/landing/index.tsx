import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeSwitch } from '@/components/theme-switch';
import { useAuth } from '@/context/auth-context';
import { LottieAnimation } from '@/components/ui/lottie';
import { getLottieAnimation, animationConfigs } from '@/lib/lottie-animations';

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Auto-redirect authenticated users to dashboard
  useEffect(() => {
    // You can add authentication check here if needed
    // For now, we'll let users manually navigate
  }, []);

  const handleGetStarted = () => {
    navigate({ to: '/dashboard' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo/Brand */}
            <div className="flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">FetchText</h1>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {isAuthenticated ? (
                <Link 
                  to="/dashboard" 
                  className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
                >
                  Dashboard
                </Link>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/sign-in">Sign In</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/sign-up">Sign Up</Link>
                  </Button>
                </div>
              )}
              <ThemeSwitch />
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center gap-2">
              {isAuthenticated ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/sign-in">Sign In</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link to="/sign-up">Sign Up</Link>
                  </Button>
                </>
              )}
              <ThemeSwitch />
            </div>
          </div>
        </div>
      </header>
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section with Lottie Animation */}
          <div className="mb-12">
            <div className="max-w-md mx-auto mb-8">
              <LottieAnimation
                animationData={getLottieAnimation('hero')}
                className="w-full h-64"
                {...animationConfigs.hero}
              />
            </div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to FetchText
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Extract, process, and manage your documents with AI-powered automation
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <div className="mb-4">
                  <LottieAnimation
                    animationData={getLottieAnimation('documentProcessing')}
                    className="w-full h-20"
                    {...animationConfigs.card}
                  />
                </div>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Document Processing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Process and manage documents with AI-powered extraction and templating
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4">
                  <LottieAnimation
                    animationData={getLottieAnimation('workflowAutomation')}
                    className="w-full h-20"
                    {...animationConfigs.card}
                  />
                </div>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Workflow Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Create and manage automated workflows with N8N integration
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-4">
                  <LottieAnimation
                    animationData={getLottieAnimation('aiIntegration')}
                    className="w-full h-20"
                    {...animationConfigs.card}
                  />
                </div>
                <CardTitle className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  AI Integration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Leverage local AI models with Ollama and other AI services
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Button 
              onClick={handleGetStarted}
              size="lg"
              className="px-8 py-3 text-lg"
            >
              Get Started
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Access your dashboard and start managing your AI workflows
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 