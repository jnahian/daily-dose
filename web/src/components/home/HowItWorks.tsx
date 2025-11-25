interface StepProps {
    number: string;
    title: string;
    description: string;
    isLast?: boolean;
}

const Step = ({ number, title, description, isLast }: StepProps) => (
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

export const HowItWorks = () => {
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
