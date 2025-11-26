import { Hero, Features, HowItWorks, Contact, Footer } from '../components/home';

export const meta = () => {
  return [
    { title: 'Daily Dose - Automate Your Team Standups | Slack Bot' },
    {
      name: 'description',
      content:
        "Daily Dose - Automate your team's daily standup meetings with our intelligent Slack bot. Save time, improve communication, and boost productivity.",
    },
    {
      name: 'keywords',
      content: 'slack bot, daily standup, team productivity, automation, remote work',
    },
    { name: 'author', content: 'Daily Dose' },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: '' },
    { property: 'og:title', content: 'Daily Dose - Automate Your Team Standups' },
    {
      property: 'og:description',
      content:
        'Intelligent Slack bot that automates daily standup meetings for better team communication and productivity.',
    },
    { property: 'og:image', content: '/logo.png' },
    { property: 'twitter:card', content: 'summary_large_image' },
    { property: 'twitter:url', content: '' },
    { property: 'twitter:title', content: 'Daily Dose - Automate Your Team Standups' },
    {
      property: 'twitter:description',
      content:
        'Intelligent Slack bot that automates daily standup meetings for better team communication and productivity.',
    },
    { property: 'twitter:image', content: '/logo.png' },
  ];
};

const Home = () => {
  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-brand-cyan/30 transition-colors duration-300">
      <Hero />
      <Features />
      <HowItWorks />
      <Contact />
      <Footer />
    </div>
  );
};

export default Home;
