import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/terms')({
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">FetchText</span>
            </Link>
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using FetchText ("Service"), you agree to be bound by these Terms of Service ("Terms").
              If you disagree with any part of these terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              FetchText is a document processing platform that enables users to extract structured data
              from documents using AI technology. The Service is available as both a managed cloud service
              and a self-hosted solution. The Service includes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Document upload and processing capabilities</li>
              <li>AI-powered data extraction and template matching</li>
              <li>Workflow automation integrations</li>
              <li>API access for programmatic document processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Deployment Options</h2>
            <p className="text-muted-foreground leading-relaxed">
              FetchText offers flexible deployment options to meet your needs:
            </p>
            <h3 className="text-lg font-medium mt-4 mb-2">Managed Cloud Service</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>FetchText hosts and maintains the infrastructure</li>
              <li>We implement security measures and handle system updates</li>
              <li>Your documents are processed on our secure servers</li>
              <li>Data is encrypted in transit and at rest</li>
            </ul>
            <h3 className="text-lg font-medium mt-4 mb-2">Self-Hosted Deployment</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>You maintain complete control over your data and documents</li>
              <li>No document content is transmitted to FetchText servers</li>
              <li>You are responsible for the security and maintenance of your deployment</li>
              <li>You are responsible for compliance with applicable data protection laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Account Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Accept responsibility for all activities under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Process documents containing illegal content</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Distribute malware or harmful code</li>
              <li>Engage in any activity that disrupts the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Our Property:</strong> The Service, including its software, design, and documentation,
              is owned by FetchText and protected by intellectual property laws. Your license to use the
              Service does not grant ownership of any intellectual property.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Your Content:</strong> You retain all rights to the documents and data you process
              through the Service. We claim no ownership over your content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Payment Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Community Tier:</strong> The Community tier is provided free of charge with usage limitations.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Professional & Enterprise Tiers:</strong> Paid tiers require a one-time license fee.
              Payment terms will be specified at the time of purchase. All fees are non-refundable unless
              otherwise specified in writing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Managed Cloud Service:</strong> We strive to maintain high availability for our managed
              service. Planned maintenance will be communicated in advance when possible. Enterprise customers
              may negotiate specific SLA terms.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Self-Hosted Deployments:</strong> Service availability depends on your infrastructure.
              We do not guarantee uptime for self-hosted installations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, FETCHTEXT SHALL NOT BE LIABLE FOR ANY INDIRECT,
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES,
              WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER
              INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
              FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your access to the Service immediately, without prior notice,
              for conduct that we believe violates these Terms or is harmful to other users, us, or third
              parties, or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will provide notice of significant
              changes by updating the "Last updated" date. Your continued use of the Service after changes
              constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms, please contact us at{' '}
              <a href="mailto:nick@fetchtext.io" className="text-primary hover:underline">
                nick@fetchtext.io
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} FetchText. AI-powered document processing platform.</p>
        </div>
      </footer>
    </div>
  );
}
