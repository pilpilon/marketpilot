export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 31, 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using MarketPilot (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. Description of Service</h2>
          <p>MarketPilot is a social media management platform that provides AI-powered content creation, scheduling, and publishing tools for businesses and creators.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. User Accounts</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must be at least 18 years old to use the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Content and Intellectual Property</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>You retain ownership of the content you create and upload to MarketPilot.</li>
            <li>AI-generated content (images, captions) created through the Service may be used freely by you for any purpose.</li>
            <li>You grant us a limited license to process your content as necessary to provide the Service.</li>
            <li>You are responsible for ensuring your content does not infringe on third-party rights.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Social Media Accounts</h2>
          <ul className="list-disc ps-6 space-y-2">
            <li>By connecting social media accounts, you authorize MarketPilot to post content on your behalf.</li>
            <li>You are responsible for complying with each platform&apos;s terms of service.</li>
            <li>You can disconnect your accounts at any time through the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc ps-6 space-y-2">
            <li>Use the Service for any unlawful purpose.</li>
            <li>Generate or distribute harmful, misleading, or offensive content.</li>
            <li>Attempt to gain unauthorized access to the Service or its systems.</li>
            <li>Use the Service to spam or harass others.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the Service, including but not limited to issues with social media publishing, AI-generated content accuracy, or service availability.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Termination</h2>
          <p>We may suspend or terminate your access to the Service at any time for violation of these terms. You may delete your account at any time by contacting us.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">9. Changes to Terms</h2>
          <p>We may update these terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated terms.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">10. Contact</h2>
          <p>For questions about these Terms, contact us at: <a href="mailto:elefantidan@gmail.com" className="text-primary underline">elefantidan@gmail.com</a></p>
        </section>
      </div>
    </div>
  );
}
