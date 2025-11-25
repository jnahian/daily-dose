import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Slack } from 'lucide-react';

export const Hero = () => {
  return (
    <div className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-cyan/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-brand-blue/20 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left Column: Content */}
          <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
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
              <p className="mt-4 text-xl text-gray-400 mb-10 max-w-lg mx-auto lg:mx-0">
                Streamline your team's daily syncs, track progress, and remove blockers without the
                meeting fatigue.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center">
                <button className="px-8 py-4 bg-gradient-to-r from-brand-cyan to-brand-blue rounded-full text-white font-bold text-lg hover:shadow-[0_0_20px_rgba(0,207,255,0.5)] transition-all transform hover:-translate-y-1 flex items-center gap-2">
                  <Slack size={20} />
                  Add to Slack
                </button>
                <Link
                  to="/docs"
                  className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  View Documentation
                  <ArrowRight size={18} />
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Slack Mock Infographic */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mx-auto w-full max-w-lg lg:max-w-none"
          >
            <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-sm">
              {/* Slack Header Mock */}
              <div className="bg-slate-950/50 border-b border-white/5 p-4 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="h-4 w-px bg-white/10 mx-2" />
                <span className="text-gray-400 text-sm font-medium flex items-center gap-1">
                  <span className="text-gray-600">#</span> daily-standup
                </span>
              </div>

              {/* Slack Messages Area */}
              <div className="p-6 space-y-6">
                {/* Bot Message */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-cyan to-brand-blue flex items-center justify-center text-white">
                      <img src="/logo.png" alt="Daily Dose" />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-white">Daily Dose</span>
                      <span className="bg-brand-blue/20 text-brand-blue text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                        APP
                      </span>
                      <span className="text-xs text-gray-500">9:00 AM</span>
                    </div>
                    <div className="text-gray-300 text-sm leading-relaxed">
                      <p className="mb-2">Good morning! It's time for our daily standup. 🚀</p>
                      <div className="pl-3 border-l-2 border-white/10 space-y-1 text-gray-400">
                        <p>1. What did you accomplish yesterday?</p>
                        <p>2. What are you working on today?</p>
                        <p>3. Any blockers?</p>
                      </div>
                      <button className="mt-3 px-4 py-1.5 bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-cyan text-sm font-medium rounded border border-brand-blue/20 transition-colors">
                        Submit Standup
                      </button>
                    </div>
                  </div>
                </div>

                {/* User Reply */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="flex gap-4"
                >
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                      JD
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-white">John Doe</span>
                      <span className="text-xs text-gray-500">9:05 AM</span>
                    </div>
                    <div className="text-gray-300 text-sm leading-relaxed">
                      <p>Here's my update:</p>
                      <ul className="list-disc list-inside space-y-1 mt-1 text-gray-300">
                        <li>Fixed the authentication bug 🐛</li>
                        <li>Working on the new dashboard layout 📊</li>
                        <li>No blockers at the moment ✅</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Decorative Elements around the mock */}
            <div className="absolute -z-10 top-1/2 right-0 -translate-y-1/2 translate-x-1/4 w-64 h-64 bg-brand-cyan/10 rounded-full blur-[80px]" />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
