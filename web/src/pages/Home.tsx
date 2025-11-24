import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faRocket,
  faPlay,
  faBell,
  faUsers,
  faUmbrellaBeach,
  faCalendar,
  faBuilding,
  faClock,
  faCheckCircle,
  faEnvelope,
} from '@fortawesome/free-solid-svg-icons'
import { faSlack } from '@fortawesome/free-brands-svg-icons'

export function Home() {
  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  const features = [
    {
      icon: faBell,
      title: 'Automated Reminders',
      description:
        'Send personalized DM reminders at configured times. Never miss a standup again with smart, timezone-aware scheduling.',
      bgClass: 'bg-primary/10',
      iconClass: 'text-primary',
    },
    {
      icon: faUsers,
      title: 'Team Management',
      description:
        'Create and join teams with custom schedules. Flexible team organization with admin controls and member permissions.',
      bgClass: 'bg-secondary/10',
      iconClass: 'text-secondary',
    },
    {
      icon: faUmbrellaBeach,
      title: 'Leave Management',
      description:
        'Set vacation and leave dates to automatically skip reminders. Smart exclusion from standup expectations when you are away.',
      bgClass: 'bg-green-500/10',
      iconClass: 'text-green-500',
    },
    {
      icon: faCalendar,
      title: 'Work Day Configuration',
      description:
        'Customize working days for each team member. Perfect for part-time workers and flexible schedules.',
      bgClass: 'bg-yellow-500/10',
      iconClass: 'text-yellow-500',
    },
    {
      icon: faBuilding,
      title: 'Multi-Organization',
      description:
        'Support for multiple organizations and workspaces. Scale across your entire company with centralized management.',
      bgClass: 'bg-red-500/10',
      iconClass: 'text-red-500',
    },
    {
      icon: faClock,
      title: 'Late Submission Tracking',
      description:
        'Handle late submissions gracefully with automatic thread replies. Keep the conversation flowing even after posting time.',
      bgClass: 'bg-indigo-500/10',
      iconClass: 'text-indigo-500',
    },
  ]

  return (
    <>
      {/* Hero Section */}
      <section className="pt-24 pb-20 bg-linear-to-br from-cyan-50 via-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-8">
              <img
                src="/logo.png"
                alt="Daily Dose Logo"
                className="h-24 w-24 mx-auto mb-6"
              />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Automate Your Team's{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
                Daily Standups
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Daily Dose is an intelligent Slack bot that streamlines your team's
              standup meetings. Save time, improve communication, and boost
              productivity with automated reminders and beautiful summaries.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={scrollToContact}
                className="bg-primary hover:bg-[#00AFFF] text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl inline-flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faRocket} />
                Get Daily Dose for Your Team
              </button>
              <button
                onClick={scrollToFeatures}
                className="border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all inline-flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faPlay} />
                See How It Works
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              ✨ Powerful Features for Modern Teams
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Everything you need to run efficient, engaging daily standups that
              your team will actually love.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-gray-50 p-8 rounded-xl hover:shadow-lg transition-shadow"
              >
                <div
                  className={`${feature.bgClass} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
                >
                  <FontAwesomeIcon
                    icon={feature.icon}
                    className={`${feature.iconClass} text-xl`}
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="py-20 bg-linear-to-br from-gray-50 to-cyan-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              🔄 How Daily Dose Works
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Simple, automated workflow that fits seamlessly into your team's
              routine.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: 1,
                title: 'Morning Reminder',
                description:
                  "Daily Dose sends personalized DM reminders at your team's configured standup time. No more forgotten standups!",
                bgClass: 'bg-primary/10',
                textClass: 'text-primary',
              },
              {
                step: 2,
                title: 'Submit Updates',
                description:
                  "Team members respond with yesterday's tasks, today's plans, and any blockers through an intuitive modal interface.",
                bgClass: 'bg-secondary/10',
                textClass: 'text-secondary',
              },
              {
                step: 3,
                title: 'Beautiful Summary',
                description:
                  'At posting time, Daily Dose creates a formatted summary in your team channel, keeping everyone aligned and informed.',
                bgClass: 'bg-green-500/10',
                textClass: 'text-green-500',
              },
            ].map((step) => (
              <div key={step.step} className="text-center">
                <div
                  className={`${step.bgClass} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6`}
                >
                  <span className={`text-2xl font-bold ${step.textClass}`}>
                    {step.step}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  {step.title}
                </h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                💡 Why Teams Choose Daily Dose
              </h2>
              <div className="space-y-6">
                {[
                  {
                    title: 'Save 30+ Minutes Daily',
                    description:
                      'Eliminate manual standup coordination and reduce meeting overhead with automated workflows.',
                  },
                  {
                    title: 'Boost Participation',
                    description:
                      'Friendly reminders and easy-to-use interfaces increase team engagement by 85%.',
                  },
                  {
                    title: 'Better Team Alignment',
                    description:
                      'Consistent, structured updates keep everyone informed about team progress and blockers.',
                  },
                  {
                    title: 'Secure & Private',
                    description:
                      'Enterprise-grade security with data privacy controls and compliance-ready features.',
                  },
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className="bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-primary"
                      />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {benefit.title}
                      </h3>
                      <p className="text-gray-600">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-linear-to-br from-primary to-secondary p-8 rounded-2xl text-white">
              <h3 className="text-2xl font-bold mb-6">Perfect for Modern Teams</h3>
              <div className="space-y-4">
                {[
                  'Remote and hybrid workforces',
                  'Agile and scrum teams',
                  'Cross-functional project teams',
                  'Multiple timezone organizations',
                  'Fast-growing companies',
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={scrollToContact}
                className="mt-6 bg-white text-primary hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition-all w-full"
              >
                Get Started Today →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Contact/CTA Section */}
      <section id="contact" className="py-20 bg-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            🚀 Ready to Transform Your Standups?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join teams that have already saved thousands of hours with Daily Dose.
            Contact us to get started with your custom installation.
          </p>

          <div className="bg-gray-800 p-8 rounded-2xl max-w-2xl mx-auto">
            <h3 className="text-xl font-semibold text-white mb-6">
              Get Daily Dose for Your Team
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="mailto:contact@dailydose.bot"
                  className="flex-1 bg-primary hover:bg-[#00AFFF] text-white px-6 py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faEnvelope} />
                  Email Us
                </a>
                <Link
                  to="/documentation/user-guide"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faSlack} />
                  View Documentation
                </Link>
              </div>
              <p className="text-gray-400 text-sm">
                We'll help you set up Daily Dose for your workspace and provide
                full onboarding support.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
