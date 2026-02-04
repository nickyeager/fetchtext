import { Link, useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/context/auth-context';
import { DemoWidget } from './components/demo-widget';
import { DocumentFactoryAnimation } from './components/document-factory-animation';
import {
  ArrowRight,
  FileText,
  Workflow,
  Shield,
  Check,
  Menu,
  X,
  Globe,
  Brain,
  FolderSync,
  Terminal,
  Cpu,
  ChevronDown,
  Cloud,
  HardDrive,
  Download,
  ExternalLink,
  ShieldCheck,
  Users
} from 'lucide-react';
import { useState, useEffect } from 'react';
import './landing.css';

type DeploymentMode = 'cloud' | 'self-hosted';

export function LandingPageV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>('cloud');

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="landing-page min-h-screen">
      {/* Blueprint Grid Overlay */}
      <div className="fixed inset-0 blueprint-grid pointer-events-none opacity-50" />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-[var(--landing-card-border)] bg-[var(--landing-bg)]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[var(--landing-primary)] flex items-center justify-center">
                <Terminal className="h-4 w-4 text-[var(--landing-bg)]" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight">FetchText</span>
              <span className="tech-badge hidden sm:inline-flex">v2.0</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="font-mono text-sm text-[var(--landing-fg-muted)] hover:text-[var(--landing-primary)] transition-colors">
                &gt; Features
              </a>
              <a href="#security" className="font-mono text-sm text-[var(--landing-fg-muted)] hover:text-[var(--landing-primary)] transition-colors">
                &gt; Security
              </a>
              <a href="#pricing" className="font-mono text-sm text-[var(--landing-fg-muted)] hover:text-[var(--landing-primary)] transition-colors">
                &gt; Pricing
              </a>
              <a href="#faq" className="font-mono text-sm text-[var(--landing-fg-muted)] hover:text-[var(--landing-primary)] transition-colors">
                &gt; FAQ
              </a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {user ? (
                <Link to="/dashboard" className="btn-industrial text-sm">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4 inline" />
                </Link>
              ) : (
                <>
                  <Link to="/sign-in" className="font-mono text-sm text-[var(--landing-fg-muted)] hover:text-[var(--landing-primary)] transition-colors">
                    Sign In
                  </Link>
                  <Link to="/sign-up" className="btn-industrial text-sm">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4 inline" />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="md:hidden w-10 h-10 flex items-center justify-center border border-[var(--landing-card-border)]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen ? "true" : "false"}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--landing-card-border)] bg-[var(--landing-bg)]">
            <div className="container mx-auto px-4 py-4 space-y-3">
              <a href="#features" className="block font-mono text-sm py-2">&gt; Features</a>
              <a href="#security" className="block font-mono text-sm py-2">&gt; Security</a>
              <a href="#pricing" className="block font-mono text-sm py-2">&gt; Pricing</a>
              <a href="#faq" className="block font-mono text-sm py-2">&gt; FAQ</a>
              <div className="pt-3 border-t border-[var(--landing-card-border)] space-y-3">
                {user ? (
                  <Link to="/dashboard" className="btn-industrial w-full text-center block">
                    Dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/sign-in" className="btn-outline-industrial w-full text-center block">
                      Sign In
                    </Link>
                    <Link to="/sign-up" className="btn-industrial w-full text-center block">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className={`${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
              <span className="tech-badge">
                <Cpu className="h-3 w-3 mr-2 inline" />
                Document AI Platform
              </span>
            </div>

            <h1 className={`font-display text-4xl lg:text-6xl font-bold tracking-tight leading-tight ${mounted ? 'animate-fade-up animate-delay-100' : 'opacity-0'}`}>
              <span className="text-[var(--landing-fg)]">Process Documents with AI</span>
              <span className="block text-[var(--landing-primary)] mt-2 glitch-text" data-text="Your Way">
                Your Way
              </span>
            </h1>

            <p className={`text-lg text-[var(--landing-fg-muted)] max-w-lg leading-relaxed ${mounted ? 'animate-fade-up animate-delay-200' : 'opacity-0'}`}>
              Extract data, automate workflows, and leverage AI—
              <span className="text-[var(--landing-primary)]"> on our cloud or your infrastructure.</span> You choose how to run it.
            </p>

            {/* Deployment Toggle */}
            <div className={`hero-deployment-selector ${mounted ? 'animate-fade-up animate-delay-300' : 'opacity-0'}`}>
              <div className="hero-deployment-label">Select deployment</div>
              <DeploymentToggle mode={deploymentMode} onChange={setDeploymentMode} />
            </div>

            <div className={`flex flex-col sm:flex-row gap-4 ${mounted ? 'animate-fade-up animate-delay-400' : 'opacity-0'}`}>
              {deploymentMode === 'cloud' ? (
                <>
                  <Link to="/sign-up" className="btn-industrial inline-flex items-center justify-center">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <a href="#pricing" className="btn-outline-industrial inline-flex items-center justify-center">
                    View Pricing
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="https://github.com/nickyeager/fetchtext"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-industrial inline-flex items-center justify-center"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                  <a
                    href="https://docs.fetchtext.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline-industrial inline-flex items-center justify-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Docs
                  </a>
                </>
              )}
            </div>

            {/* Status indicators */}
            <div className={`flex items-center gap-6 pt-4 ${mounted ? 'animate-fade-up animate-delay-500' : 'opacity-0'}`}>
              <div className="flex items-center gap-2">
                <div className="status-online" />
                <span className="font-mono text-xs text-[var(--landing-fg-muted)]">
                  {deploymentMode === 'cloud' ? 'Cloud Online' : 'Docker Ready'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--landing-fg-muted)]">v2.4.1</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--landing-primary)]">MIT License</span>
              </div>
            </div>
          </div>

          <div className={`relative space-y-6 ${mounted ? 'animate-fade-up animate-delay-200' : 'opacity-0'}`}>
            <div className="scan-line">
              <DocumentFactoryAnimation className="border border-[var(--landing-card-border)]" />
            </div>
            <DemoWidget />
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2">
          <span className="font-mono text-xs text-[var(--landing-fg-muted)]">SCROLL</span>
          <ChevronDown className="h-4 w-4 text-[var(--landing-primary)] animate-bounce" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24 bg-[var(--landing-bg-alt)]">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <span className="tech-badge mb-4 inline-flex">System Capabilities</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold mt-4">
              <span className="section-header">Everything for Document AI</span>
            </h2>
            <p className="text-lg text-[var(--landing-fg-muted)] mt-4 max-w-2xl mx-auto">
              Enterprise-grade features for {deploymentMode === 'cloud' ? 'teams who want it simple' : 'privacy-conscious organizations'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<FileText className="h-6 w-6" />}
              title="Smart Document Processing"
              description={deploymentMode === 'cloud'
                ? "Extract structured data with our managed AI infrastructure—no setup required."
                : "Extract structured data from PDFs, images, and documents using AI models on your infrastructure."
              }
              tag="CORE"
              relevance="both"
            />
            <FeatureCard
              icon={<Brain className="h-6 w-6" />}
              title="Template Intelligence"
              description={deploymentMode === 'cloud'
                ? "Create smart templates that learn from your documents. We handle all the AI."
                : "Create smart templates with AI you control—Ollama, vLLM, or your own Azure keys."
              }
              tag="AI"
              relevance="both"
            />
            <FeatureCard
              icon={<Workflow className="h-6 w-6" />}
              title="Workflow Automation"
              description={deploymentMode === 'cloud'
                ? "Build complex document workflows with fully managed N8N integration."
                : "Build complex document workflows with N8N running on your own servers."
              }
              tag="AUTOMATION"
              relevance="both"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Complete Data Privacy"
              description={deploymentMode === 'cloud'
                ? "SOC 2 compliant infrastructure. Your data encrypted at rest and in transit."
                : "Your data never leaves your infrastructure. Run everything air-gapped if needed."
              }
              tag="SECURITY"
              relevance={deploymentMode === 'cloud' ? 'cloud' : 'self-hosted'}
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6" />}
              title="Multi-Model Support"
              description={deploymentMode === 'cloud'
                ? "Powered by Azure OpenAI with automatic model updates and optimizations."
                : "Use Ollama for local LLMs, or connect your own Azure/OpenAI API keys."
              }
              tag="MODELS"
              relevance="both"
            />
            <FeatureCard
              icon={<FolderSync className="h-6 w-6" />}
              title="Google Drive Integration"
              description={deploymentMode === 'cloud'
                ? "Connect your Google Drive in one click. We handle the sync automatically."
                : "Seamlessly sync documents from Google Drive with your own OAuth credentials."
              }
              tag="SYNC"
              relevance="both"
            />
          </div>
        </div>
      </section>

      {/* Security Section - Side by Side Comparison */}
      <section id="security" className="relative py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <span className="tech-badge mb-4 inline-flex">Security Protocol</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold mt-4">
              <span className="section-header">Enterprise-Grade Security</span>
            </h2>
            <p className="text-lg text-[var(--landing-fg-muted)] mt-4 max-w-2xl mx-auto">
              Whether cloud or self-hosted, your data is protected with industry-leading security
            </p>
          </div>

          <div className="security-comparison">
            <div className="security-column cloud">
              <div className="security-column-header">
                <span className="security-column-icon">☁️</span>
                <span className="security-column-title">Cloud Security</span>
              </div>
              <div className="security-column-features">
                <SecurityFeatureItem text="SOC 2 Type II certified" />
                <SecurityFeatureItem text="Data encrypted at rest & in transit" />
                <SecurityFeatureItem text="99.9% uptime SLA guarantee" />
                <SecurityFeatureItem text="GDPR compliant processing" />
                <SecurityFeatureItem text="Automatic backups & recovery" />
                <SecurityFeatureItem text="Managed security patches" />
              </div>
            </div>

            <div className="security-column self-hosted">
              <div className="security-column-header">
                <span className="security-column-icon">🖥️</span>
                <span className="security-column-title">Self-Hosted Security</span>
              </div>
              <div className="security-column-features">
                <SecurityFeatureItem text="SOC 2 compliant architecture" />
                <SecurityFeatureItem text="Data never leaves your servers" />
                <SecurityFeatureItem text="Air-gapped deployment option" />
                <SecurityFeatureItem text="Full data sovereignty" />
                <SecurityFeatureItem text="Your backup strategy" />
                <SecurityFeatureItem text="Zero external dependencies" />
              </div>
            </div>
          </div>

          {/* Shared Compliance Badges */}
          <div className="compliance-badges">
            <div className="compliance-badge">
              <ShieldCheck className="h-4 w-4" />
              GDPR Ready
            </div>
            <div className="compliance-badge">
              <ShieldCheck className="h-4 w-4" />
              HIPAA Ready
            </div>
            <div className="compliance-badge">
              <Users className="h-4 w-4" />
              RBAC
            </div>
            <div className="compliance-badge">
              <FileText className="h-4 w-4" />
              Audit Logging
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Side by Side Tracks */}
      <section id="pricing" className="relative py-24 bg-[var(--landing-bg-alt)]">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="text-center mb-16">
            <span className="tech-badge mb-4 inline-flex">Pricing Structure</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold mt-4">
              <span className="section-header">Choose Your Path</span>
            </h2>
            <p className="text-lg text-[var(--landing-fg-muted)] mt-4">
              Same powerful features, different deployment options
            </p>
          </div>

          <div className="pricing-tracks-container">
            {/* Cloud Track */}
            <div className="pricing-track cloud">
              <div className="pricing-track-header">
                <div className="pricing-track-icon">☁️</div>
                <div className="pricing-track-title">Cloud</div>
                <div className="pricing-track-subtitle">We run everything</div>
              </div>
              <div className="pricing-track-cards">
                <PricingMiniCard
                  name="Free"
                  price="$0"
                  period="/mo"
                  features={[
                    "100 documents/month",
                    "Shared AI processing",
                    "Community support",
                    "Basic templates"
                  ]}
                  cta="Start Free"
                  href="/sign-up"
                  variant="secondary"
                />
                <PricingMiniCard
                  name="Pro"
                  price="$49"
                  period="/mo"
                  features={[
                    "Unlimited documents",
                    "Priority AI processing",
                    "Email support",
                    "Google Drive sync",
                    "Advanced templates"
                  ]}
                  cta="Start Pro Trial"
                  href="/sign-up?plan=pro"
                  variant="primary"
                  featured
                />
                <PricingMiniCard
                  name="Enterprise"
                  price="Custom"
                  features={[
                    "Dedicated infrastructure",
                    "99.9% SLA",
                    "Custom integrations",
                    "SSO / SAML",
                    "24/7 support"
                  ]}
                  cta="Contact Sales"
                  href="mailto:nick@fetchtext.io?subject=FetchText%20Cloud%20Enterprise"
                  variant="secondary"
                />
              </div>
            </div>

            {/* Mobile Divider */}
            <div className="pricing-divider">
              <div className="pricing-divider-line" />
              <span className="pricing-divider-text">or</span>
              <div className="pricing-divider-line" />
            </div>

            {/* Self-Hosted Track */}
            <div className="pricing-track self-hosted">
              <div className="pricing-track-header">
                <div className="pricing-track-icon">🖥️</div>
                <div className="pricing-track-title">Self-Hosted</div>
                <div className="pricing-track-subtitle">You run everything</div>
              </div>
              <div className="pricing-track-cards">
                <PricingMiniCard
                  name="Community"
                  price="Free"
                  period=" forever"
                  features={[
                    "Unlimited documents",
                    "Ollama AI (local)",
                    "Community support",
                    "Full source access"
                  ]}
                  cta="Download"
                  href="https://github.com/nickyeager/fetchtext"
                  variant="secondary"
                  external
                />
                <PricingMiniCard
                  name="Pro"
                  price="$499"
                  period="/year"
                  features={[
                    "Everything in Community",
                    "Email support",
                    "Priority updates",
                    "Google Drive sync",
                    "Commercial license"
                  ]}
                  cta="Buy License"
                  href="mailto:nick@fetchtext.io?subject=FetchText%20Self-Hosted%20Pro"
                  variant="primary"
                  featured
                />
                <PricingMiniCard
                  name="Enterprise"
                  price="Custom"
                  features={[
                    "Everything in Pro",
                    "Priority support",
                    "Custom development",
                    "Air-gapped deployment",
                    "Training & onboarding"
                  ]}
                  cta="Contact Sales"
                  href="mailto:nick@fetchtext.io?subject=FetchText%20Self-Hosted%20Enterprise"
                  variant="secondary"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative py-24">
        <div className="container mx-auto px-4 lg:px-8 max-w-3xl">
          <div className="text-center mb-16">
            <span className="tech-badge mb-4 inline-flex">Documentation</span>
            <h2 className="font-display text-3xl lg:text-5xl font-bold mt-4">
              <span className="section-header">FAQ</span>
            </h2>
          </div>

          <div className="space-y-4">
            <FAQItem
              question="Should I choose Cloud or Self-Hosted?"
              answer="Cloud is best for teams wanting zero setup, automatic updates, and managed infrastructure. Self-Hosted is ideal for organizations with strict compliance requirements, existing infrastructure, or data sovereignty needs. Both options provide the same core features."
            />
            <FAQItem
              question="Can I switch between Cloud and Self-Hosted?"
              answer="Yes! You can export your templates and data anytime. We provide migration tools to move between deployment options. Your workflows and templates are fully portable."
            />
            <FAQItem
              question="What's included in the self-hosted free tier?"
              answer="Everything except priority support. Run unlimited documents with Ollama AI models completely free. The Community tier includes full source access and all core features—no artificial limitations."
            />
            <FAQItem
              question="What AI models does FetchText support?"
              answer="Cloud uses Azure OpenAI for fast, reliable processing. Self-Hosted supports Ollama for local LLMs (Llama, Mistral, Qwen), or you can bring your own Azure/OpenAI API keys."
            />
            <FAQItem
              question="How difficult is self-hosted setup?"
              answer="FetchText can be deployed in under 5 minutes using Docker Compose. We provide detailed documentation and deployment scripts for Docker, Kubernetes, and bare metal installations."
            />
            <FAQItem
              question="Can I integrate with my existing systems?"
              answer="Yes! FetchText includes N8N for workflow automation, REST APIs for custom integrations, and supports webhooks. It can integrate with your existing document management systems, ERPs, and databases."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="industrial-card p-12 lg:p-16 text-center">
            <h2 className="font-display text-3xl lg:text-5xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-[var(--landing-fg-muted)] mb-8 max-w-2xl mx-auto">
              Process documents with AI—your cloud or your servers, your choice
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/sign-up" className="btn-industrial inline-flex items-center justify-center">
                <Cloud className="mr-2 h-4 w-4" />
                Start Cloud Free
              </Link>
              <a
                href="https://github.com/nickyeager/fetchtext"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline-industrial inline-flex items-center justify-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Self-Host Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="industrial-footer py-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--landing-primary)] flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-[var(--landing-bg)]" />
                </div>
                <span className="font-display font-bold text-white">FetchText</span>
              </div>
              <p className="text-sm text-[var(--landing-fg-muted)]">
                Document AI platform — cloud or self-hosted, your choice
              </p>
              <div className="flex items-center gap-2">
                <div className="status-online" />
                <span className="font-mono text-xs text-[var(--landing-fg-muted)]">All systems operational</span>
              </div>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-[var(--landing-primary)]">&gt; Product</h4>
              <ul className="space-y-2 font-mono text-sm text-[var(--landing-fg-muted)]">
                <li><a href="#features" className="hover:text-[var(--landing-primary)] transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-[var(--landing-primary)] transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-[var(--landing-primary)] transition-colors">Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-[var(--landing-primary)]">&gt; Legal</h4>
              <ul className="space-y-2 font-mono text-sm text-[var(--landing-fg-muted)]">
                <li><Link to="/terms" className="hover:text-[var(--landing-primary)] transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-[var(--landing-primary)] transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-display font-semibold mb-4 text-[var(--landing-primary)]">&gt; Contact</h4>
              <ul className="space-y-2 font-mono text-sm text-[var(--landing-fg-muted)]">
                <li><a href="mailto:nick@fetchtext.io" className="hover:text-[var(--landing-primary)] transition-colors">nick@fetchtext.io</a></li>
                <li><a href="mailto:nick@fetchtext.io?subject=Support%20Request" className="hover:text-[var(--landing-primary)] transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-[var(--landing-card-border)] text-center font-mono text-sm text-[var(--landing-fg-muted)]">
            <p>&copy; {new Date().getFullYear()} FetchText // Document Processing Platform // MIT License</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================
// Component: Deployment Toggle
// ============================================
function DeploymentToggle({
  mode,
  onChange
}: {
  mode: DeploymentMode;
  onChange: (mode: DeploymentMode) => void;
}) {
  return (
    <div className="deployment-toggle">
      <button
        type="button"
        className={`deployment-toggle-option ${mode === 'cloud' ? 'active' : ''}`}
        onClick={() => onChange('cloud')}
        aria-pressed={mode === 'cloud' ? 'true' : 'false'}
      >
        <Cloud className="h-4 w-4 deployment-toggle-icon" />
        Cloud
      </button>
      <button
        type="button"
        className={`deployment-toggle-option ${mode === 'self-hosted' ? 'active' : ''}`}
        onClick={() => onChange('self-hosted')}
        aria-pressed={mode === 'self-hosted' ? 'true' : 'false'}
      >
        <HardDrive className="h-4 w-4 deployment-toggle-icon" />
        Self-Hosted
      </button>
    </div>
  );
}

// ============================================
// Component: Feature Card
// ============================================
function FeatureCard({
  icon,
  title,
  description,
  tag,
  relevance
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  relevance?: 'cloud' | 'self-hosted' | 'both';
}) {
  return (
    <div className="feature-card">
      <div className="flex items-start justify-between mb-4">
        <div className="icon-glow">
          {icon}
        </div>
        <div className="flex items-center gap-2">
          {relevance && (
            <span className={`feature-relevance-badge ${relevance}`}>
              {relevance === 'both' ? 'Both' : relevance === 'cloud' ? 'Cloud' : 'Self-Hosted'}
            </span>
          )}
          <span className="font-mono text-xs text-[var(--landing-primary)] opacity-70">[{tag}]</span>
        </div>
      </div>
      <h3 className="font-display text-lg font-bold mb-2">{title}</h3>
      <p className="text-sm text-[var(--landing-fg-muted)] leading-relaxed">{description}</p>
    </div>
  );
}

// ============================================
// Component: Security Feature Item
// ============================================
function SecurityFeatureItem({ text }: { text: string }) {
  return (
    <div className="security-feature-item">
      <Check className="h-4 w-4" />
      <span>{text}</span>
    </div>
  );
}

// ============================================
// Component: Pricing Mini Card
// ============================================
function PricingMiniCard({
  name,
  price,
  period,
  features,
  cta,
  href,
  variant = 'secondary',
  featured = false,
  external = false
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  cta: string;
  href: string;
  variant?: 'primary' | 'secondary';
  featured?: boolean;
  external?: boolean;
}) {
  const isExternal = external || href.startsWith('mailto:') || href.startsWith('http');

  const ctaClass = `pricing-mini-cta ${variant}`;

  return (
    <div className={`pricing-mini-card ${featured ? 'featured' : ''}`}>
      <div className="pricing-mini-header">
        <span className="pricing-mini-name">{name}</span>
        <span className="pricing-mini-price">
          {price}
          {period && <span>{period}</span>}
        </span>
      </div>
      <ul className="pricing-mini-features">
        {features.map((feature, i) => (
          <li key={i}>
            <Check className="h-4 w-4" />
            {feature}
          </li>
        ))}
      </ul>
      {isExternal ? (
        <a href={href} className={ctaClass} target="_blank" rel="noopener noreferrer">
          {cta}
        </a>
      ) : (
        <Link to={href} className={ctaClass}>
          {cta}
        </Link>
      )}
    </div>
  );
}

// ============================================
// Component: FAQ Item
// ============================================
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="industrial-card">
      <button
        type="button"
        className="w-full p-6 text-left flex items-start gap-4"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen ? "true" : "false"}
      >
        <span className="font-mono text-[var(--landing-primary)] flex-shrink-0">
          {isOpen ? '[-]' : '[+]'}
        </span>
        <div className="flex-1">
          <h3 className="font-display font-semibold">{question}</h3>
          {isOpen && (
            <p className="mt-3 text-[var(--landing-fg-muted)] leading-relaxed">{answer}</p>
          )}
        </div>
      </button>
    </div>
  );
}
