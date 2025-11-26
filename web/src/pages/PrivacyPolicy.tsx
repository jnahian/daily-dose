export const meta = () => {
  return [
    { title: 'Privacy Policy - Daily Dose | Slack Bot' },
    {
      name: 'description',
      content:
        'Privacy Policy for Daily Dose Slack bot. Learn how we collect, use, and protect your data.',
    },
    {
      name: 'keywords',
      content: 'privacy policy, data protection, slack bot privacy, daily dose',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '/privacy' },
    { property: 'og:title', content: 'Privacy Policy - Daily Dose' },
    {
      property: 'og:description',
      content: 'Privacy Policy for Daily Dose Slack bot.',
    },
    { property: 'og:image', content: '/logo.png' },
  ];
};

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none">
          <p className="text-text-secondary mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p className="text-text-secondary mb-4">
              Daily Dose ("we", "our", or "us") operates the Daily Dose Slack bot
              (the "Service"). This page informs you of our policies regarding the
              collection, use, and disclosure of personal data when you use our
              Service and the choices you have associated with that data.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Information Collection and Use</h2>
            <p className="text-text-secondary mb-4">
              We collect several different types of information for various purposes
              to provide and improve our Service to you.
            </p>
            <h3 className="text-xl font-semibold mb-3">Types of Data Collected:</h3>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mb-4">
              <li>
                <strong>Personal Data:</strong> While using our Service, we may ask you
                to provide us with certain personally identifiable information that can
                be used to contact or identify you ("Personal Data"). This may include,
                but is not limited to:
                <ul className="list-circle list-inside ml-6 mt-2 space-y-1">
                  <li>Slack workspace ID and user ID</li>
                  <li>Display name and email address</li>
                  <li>Standup responses and team information</li>
                </ul>
              </li>
              <li>
                <strong>Usage Data:</strong> We may also collect information on how the
                Service is accessed and used ("Usage Data"). This may include information
                such as your computer's Internet Protocol address, browser type, browser
                version, the pages you visit, and other diagnostic data.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Use of Data</h2>
            <p className="text-text-secondary mb-4">
              Daily Dose uses the collected data for various purposes:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2">
              <li>To provide and maintain our Service</li>
              <li>To notify you about changes to our Service</li>
              <li>To allow you to participate in interactive features of our Service</li>
              <li>To provide customer care and support</li>
              <li>
                To gather analysis or valuable information so that we can improve our
                Service
              </li>
              <li>To monitor the usage of our Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Security of Data</h2>
            <p className="text-text-secondary mb-4">
              The security of your data is important to us but remember that no method
              of transmission over the Internet or method of electronic storage is 100%
              secure. While we strive to use commercially acceptable means to protect
              your Personal Data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Changes to This Privacy Policy</h2>
            <p className="text-text-secondary mb-4">
              We may update our Privacy Policy from time to time. We will notify you of
              any changes by posting the new Privacy Policy on this page and updating
              the "Last updated" date at the top of this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-text-secondary">
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a
                href="https://github.com/jnahian/daily-dose"
                className="text-brand-cyan hover:text-brand-cyan/80 transition-colors"
              >
                our GitHub repository
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
