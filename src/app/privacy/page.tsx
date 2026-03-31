export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: March 31, 2026</p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">1. Introduction</h2>
          <p>MarketPilot (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is a social media management platform that helps businesses create and publish content. This Privacy Policy explains how we collect, use, and protect your information.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account information:</strong> Email address and password when you sign up.</li>
            <li><strong>Brand information:</strong> Business name, brand guidelines, visual assets, and content you provide to create marketing materials.</li>
            <li><strong>Social media data:</strong> When you connect social accounts (Instagram, Twitter/X, TikTok), we receive an access token and basic profile information (username, profile picture). We do not store your social media password.</li>
            <li><strong>Generated content:</strong> Images, captions, and other content created using our AI tools.</li>
            <li><strong>Usage data:</strong> Pages visited, features used, and interactions within the platform.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide and improve our services.</li>
            <li>To generate AI-powered content tailored to your brand.</li>
            <li>To publish content to your connected social media accounts on your behalf.</li>
            <li>To communicate with you about your account and service updates.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">4. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Supabase:</strong> Database and authentication.</li>
            <li><strong>Google AI (Gemini):</strong> AI-powered image and text generation. Content you provide may be sent to Google&apos;s API for processing.</li>
            <li><strong>Meta/Instagram API:</strong> To publish content and manage your Instagram presence.</li>
            <li><strong>Vercel:</strong> Hosting and deployment.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">5. Data Storage and Security</h2>
          <p>Your data is stored securely using Supabase with row-level security policies. Social media access tokens are encrypted and stored in Supabase Vault. We use HTTPS for all data transmission.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Retention and Deletion</h2>
          <p>You can request deletion of your data at any time by contacting us at elefantidan@gmail.com or by using the data deletion feature in your account settings. When you disconnect a social media account, we immediately delete the associated access tokens.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Disconnect your social media accounts at any time.</li>
            <li>Export your data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-3">8. Contact</h2>
          <p>For questions about this Privacy Policy or to exercise your rights, contact us at: <a href="mailto:elefantidan@gmail.com" className="text-primary underline">elefantidan@gmail.com</a></p>
        </section>
      </div>
    </div>
  );
}
