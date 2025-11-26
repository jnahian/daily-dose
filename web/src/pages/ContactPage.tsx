import { Mail, Github, MessageSquare } from 'lucide-react';

export const meta = () => {
  return [
    { title: 'Contact Us - Daily Dose | Slack Bot' },
    {
      name: 'description',
      content:
        'Get in touch with the Daily Dose team. We are here to help with any questions or feedback about our Slack bot.',
    },
    {
      name: 'keywords',
      content: 'contact us, support, feedback, daily dose, slack bot',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '/contact' },
    { property: 'og:title', content: 'Contact Us - Daily Dose' },
    {
      property: 'og:description',
      content:
        'Get in touch with the Daily Dose team for support and feedback.',
    },
    { property: 'og:image', content: '/logo.png' },
  ];
};

const ContactPage = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary pt-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
        <p className="text-text-secondary text-lg mb-12">
          We'd love to hear from you. Let us know how we can help!
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* GitHub */}
          <a
            href="https://github.com/jnahian/daily-dose"
            target="_blank"
            rel="noopener noreferrer"
            className="p-8 rounded-lg border border-border-default bg-bg-secondary hover:border-brand-cyan/50 transition-all duration-300 hover:shadow-lg hover:shadow-brand-cyan/10"
          >
            <div className="flex items-start gap-4">
              <Github className="w-8 h-8 text-brand-cyan flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold mb-2">GitHub Issues</h3>
                <p className="text-text-secondary mb-4">
                  Found a bug or have a feature request? Open an issue on our GitHub
                  repository.
                </p>
                <p className="text-brand-cyan font-medium flex items-center gap-2">
                  github.com/jnahian/daily-dose
                </p>
              </div>
            </div>
          </a>

          {/* Discussions */}
          <a
            href="https://github.com/jnahian/daily-dose/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="p-8 rounded-lg border border-border-default bg-bg-secondary hover:border-brand-cyan/50 transition-all duration-300 hover:shadow-lg hover:shadow-brand-cyan/10"
          >
            <div className="flex items-start gap-4">
              <MessageSquare className="w-8 h-8 text-brand-cyan flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold mb-2">GitHub Discussions</h3>
                <p className="text-text-secondary mb-4">
                  Have questions or want to discuss ideas? Start a discussion with our
                  community.
                </p>
                <p className="text-brand-cyan font-medium flex items-center gap-2">
                  Join the conversation
                </p>
              </div>
            </div>
          </a>
        </div>

        {/* Additional Contact Section */}
        <div className="bg-bg-secondary border border-border-default rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Mail className="w-6 h-6 text-brand-cyan" />
            Other Ways to Reach Us
          </h2>
          <div className="space-y-4 text-text-secondary">
            <p>
              <strong>For general inquiries:</strong> You can open an issue on GitHub
              or participate in GitHub Discussions.
            </p>
            <p>
              <strong>For security concerns:</strong> Please open an issue on GitHub
              and mark it as a security concern. Do not publicly disclose security
              vulnerabilities.
            </p>
            <p>
              <strong>For feedback and suggestions:</strong> We'd love to hear your
              ideas! Please share them on GitHub Discussions or open a feature request
              as an issue.
            </p>
            <p>
              <strong>For documentation issues:</strong> If you find any errors or have
              suggestions for improving our documentation, please open an issue on
              GitHub.
            </p>
          </div>
        </div>

        {/* Community Section */}
        <div className="mt-12 p-8 rounded-lg border border-brand-cyan/20 bg-brand-cyan/5">
          <h2 className="text-2xl font-bold mb-4">Join Our Community</h2>
          <p className="text-text-secondary mb-6">
            We're building Daily Dose in the open. Join us on GitHub to stay updated
            on new features, improvements, and releases.
          </p>
          <a
            href="https://github.com/jnahian/daily-dose"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-cyan border border-brand-blue/20 rounded-lg transition-colors font-medium"
          >
            <Github className="w-5 h-5" />
            Visit Our GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
