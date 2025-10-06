import React from 'react';
// Using named imports for react-router-dom components to resolve module export errors.
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import MainAppPage from './MainAppPage.tsx';
import CollageMakerPage from './CollageMakerPage.tsx';
import FrameMakerPage from './FrameMakerPage.tsx';
import UploaderPage from './UploaderPage.tsx';
import ManagePostsPage from './ManagePostsPage.tsx';
import CrossPostPage from './CrossPostPage.tsx'; // Import the new page
import MessagesPage from './MessagesPage.tsx'; // Import the new Messages page
import TwoFactorAuthPage from './TwoFactorAuthPage.tsx'; // Import the new 2FA page
import AudienceInsightsPage from './AudienceInsightsPage.tsx'; // New: Merged page
import ScriptMakerPage from './ScriptMakerPage.tsx'; // New: Script Maker
import AboutPage from './AboutPage.tsx'; // New: About Page
import PrivacyPolicyPage from './PrivacyPolicyPage.tsx'; // New: Privacy Policy Page
import CommunityChatPage from './components/CommunityChatPage.tsx'; // New: Community Chat Page
import PricingPage from './PricingPage.tsx'; // New: Pricing Page
import LoginPage from './LoginPage.tsx'; // New: Login Page
import SignupPage from './SignupPage.tsx'; // New: Signup Page
import FeedPage from './FeedPage.tsx'; // New: Feed Page
import { SidebarProvider, PageActionProvider } from './src/contexts/SidebarContext.tsx';
import { NotificationProvider } from './src/contexts/NotificationContext.tsx';
import { SettingsProvider } from './src/contexts/SettingsContext.tsx';
import { FacebookPageProvider } from './src/contexts/FacebookPageContext.tsx';
import { AuthProvider } from './src/contexts/AuthContext.tsx';
import { ThemeProvider } from './src/contexts/ThemeContext.tsx';

const AuthenticatedApp: React.FC = () => (
  <PageActionProvider>
    <Layout>
      <Routes>
        <Route index element={<Navigate to="/feed" replace />} />
        <Route path="feed" element={<FeedPage />} />
        <Route path="dashboard" element={<MainAppPage />} />
        <Route path="collage-maker" element={<CollageMakerPage />} />
        <Route path="frame-maker" element={<FrameMakerPage />} />
        <Route path="cross-post" element={<CrossPostPage />} />
        <Route path="uploader" element={<UploaderPage />} />
        <Route path="manage-posts" element={<ManagePostsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="audience-insights" element={<AudienceInsightsPage />} />
        <Route path="script-maker" element={<ScriptMakerPage />} />
        <Route path="2fa" element={<TwoFactorAuthPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="community-chat" element={<CommunityChatPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="*" element={<Navigate to="/feed" replace />} /> {/* Fallback for any other path */}
      </Routes>
    </Layout>
  </PageActionProvider>
);

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <ThemeProvider>
          <SidebarProvider>
            <SettingsProvider>
              <FacebookPageProvider>
                <HashRouter>
                  <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route
                      path="/*"
                      element={
                        <ProtectedRoute>
                          <AuthenticatedApp />
                        </ProtectedRoute>
                      }
                    />
                  </Routes>
                </HashRouter>
              </FacebookPageProvider>
            </SettingsProvider>
          </SidebarProvider>
        </ThemeProvider>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;