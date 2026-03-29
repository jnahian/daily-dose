import { formatCurrentDate } from '../utils/dateUtils';

export const meta = () => {
  return [
    { title: 'Terms of Service - Daily Dose | Slack Bot' },
    {
      name: 'description',
      content:
        'Terms of Service for Daily Dose Slack bot. Review our terms and conditions of use.',
    },
    {
      name: 'keywords',
      content: 'terms of service, terms of use, slack bot, daily dose',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '/terms' },
    { property: 'og:title', content: 'Terms of Service - Daily Dose' },
    {
      property: 'og:description',
      content: 'Terms of Service for Daily Dose Slack bot.',
    },
    { property: 'og:image', content: '/logo.png' },
  ];
};

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none">
          <p className="text-text-secondary mb-6">
            Last updated: {formatCurrentDate()}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Acceptance of Terms</h2>
            <p className="text-text-secondary mb-4">
              By accessing and using the Daily Dose Slack bot (the "Service"), you
              accept and agree to be bound by the terms and provision of this agreement.
              If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Use License</h2>
            <p className="text-text-secondary mb-4">
              Permission is granted to temporarily download one copy of the materials
              (information or software) on Daily Dose for personal, non-commercial
              transitory viewing only. This is the grant of a license, not a transfer
              of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-2 mb-4">
              <li>Modifying or copying the materials</li>
              <li>
                Using the materials for any commercial purpose or for any public
                display
              </li>
              <li>Attempting to decompile or reverse engineer any software</li>
              <li>Removing any copyright or other proprietary notations</li>
              <li>
                Transferring the materials to another person or "mirroring" the
                materials on any other server
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Disclaimer</h2>
            <p className="text-text-secondary mb-4">
              The materials on Daily Dose are provided on an 'as is' basis. Daily Dose
              makes no warranties, expressed or implied, and hereby disclaims and
              negates all other warranties including, without limitation, implied
              warranties or conditions of merchantability, fitness for a particular
              purpose, or non-infringement of intellectual property or other violation
              of rights.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Limitations</h2>
            <p className="text-text-secondary mb-4">
              In no event shall Daily Dose or its suppliers be liable for any damages
              (including, without limitation, damages for loss of data or profit, or
              due to business interruption) arising out of the use or inability to use
              the materials on Daily Dose, even if we or our authorized representative
              has been notified orally or in writing of the possibility of such damage.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Accuracy of Materials</h2>
            <p className="text-text-secondary mb-4">
              The materials appearing on Daily Dose could include technical,
              typographical, or photographic errors. Daily Dose does not warrant that
              any of the materials on its Service are accurate, complete, or current.
              Daily Dose may make changes to the materials contained on its Service at
              any time without notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Links</h2>
            <p className="text-text-secondary mb-4">
              Daily Dose has not reviewed all of the sites linked to its Service and is
              not responsible for the contents of any such linked site. The inclusion
              of any link does not imply endorsement by Daily Dose of the site. Use of
              any such linked website is at the user's own risk.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Modifications</h2>
            <p className="text-text-secondary mb-4">
              Daily Dose may revise these terms of service for its Service at any time
              without notice. By using this Service, you are agreeing to be bound by the
              then current version of these terms of service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Governing Law</h2>
            <p className="text-text-secondary mb-4">
              These terms and conditions are governed by and construed in accordance
              with the laws of the jurisdiction in which Daily Dose operates, and you
              irrevocably submit to the exclusive jurisdiction of the courts in that
              location.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
            <p className="text-text-secondary">
              If you have any questions about these Terms of Service, please contact us
              at{' '}
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

export default TermsOfService;
