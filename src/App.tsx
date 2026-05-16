import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import DiscordCallback from "./pages/DiscordCallback";
import RobloxOAuthCallback from "./pages/RobloxOAuthCallback";
import VerifyExperience from "./pages/VerifyExperience";
import { AcceptTermsGate } from "@/components/auth/AcceptTermsGate";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { RouteTransition } from "@/components/layout/RouteTransition";
import { RouteFallback } from "@/components/layout/RouteFallback";
import { BetaBugReportLink } from "@/components/layout/BetaBugReportLink";
import { PostTutorialExperienceNudge } from "@/components/onboarding/PostTutorialExperienceNudge";
import { CanaryGate } from "@/components/canary/CanaryGate";
import { STAFF_PANEL_PATH } from "@/lib/staffPanelPath";

const Browse = lazy(() => import("./pages/Browse"));
const Profile = lazy(() => import("./pages/Profile"));
const Servers = lazy(() => import("./pages/Servers"));
const ServerDetail = lazy(() => import("./pages/ServerDetail"));
const Posts = lazy(() => import("./pages/Posts"));
const Connections = lazy(() => import("./pages/Connections"));
const Messages = lazy(() => import("./pages/Messages"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Contact = lazy(() => import("./pages/Contact"));
const Docs = lazy(() => import("./pages/Docs"));
const Pro = lazy(() => import("./pages/Pro"));

const FirstLoginTutorial = lazy(() =>
  import("@/components/onboarding/FirstLoginTutorial").then((m) => ({ default: m.FirstLoginTutorial })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CanaryGate>
            <ScrollToTop />
            <BetaBugReportLink />
            <PostTutorialExperienceNudge />
            <Suspense fallback={null}>
              <FirstLoginTutorial />
            </Suspense>
            <AcceptTermsGate>
              <RouteTransition>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/browse" element={<Browse />} />
                    <Route path="/profile/:profileSlug" element={<Profile />} />
                    <Route path="/servers" element={<Servers />} />
                    <Route path="/server/:id" element={<ServerDetail />} />
                    <Route path="/posts" element={<Posts />} />
                    <Route path="/connections" element={<Connections />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/discord/callback" element={<DiscordCallback />} />
                    <Route path="/roblox/callback" element={<RobloxOAuthCallback />} />
                    <Route path="/verify/:token" element={<VerifyExperience />} />
                    <Route path="/staff" element={<NotFound />} />
                    <Route path={STAFF_PANEL_PATH} element={<Admin />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/docs" element={<Docs />} />
                    <Route path="/pro" element={<Pro />} />
                    <Route path="/:profileSlug" element={<Profile />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </RouteTransition>
            </AcceptTermsGate>
          </CanaryGate>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
