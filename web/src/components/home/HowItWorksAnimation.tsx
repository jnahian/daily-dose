import { motion } from "framer-motion";
import { Bot, MessageSquare, Users, Zap } from "lucide-react";

export const HowItWorksAnimation = () => {
    return (
        <div className="relative w-full h-[400px] flex items-center justify-center">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-brand-cyan/5 blur-[100px] rounded-full" />

            {/* Main Container */}
            <div className="relative w-full max-w-md aspect-square">

                {/* Central Bot Hub */}
                <motion.div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.5, type: "spring" }}
                >
                    <div className="relative">
                        <div className="w-20 h-20 bg-brand-navy rounded-2xl border-2 border-brand-cyan flex items-center justify-center shadow-[0_0_30px_rgba(0,207,255,0.3)]">
                            <Bot className="w-10 h-10 text-brand-cyan" />
                        </div>
                        {/* Pulse Rings */}
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                className="absolute inset-0 rounded-2xl border border-brand-cyan/30"
                                animate={{
                                    scale: [1, 1.5, 1.8],
                                    opacity: [0.5, 0.2, 0],
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    delay: i * 0.4,
                                    ease: "easeOut",
                                }}
                            />
                        ))}
                    </div>
                </motion.div>

                {/* Satellite Nodes (Team Members) */}
                {[0, 1, 2].map((i) => {
                    const angle = (i * 120 - 90) * (Math.PI / 180);
                    const radius = 140;
                    const x = Math.cos(angle) * radius;
                    const y = Math.sin(angle) * radius;

                    return (
                        <motion.div
                            key={i}
                            className="absolute left-1/2 top-1/2 z-10"
                            initial={{ x: 0, y: 0, opacity: 0 }}
                            animate={{
                                x,
                                y,
                                opacity: 1
                            }}
                            transition={{
                                delay: 0.5 + i * 0.2,
                                duration: 0.5,
                                type: "spring"
                            }}
                        >
                            <div className="relative -translate-x-1/2 -translate-y-1/2">
                                <div className="w-12 h-12 bg-brand-navy-light rounded-full border border-white/10 flex items-center justify-center">
                                    <Users className="w-5 h-5 text-gray-400" />
                                </div>

                                {/* Connection Line */}
                                <svg className="absolute top-1/2 left-1/2 -z-10 w-[140px] h-[2px] origin-left"
                                    style={{
                                        transform: `rotate(${angle + 180}rad)`, // Point back to center
                                        width: radius
                                    }}>
                                    <motion.line
                                        x1="0" y1="0" x2="100%" y2="0"
                                        stroke="rgba(0, 207, 255, 0.2)"
                                        strokeWidth="2"
                                        strokeDasharray="4 4"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ delay: 1 + i * 0.2, duration: 0.5 }}
                                    />
                                </svg>

                                {/* Message Particles */}
                                <motion.div
                                    className="absolute top-0 right-0 bg-brand-cyan text-brand-navy p-1.5 rounded-full shadow-lg"
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{
                                        scale: [0, 1, 1, 0],
                                        opacity: [0, 1, 1, 0],
                                        x: [0, -x * 0.8], // Move towards center
                                        y: [0, -y * 0.8]
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        delay: 2 + i * 0.8,
                                        times: [0, 0.1, 0.9, 1]
                                    }}
                                >
                                    <MessageSquare className="w-3 h-3" />
                                </motion.div>
                            </div>
                        </motion.div>
                    );
                })}

                {/* Floating Elements */}
                <motion.div
                    className="absolute top-10 right-10 text-brand-cyan/20"
                    animate={{ y: [0, -20, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                    <Zap className="w-8 h-8" />
                </motion.div>
                <motion.div
                    className="absolute bottom-20 left-10 text-brand-cyan/20"
                    animate={{ y: [0, 20, 0] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                >
                    <div className="w-4 h-4 rounded-full bg-current" />
                </motion.div>
            </div>
        </div>
    );
};
