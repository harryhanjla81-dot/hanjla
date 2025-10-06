
import React from 'react';

const AboutPage: React.FC = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 p-8 max-w-2xl mx-auto">
                <h1 className="text-3xl font-bold text-center mb-6 text-primary">About & Contact</h1>
                <div className="space-y-4 text-center text-lg text-gray-700 dark:text-gray-300">
                    <p className="font-semibold text-2xl">Hanjla Harry</p>
                    <p>
                        For any inquiries, please contact us at:
                        <a href="mailto:Hanjla@proton.me" className="block text-primary hover:underline mt-2 text-xl">
                            Hanjla@proton.me
                        </a>
                    </p>
                    <p className="pt-4 text-gray-500">
                        Thank you for using our application!
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AboutPage;
