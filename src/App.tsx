import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { CommunityProvider } from './features/community/context/CommunityContext';
import { Navbar } from './ui/Navbar';
import { Suspense, lazy } from 'react';

// Lazy load features
const Feed = lazy(() => import('./features/feed/pages/FeedPage'));
const Profile = lazy(() => import('./features/profiles/pages/ProfilePage'));
const Settings = lazy(() => import('./features/settings/pages/SettingsPage'));
const PostView = lazy(() => import('./features/feed/pages/PostViewPage'));
const CreatePost = lazy(() => import('./features/feed/pages/CreatePostPage'));
const Market = lazy(() => import('./features/wallet/pages/MarketPage'));
const Notifications = lazy(() => import('./features/notifications/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const Governance = lazy(() => import('./features/governance/pages/GovernancePage').then(m => ({ default: m.GovernancePage })));
const Messages = lazy(() => import('./features/messages/pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const Analytics = lazy(() => import('./features/analytics/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const Wallet = lazy(() => import('./features/wallet/pages/WalletPage'));
const ShortsFeed = lazy(() => import('./features/shorts/components/ShortsFeed').then(m => ({ default: m.ShortsFeed })));
import { DelegationBanner } from './features/auth/components/DelegationBanner';
import { BottomNav } from './ui/BottomNav';

const Layout = () => {
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans transition-colors duration-300">
      <Navbar />
      <DelegationBanner />

      <main className="w-full pt-20 pb-20 lg:pb-12 h-screen overflow-y-auto custom-scrollbar md:h-auto md:overflow-visible">
        <Suspense fallback={<div className="flex justify-center p-12 text-[var(--text-secondary)]">Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>


      <BottomNav />
    </div>
  );
};

import { NotificationProvider } from './contexts/NotificationContext';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { SocketProvider } from './contexts/SocketContext';
import { ChatProvider } from './contexts/ChatContext';
import { SetupPage } from './features/setup/SetupPage';

const AppContent = () => {
  const { isConfigured, loading } = useConfig();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<SetupPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<Feed />} />
        <Route path="posts" element={<Feed />} />
        <Route path="posts/:sort" element={<Feed />} />
        <Route path="posts/:sort/:tag" element={<Feed />} />
        <Route path="about" element={<Feed />} />
        <Route path="activities" element={<Feed />} />
        <Route path="subscribers" element={<Feed />} />

        {/* Dynamic Community Routes */}
        <Route path="c/:communityId" element={<Feed />} />
        <Route path="c/:communityId/posts" element={<Feed />} />
        <Route path="c/:communityId/posts/:sort" element={<Feed />} />
        <Route path="c/:communityId/about" element={<Feed />} />
        <Route path="c/:communityId/subscribers" element={<Feed />} />
        <Route path="c/:communityId/activities" element={<Feed />} />

        <Route path="analytics" element={<Analytics />} />
        <Route path="analytics/:username" element={<Analytics />} />
        <Route path="shorts" element={<ShortsFeed />} />
        <Route path="market" element={<Market />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="governance/:tab?" element={<Governance />} />
        <Route path="messages" element={<Messages />} />
        <Route path="submit" element={<CreatePost />} />
        <Route path="post/:author/:permlink" element={<PostView />} />

        <Route path=":username" element={<Profile />} />
        <Route path=":username/:section" element={<Profile />} />
        <Route path=":username/settings" element={<Settings />} />
        <Route path=":username/wallet" element={<Wallet />} />

        <Route path="*" element={<div>404 Not Found</div>} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <ConfigProvider>
        <NotificationProvider>
          <SocketProvider>
            <ChatProvider>
              <CommunityProvider>
                <AppContent />
              </CommunityProvider>
            </ChatProvider>
          </SocketProvider>
        </NotificationProvider>
      </ConfigProvider>
    </BrowserRouter>
  );
}

export default App;
