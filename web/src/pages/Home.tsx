import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Slack } from 'lucide-react';
import { Navbar } from '../components';
import { LordIcon } from '../components/LordIcon';

export const meta = () => {
    return [
        { title: 'Daily Dose - Automate Your Team Standups | Slack Bot' },
        { name: 'description', content: 'Daily Dose - Automate your team\'s daily standup meetings with our intelligent Slack bot. Save time, improve communication, and boost productivity.' },
        { name: 'keywords', content: 'slack bot, daily standup, team productivity, automation, remote work' },
        { name: 'author', content: 'Daily Dose' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: '' },
        { property: 'og:title', content: 'Daily Dose - Automate Your Team Standups' },
        { property: 'og:description', content: 'Intelligent Slack bot that automates daily standup meetings for better team communication and productivity.' },
        { property: 'og:image', content: '/logo.png' },
        { property: 'twitter:card', content: 'summary_large_image' },
        { property: 'twitter:url', content: '' },
        { property: 'twitter:title', content: 'Daily Dose - Automate Your Team Standups' },
        { property: 'twitter:description', content: 'Intelligent Slack bot that automates daily standup meetings for better team communication and productivity.' },
        { property: 'twitter:image', content: '/logo.png' },
    ];
};


const Hero = () => {
    return (
        <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-brand-cyan/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-blue/20 rounded-full blur-[100px]" />
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-block py-1 px-3 rounded-full bg-brand-blue/10 text-brand-cyan text-sm font-semibold mb-6 border border-brand-blue/20">
                            🚀 The Ultimate Standup Bot for Slack
                        </span>
                        <h1 className="text-5xl sm:text-7xl font-extrabold text-white tracking-tight mb-8 leading-tight">
                            Automate your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan to-brand-blue">
                                Daily Standups
                            </span>
                        </h1>
                        <p className="mt-4 text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
                            Streamline your team's daily syncs, track progress, and remove blockers without the meeting fatigue.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button className="px-8 py-4 bg-gradient-to-r from-brand-cyan to-brand-blue rounded-full text-white font-bold text-lg hover:shadow-[0_0_20px_rgba(0,207,255,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-2">
                                <Slack size={20} />
                                Add to Slack
                            </button>
                            <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                                View Documentation
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Hero Visual/Infographic */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-20 relative mx-auto max-w-5xl"
                >
                    <div className="bg-brand-navy-light border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-sm">
                        <div className="bg-brand-navy rounded-xl border border-white/5 overflow-hidden relative aspect-[16/9] flex items-center justify-center">
                            {/* Abstract UI Representation */}
                            <div className="absolute inset-0 bg-grid-white/[0.02]" />

                            <div className="flex items-center justify-center gap-8 md:gap-16 relative z-10 w-full px-10">
                                {/* User Node */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group">
                                        <div className="absolute inset-0 bg-brand-cyan/20 blur-xl group-hover:bg-brand-cyan/30 transition-all" />
                                        <LordIcon src="https://cdn.lordicon.com/mebvgwrs.json" trigger="loop" colors="primary:#00cfff,secondary:#00afff" size={48} />
                                    </div>
                                    <span className="text-gray-400 font-medium">Team Member</span>
                                </div>

                                {/* Connection Line 1 */}
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-brand-cyan/20 to-brand-blue/20 relative">
                                    <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 bg-brand-cyan rounded-full animate-pulse" />
                                    <motion.div
                                        animate={{ x: [0, 100, 0] }}
                                        transition={{ duration: 3, repeat: Infinity }}
                                        className="absolute top-1/2 -translate-y-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-brand-cyan to-transparent opacity-50"
                                    />
                                </div>

                                {/* Bot Node */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-brand-navy-light to-brand-navy border border-brand-cyan/30 flex items-center justify-center relative shadow-[0_0_30px_rgba(0,207,255,0.15)]">
                                        <LordIcon src="https://cdn.lordicon.com/qeltvbrs.json" trigger="loop" colors="primary:#ffffff,secondary:#00afff" size={64} />
                                    </div>
                                    <span className="text-white font-bold">Daily Dose Bot</span>
                                </div>

                                {/* Connection Line 2 */}
                                <div className="flex-1 h-0.5 bg-gradient-to-r from-brand-blue/20 to-brand-cyan/20 relative">
                                    <motion.div
                                        animate={{ x: [0, 100, 0] }}
                                        transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                                        className="absolute top-1/2 -translate-y-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-brand-blue to-transparent opacity-50"
                                    />
                                </div>

                                {/* Channel Node */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative group">
                                        <div className="absolute inset-0 bg-brand-blue/20 blur-xl group-hover:bg-brand-blue/30 transition-all" />
                                        <LordIcon src="https://cdn.lordicon.com/ayhtotha.json" trigger="loop" colors="primary:#00afff,secondary:#00cfff" size={48} />
                                    </div>
                                    <span className="text-gray-400 font-medium">Team Channel</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

const FeatureCard = ({ title, description, icon, delay }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay, duration: 0.5 }}
        className="bg-brand-navy-light p-8 rounded-3xl border border-white/5 hover:border-brand-cyan/30 transition-all group hover:shadow-[0_0_30px_rgba(0,207,255,0.05)]"
    >
        <div className="w-14 h-14 bg-brand-navy rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-white/5">
            <LordIcon src={icon} trigger="hover" colors="primary:#00cfff,secondary:#00afff" size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-gray-400 leading-relaxed">{description}</p>
    </motion.div>
);

const Features = () => {
    const features = [
        {
            title: "Automated Reminders",
            description: "Set it and forget it. The bot automatically reminds your team to submit their standups at your chosen time.",
            icon: "https://cdn.lordicon.com/kbtmbyzy.json", // Clock
            delay: 0.1
        },
        {
            title: "Smart Summaries",
            description: "Get a beautifully formatted summary of everyone's updates posted directly to your Slack channel.",
            icon: "https://cdn.lordicon.com/nocovwne.json", // Document/Report
            delay: 0.2
        },
        {
            title: "Timezone Aware",
            description: "Perfect for remote teams. Configure standup times per team to match their local working hours.",
            icon: "https://cdn.lordicon.com/abfverha.json", // Globe
            delay: 0.3
        },
        {
            title: "Leave Management",
            description: "Mark yourself as away or on vacation. The bot won't bug you while you're recharging.",
            icon: "https://cdn.lordicon.com/hursldrn.json", // Calendar
            delay: 0.4
        },
        {
            title: "Multiple Teams",
            description: "Support for multiple teams within a single organization. Engineering, Marketing, Design - all covered.",
            icon: "https://cdn.lordicon.com/uukerzzv.json", // Network/Teams
            delay: 0.5
        },
        {
            title: "Detailed History",
            description: "Access past standups easily. Keep a record of progress and blockers over time.",
            icon: "https://cdn.lordicon.com/gqdnbnwt.json", // History/Search
            delay: 0.6
        }
    ];

    return (
        <section id="features" className="py-24 relative">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything you need to <br />sync your team</h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">Powerful features designed to make daily updates effortless and effective.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((f, i) => (
                        <FeatureCard key={i} {...f} />
                    ))}
                </div>
            </div>
        </section>
    );
};

