import { Link, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ThemeSwitch } from '@/components/theme-switch';
import { useAuth } from '@/context/auth-context';
import {
  ArrowRight,
  FileText,
  Workflow,
  Shield,
  Zap,
  Database,
  Cloud,
  Play,
  Check,
  Menu,
  X,
  Sparkles,
  Globe,
  Lock,
  Server,
  Brain,
  FolderSync
} from 'lucide-react';
import { useState } from 'react';

export function LandingPageV2() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FetchText</span>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">
                Features
              </a>
              <a href="#security" className="text-sm font-medium hover:text-primary transition-colors">
                Security
              </a>
              <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
                Pricing
              </a>
              <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">
                FAQ
              </a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <ThemeSwitch />
              {user ? (
                <Button asChild>
                  <Link to="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" asChild>
                    <Link to="/sign-in">Sign In</Link>
                  </Button>
                  <Button asChild>
                    <Link to="/sign-up">Get Started</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t">
            <div className="container mx-auto px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm font-medium">Features</a>
              <a href="#security" className="block text-sm font-medium">Security</a>
              <a href="#pricing" className="block text-sm font-medium">Pricing</a>
              <a href="#faq" className="block text-sm font-medium">FAQ</a>
              <div className="pt-3 border-t space-y-3">
                {user ? (
                  <Button className="w-full" asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full" asChild>
                      <Link to="/sign-in">Sign In</Link>
                    </Button>
                    <Button className="w-full" asChild>
                      <Link to="/sign-up">Get Started</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <Badge variant="secondary" className="px-4 py-1">
              <Sparkles className="h-3 w-3 mr-2" />
              Self-Hosted AI Platform
            </Badge>
            
            <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
              Process Documents with
              <span className="text-primary block mt-2">Complete Privacy</span>
            </h1>
            
            <p className="text-xl text-muted-foreground">
              Extract data, automate workflows, and leverage AI—all within your own infrastructure. 
              No cloud dependencies, no data leaving your servers.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/learn-more">
                  <Play className="mr-2 h-4 w-4" />
                  Learn More
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="relative">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-8">
              <div className="h-full w-full rounded-xl bg-card border shadow-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Document Processing</span>
                </div>
                <div className="space-y-2">
                  <div className="h-2 bg-muted rounded w-full" />
                  <div className="h-2 bg-muted rounded w-4/5" />
                  <div className="h-2 bg-muted rounded w-3/5" />
                </div>
                <div className="pt-4 grid grid-cols-2 gap-3">
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-primary">95%</div>
                    <div className="text-xs text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <div className="text-2xl font-bold text-primary">10x</div>
                    <div className="text-xs text-muted-foreground">Faster</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Everything You Need for Document AI
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful features designed for privacy-conscious organizations
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<FileText className="h-6 w-6" />}
            title="Smart Document Processing"
            description="Extract structured data from PDFs, images, and documents using state-of-the-art AI models running locally."
          />
          <FeatureCard
            icon={<Brain className="h-6 w-6" />}
            title="Template Intelligence"
            description="Create smart templates that learn from your documents and improve extraction accuracy over time."
          />
          <FeatureCard
            icon={<Workflow className="h-6 w-6" />}
            title="Workflow Automation"
            description="Build complex document workflows with N8N integration for complete process automation."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Complete Data Privacy"
            description="Your data never leaves your infrastructure. Run everything on-premise or in your private cloud."
          />
          <FeatureCard
            icon={<Globe className="h-6 w-6" />}
            title="Multi-Model Support"
            description="Use Ollama for local LLMs or connect to Azure OpenAI for enhanced capabilities."
          />
          <FeatureCard
            icon={<FolderSync className="h-6 w-6" />}
            title="Google Drive Integration"
            description="Seamlessly sync and process documents from Google Drive with real-time folder monitoring."
          />
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold">
                Enterprise-Grade Security, Complete Control
              </h2>
              <p className="text-lg text-muted-foreground">
                Unlike cloud-based solutions, FetchText ensures your sensitive documents never leave your infrastructure.
              </p>
              
              <div className="space-y-4">
                <SecurityFeature
                  icon={<Lock className="h-5 w-5" />}
                  title="End-to-End Encryption"
                  description="All data is encrypted at rest and in transit within your infrastructure"
                />
                <SecurityFeature
                  icon={<Server className="h-5 w-5" />}
                  title="Self-Hosted Infrastructure"
                  description="Deploy on your own servers or private cloud for complete control"
                />
                <SecurityFeature
                  icon={<Shield className="h-5 w-5" />}
                  title="Zero External Dependencies"
                  description="No API calls to external services unless explicitly configured"
                />
                <SecurityFeature
                  icon={<Database className="h-5 w-5" />}
                  title="Data Sovereignty"
                  description="Your data stays in your chosen geographic location"
                />
              </div>
            </div>
            
            <div className="bg-card rounded-xl border p-8 shadow-lg">
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-primary" />
                  <h3 className="text-2xl font-bold">Security First</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>SOC 2 Compliant Architecture</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>GDPR & HIPAA Ready</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Role-Based Access Control</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Audit Logging</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span>Air-Gapped Deployment Option</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground">
            One-time license fee, no recurring costs
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <PricingCard
            title="Community"
            price="Free"
            description="Perfect for individuals and small teams"
            features={[
              "Up to 3 users",
              "1,000 documents/month",
              "Basic templates",
              "Community support",
              "Docker deployment"
            ]}
            cta="Get Started"
            variant="outline"
          />
          <PricingCard
            title="Professional"
            price="$499"
            description="For growing teams and businesses"
            features={[
              "Unlimited users",
              "Unlimited documents",
              "Advanced templates",
              "Priority support",
              "Kubernetes deployment",
              "Google Drive integration",
              "Custom AI models"
            ]}
            cta="Buy License"
            highlighted
          />
          <PricingCard
            title="Enterprise"
            price="Custom"
            description="For large organizations"
            features={[
              "Everything in Pro",
              "SLA guarantee",
              "Custom integrations",
              "Training & onboarding",
              "Air-gapped deployment",
              "24/7 support",
              "Custom development"
            ]}
            cta="Contact Sales"
            variant="outline"
          />
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="bg-muted/50 py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl lg:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <FAQItem
              question="How is FetchText different from cloud-based solutions?"
              answer="FetchText runs entirely on your infrastructure. Your documents and data never leave your servers, giving you complete control and privacy. Unlike SaaS solutions, there are no monthly fees or usage limits."
            />
            <FAQItem
              question="What AI models does FetchText support?"
              answer="FetchText supports Ollama for local LLM deployment, Azure OpenAI for enhanced capabilities, and custom models. You can run models like Llama, Mistral, and others completely offline."
            />
            <FAQItem
              question="How difficult is it to set up?"
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
      <section className="container mx-auto px-4 py-20">
        <div className="bg-primary rounded-2xl p-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Take Control of Your Document AI?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Join hundreds of organizations processing millions of documents with complete privacy
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/sign-up">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10" asChild>
              <a href="https://github.com/yourusername/fetchtext" target="_blank" rel="noopener noreferrer">
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-bold">FetchText</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Self-hosted document AI platform with complete data privacy
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary">Pricing</a></li>
                <li><a href="/docs" className="hover:text-primary">Documentation</a></li>
                <li><a href="/api" className="hover:text-primary">API Reference</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/about" className="hover:text-primary">About</a></li>
                <li><a href="/blog" className="hover:text-primary">Blog</a></li>
                <li><a href="/contact" className="hover:text-primary">Contact</a></li>
                <li><a href="/privacy" className="hover:text-primary">Privacy</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-3">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="https://github.com" className="hover:text-primary">GitHub</a></li>
                <li><a href="https://twitter.com" className="hover:text-primary">Twitter</a></li>
                <li><a href="https://discord.com" className="hover:text-primary">Discord</a></li>
                <li><a href="/contact" className="hover:text-primary">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© 2024 FetchText. Open source and self-hosted with ❤️</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Component helpers
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4">
          {icon}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function SecurityFeature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PricingCard({ 
  title, 
  price, 
  description, 
  features, 
  cta, 
  highlighted = false,
  variant = "default" 
}: { 
  title: string; 
  price: string; 
  description: string; 
  features: string[]; 
  cta: string; 
  highlighted?: boolean;
  variant?: "default" | "outline";
}) {
  return (
    <Card className={highlighted ? "border-primary shadow-lg scale-105" : ""}>
      <CardHeader>
        {highlighted && (
          <Badge className="w-fit mb-4">Most Popular</Badge>
        )}
        <CardTitle className="text-2xl">{title}</CardTitle>
        <div className="mt-4">
          <span className="text-4xl font-bold">{price}</span>
          {price !== "Free" && price !== "Custom" && <span className="text-muted-foreground">/one-time</span>}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        <Button className="w-full" variant={highlighted ? "default" : variant as any}>
          {cta}
        </Button>
      </CardContent>
    </Card>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-card rounded-lg p-6 border">
      <h3 className="font-semibold mb-2">{question}</h3>
      <p className="text-muted-foreground">{answer}</p>
    </div>
  );
}