import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2025</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              FetchText ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, and safeguard your information when you use our document
              processing platform, whether through our managed cloud service or a self-hosted deployment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. How Your Data Is Handled</h2>
            <p className="text-muted-foreground leading-relaxed">
              FetchText offers both managed cloud and self-hosted deployment options. How your data is handled
              depends on which option you choose:
            </p>

            <h3 className="text-lg font-medium mt-4 mb-2">Managed Cloud Service</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you use our managed cloud service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Document Processing:</strong> Your documents are processed on our secure servers and encrypted in transit and at rest.</li>
              <li><strong>Data Storage:</strong> Extracted data and templates are stored in our secure cloud infrastructure.</li>
              <li><strong>Access Controls:</strong> We implement strict access controls to protect your data.</li>
              <li><strong>Compliance:</strong> We maintain compliance with applicable data protection regulations.</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Self-Hosted Deployments</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you run FetchText on your own infrastructure:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Document Data:</strong> All documents remain on your servers. We have no access to this data.</li>
              <li><strong>Extracted Data:</strong> All AI-extracted information stays within your infrastructure.</li>
              <li><strong>Templates:</strong> Your custom templates and configurations are stored locally.</li>
              <li><strong>Your Responsibility:</strong> You are the data controller and responsible for compliance with applicable regulations (GDPR, CCPA, HIPAA, etc.).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information to provide and improve our services:
            </p>

            <h3 className="text-xl font-medium mt-6 mb-3">Account Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Email address (for account creation and communication)</li>
              <li>Name (optional, for personalization)</li>
              <li>Password (stored securely using industry-standard hashing)</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">Usage Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Pages visited on our marketing website</li>
              <li>Feature usage patterns (anonymized)</li>
              <li>Error reports (to improve the service)</li>
            </ul>

            <h3 className="text-xl font-medium mt-6 mb-3">Technical Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Browser type and version</li>
              <li>Operating system</li>
              <li>IP address (anonymized where possible)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Provide and maintain our website and account services</li>
              <li>Send important updates about the Service</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Improve our products and services</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Encryption of data in transit (TLS/SSL) and at rest</li>
              <li>Secure password hashing</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
              <li>Secure cloud infrastructure for managed deployments</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              For self-hosted deployments, you are responsible for implementing appropriate security measures
              for your infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services may use the following third-party services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Analytics:</strong> To understand usage patterns (anonymized data only)</li>
              <li><strong>Payment Processing:</strong> For license purchases (we do not store payment card details)</li>
              <li><strong>Email Services:</strong> To send transactional emails</li>
              <li><strong>Cloud Infrastructure:</strong> For managed deployments, we use secure cloud providers</li>
              <li><strong>AI Services:</strong> Optional integration with AI providers (e.g., Azure OpenAI) when configured</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Managed Cloud Service:</strong> We retain your account information and processed documents
              for as long as your account is active. You may request deletion of your account and associated
              data at any time by contacting us. Upon account deletion, your data will be removed within 30 days.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Self-Hosted Deployments:</strong> Data retention is entirely under your control.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the following rights regarding your personal data:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Request transfer of your data</li>
              <li><strong>Objection:</strong> Object to certain processing activities</li>
              <li><strong>Restriction:</strong> Request limitation of processing</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise these rights, please contact us at{' '}
              <a href="mailto:nick@fetchtext.io" className="text-primary hover:underline">
                nick@fetchtext.io
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our website uses essential cookies for authentication and session management. We may also
              use analytics cookies to understand website usage. You can control cookie preferences
              through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect
              personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              <strong>Managed Cloud Service:</strong> If you access our service from outside the United States,
              your information may be transferred to and processed in the United States or other countries
              where our cloud infrastructure is located. We use appropriate safeguards for international transfers.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Self-Hosted Deployments:</strong> Your data remains in the location you choose for your infrastructure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by
              updating the "Last updated" date at the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <strong>Email:</strong>{' '}
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
