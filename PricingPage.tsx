import React from 'react';
import { CheckCircleIcon, CurrencyDollarIcon } from './components/IconComponents.tsx';

const agencyPlan = {
    name: 'Agency Plan',
    description: 'The ultimate toolkit for marketing agencies and teams managing multiple pages at scale.',
    features: [
        'Unlimited AI Content Generation',
        'Unlimited AI Image & Viral Post Generation',
        'Connect Unlimited Facebook Pages',
        'Unlimited Post Scheduling',
        'Full Access to All Tools (Collage, Scraper, etc.)',
        'Community Chat Access',
        'Priority Support & Onboarding',
    ],
};

const WHATSAPP_NUMBER = '919817021973';
const WHATSAPP_MESSAGE = "Hi, I'm interested in the Agency Plan for the content creation app. Could you please provide more details on pricing and activation?";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

const PricingPage: React.FC = () => {
    const handleContactClick = () => {
        window.open(WHATSAPP_URL, '_blank', 'noopener,noreferrer');
    };

    return (
        // Centering container to match the auth page layout
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] p-4">
            {/* Recreating the AuthLayout structure for a consistent look */}
            <div className="relative w-full max-w-lg">
                {/* Neon Glow Outline */}
                <div className="absolute -inset-1 bg-gradient-to-br from-green-500 via-teal-500 to-cyan-500 rounded-2xl blur-lg opacity-60 animate-pulse" style={{ animationDuration: '5s' }}></div>

                {/* Glassmorphic Card */}
                <div className="relative p-8 space-y-6 bg-black/70 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl text-white">
                    <div className="text-center">
                        <CurrencyDollarIcon className="mx-auto h-12 w-12 text-green-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                        <h1 className="text-3xl font-bold mt-4" style={{ textShadow: '0 0 5px rgba(255,255,255,0.3)' }}>
                            {agencyPlan.name}
                        </h1>
                    </div>
                    
                    <p className="text-center text-gray-300">{agencyPlan.description}</p>
                    
                    <div className="text-center my-4">
                         <p className="text-2xl font-semibold text-gray-100">Contact for Pricing</p>
                    </div>

                    <ul className="space-y-3 text-left">
                        {agencyPlan.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                                <CheckCircleIcon className="w-6 h-6 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                                <span className="text-gray-200">{feature}</span>
                            </li>
                        ))}
                    </ul>

                    <button 
                        onClick={handleContactClick}
                        className="w-full mt-4 px-4 py-3 font-semibold text-white bg-gradient-to-r from-green-500 to-teal-500 rounded-lg shadow-lg hover:scale-105 hover:shadow-teal-500/50 transform transition-all duration-300"
                    >
                        Contact Admins on WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;