const Step = ({ number, title, description, isLast }: any) => (
    <div className="flex gap-6 relative">
        {!isLast && (
            <div className="absolute left-6 top-16 bottom-0 w-0.5 bg-gradient-to-b from-brand-cyan/30 to-transparent" />
        )}
        <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-brand-navy-light border border-brand-cyan/30 flex items-center justify-center text-brand-cyan font-bold text-xl shadow-[0_0_15px_rgba(0,207,255,0.2)]">
                {number}
            </div>
        </div>
        <div className="pb-16">
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
            <p className="text-gray-400">{description}</p>
        </div>
    </div>
);

const HowItWorks = () => {
    return (
        <section id="how-it-works" className="py-24 bg-brand-navy-light/30 border-y border-white/5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div>
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">How it works</h2>
                        <p className="text-gray-400 mb-12">Get started in minutes. No complex configuration required.</p>

                        <div className="space-y-2">
                            <Step
                                number="1"
                                title="Add to Slack"
                                description="Install the bot to your workspace with a single click. It's secure and requires minimal permissions."
                            />
                            <Step
                                number="2"
                                title="Create a Team"
                                description="Use the /dd-team-create command to set up your team and choose your standup schedule."
                            />
                            <Step
                                number="3"
                                title="Start Syncing"
                                description="The bot will automatically remind members and post summaries. Sit back and relax."
                                isLast
                            />
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 bg-brand-cyan/10 blur-[80px] rounded-full" />
                        <div className="bg-brand-navy border border-white/10 rounded-2xl p-6 relative shadow-2xl">
                            {/* Mock Slack Interface */}
                            <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>

                            <div className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded bg-brand-cyan flex items-center justify-center text-brand-navy font-bold">D</div>
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-white">Daily Dose</span>
                                            <span className="text-xs text-gray-500">APP 9:30 AM</span>
                                        </div>
                                        <div className="bg-brand-navy-light p-3 rounded-lg border-l-4 border-brand-cyan mt-1 text-sm text-gray-300">
                                            It's time for the <b>Engineering</b> standup! 🚀<br />
                                            Please submit your updates.
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded bg-gray-600" />
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="font-bold text-white">Sarah</span>
                                            <span className="text-xs text-gray-500">9:32 AM</span>
                                        </div>
                                        <div className="text-gray-300 text-sm">
                                            Submitted via Daily Dose
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => (
    <footer className="bg-brand-navy border-t border-white/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-2 mb-4">
                        <img src="/logo.png" alt="Daily Dose Logo" className="w-8 h-8 rounded-lg" />
                        <span className="text-white font-bold text-xl tracking-tight">Daily Dose</span>
                    </div>
                    <p className="text-gray-400 max-w-xs">
                        The modern standup bot for high-performing teams. Built for Slack.
                    </p>
                </div>

                <div>
                    <h4 className="text-white font-bold mb-4">Product</h4>
                    <ul className="space-y-2 text-gray-400">
                        <li><a href="#features" className="hover:text-brand-cyan transition-colors">Features</a></li>
                        <li><a href="#how-it-works" className="hover:text-brand-cyan transition-colors">How it Works</a></li>
                        <li><Link to="/docs" className="hover:text-brand-cyan transition-colors">Documentation</Link></li>
                        <li><Link to="/changelog" className="hover:text-brand-cyan transition-colors">Changelog</Link></li>
                    </ul>
                </div>

                <div>
                    <h4 className="text-white font-bold mb-4">Legal</h4>
                    <ul className="space-y-2 text-gray-400">
                        <li><a href="#" className="hover:text-brand-cyan transition-colors">Privacy Policy</a></li>
                        <li><a href="#" className="hover:text-brand-cyan transition-colors">Terms of Service</a></li>
                        <li><a href="#" className="hover:text-brand-cyan transition-colors">Contact</a></li>
                    </ul>
                </div>
            </div>
            <div className="mt-12 pt-8 border-t border-white/5 text-center text-gray-500 text-sm">
                © {new Date().getFullYear()} Daily Dose Bot. All rights reserved.
            </div>
        </div>
    </footer>
);

const Home = () => {
    return (
        <div className="min-h-screen bg-brand-navy text-white selection:bg-brand-cyan/30">
            <Navbar />
            <Hero />
            <Features />
            <HowItWorks />
            <Footer />
        </div>
    );
};

export default Home;
