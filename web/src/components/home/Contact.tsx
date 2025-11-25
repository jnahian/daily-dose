import { motion } from 'framer-motion';
import { Mail, MapPin } from 'lucide-react';
import { LordIcon } from '../LordIcon';
import { ContactForm } from './ContactForm';

export const Contact = () => {
    return (
        <section id="contact" className="py-24 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-brand-cyan/5 rounded-full blur-[100px] -z-10" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-purple/5 rounded-full blur-[100px] -z-10" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="w-20 h-20 bg-brand-navy-light rounded-3xl flex items-center justify-center border border-white/5 shadow-[0_0_30px_rgba(0,207,255,0.1)] mb-8">
                            <LordIcon
                                src="https://cdn.lordicon.com/aycieyht.json"
                                trigger="loop"
                                delay={4000}
                                colors="primary:#00cfff,secondary:#00afff"
                                size={48}
                            />
                        </div>

                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                            Get in touch
                        </h2>

                        <p className="text-gray-400 text-lg mb-12 leading-relaxed">
                            Have questions about Daily Dose? We're here to help. Fill out the form
                            and our team will get back to you shortly.
                        </p>

                        <div className="space-y-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-brand-navy-light rounded-xl flex items-center justify-center border border-white/5 shrink-0 text-brand-cyan">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold mb-1">Email Us</h3>
                                    <p className="text-gray-400">support@dailydose.bot</p>
                                    <p className="text-gray-400">sales@dailydose.bot</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-brand-navy-light rounded-xl flex items-center justify-center border border-white/5 shrink-0 text-brand-cyan">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold mb-1">Location</h3>
                                    <p className="text-gray-400">San Francisco, CA</p>
                                    <p className="text-gray-400">United States</p>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    <ContactForm />
                </div>
            </div>
        </section>
    );
};
