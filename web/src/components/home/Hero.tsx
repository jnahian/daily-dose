import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { ArrowRight, Slack } from 'lucide-react';
import { LordIcon } from '../LordIcon';

export const Hero = () => {
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
                            <Link to="/docs" className="px-8 py-4 bg-white/5 border border-white/10 rounded-full text-white font-semibold hover:bg-white/10 transition-all flex items-center gap-2">
                                View Documentation
                                <ArrowRight size={18} />
                            </Link>
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
