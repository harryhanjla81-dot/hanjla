import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
    const sectionClasses = "mt-6 pt-4 border-t border-gray-200 dark:border-gray-700";
    const h2Classes = "text-2xl font-semibold mb-3 text-gray-800 dark:text-gray-200";
    const pClasses = "mb-4 leading-relaxed";
    const ulClasses = "list-disc list-inside space-y-2 mb-4 pl-4";

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 p-8 max-w-4xl mx-auto text-gray-700 dark:text-gray-300">
                <h1 className="text-4xl font-bold text-center mb-8 text-primary">Privacy Policy</h1>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 p-4 rounded-lg my-6" role="alert">
                    <h3 className="font-bold text-lg mb-2">🎉 Announcing Our New Community Chat!</h3>
                    <p className="mb-3">
                        We're excited to launch a brand new feature: a real-time **Community Chat**! Now you can connect with other users directly within the application.
                    </p>
                    <p className="font-semibold mb-2">What are the benefits for you?</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        <li><strong>Connect & Collaborate:</strong> Share your creative ideas, strategies, and content with fellow creators.</li>
                        <li><strong>Get Instant Feedback:</strong> Ask questions and get quick opinions from the community to improve your work.</li>
                        <li><strong>Stay Inspired:</strong> Learn new techniques and stay updated with what's trending by joining the conversation.</li>
                    </ul>
                    <p className="mt-3 text-sm">
                        To join, you'll use the unique username you set up after activating the app, which is stored locally on your device for your privacy. We can't wait to see you there!
                    </p>
                </div>

                <p><strong>Last Updated: 8/31/2025</strong></p>
                
                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Introduction</h2>
                    <p className={pClasses}>Welcome to Hanjla Harry's application. We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application. Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the application.</p>
                </div>

                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Information We Collect</h2>
                    <p className={pClasses}>We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
                    <ul className={ulClasses}>
                        <li><strong>Personal Data:</strong> We do not collect any personal data such as your name, shipping address, email address, or telephone number. All data, such as Facebook Access Tokens and API keys, are stored locally in your browser's local storage and are never transmitted to our servers.</li>
                        <li><strong>Derivative Data:</strong> Information our servers do not automatically collect. All operations are performed on the client-side.</li>
                    </ul>
                </div>

                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Use of Your Information</h2>
                    <p className={pClasses}>Our application is a client-side tool. We do not have a backend server that stores your information. All data processing occurs within your browser. Information you provide (like API Keys and Access Tokens) is used solely for the purpose of interacting with third-party APIs (like Facebook and Google Gemini) as directed by you through the application's user interface.</p>
                </div>

                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Security of Your Information</h2>
                    <p className={pClasses}>We use administrative, technical, and physical security measures to help protect your information stored locally in your browser. While we have taken reasonable steps to secure the information you provide to us, please be aware that despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be guaranteed against any interception or other type of misuse.</p>
                </div>

                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Third-Party APIs</h2>
                    <p className={pClasses}>The application interacts with third-party APIs, such as Facebook Graph API and Google Gemini API. Your use of these APIs is subject to their respective privacy policies. We are not responsible for the data handling practices of these third parties.</p>
                </div>

                <div className={sectionClasses}>
                    <h2 className={h2Classes}>Contact Us</h2>
                    <p className={pClasses}>If you have questions or comments about this Privacy Policy, please contact us at:</p>
                    <p className="font-semibold">Hanjla Harry</p>
                    <p><a href="mailto:Hanjla@proton.me" className="text-primary hover:underline">Hanjla@proton.me</a></p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPolicyPage;