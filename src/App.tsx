import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import Profile from "./pages/Profile";
import Servers from "./pages/Servers";
import ServerDetail from "./pages/ServerDetail";
import Posts from "./pages/Posts";
import Connections from "./pages/Connections";
import Messages from "./pages/Messages";
import Auth from "./pages/Auth";
import DiscordCallback from "./pages/DiscordCallback";
import VerifyExperience from "./pages/VerifyExperience";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";
import Docs from "./pages/Docs";
import { AcceptTermsGate } from "@/components/auth/AcceptTermsGate";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AcceptTermsGate>
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
              <Route path="/verify/:token" element={<VerifyExperience />} />
              <Route path="/staff" element={<Admin />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/:profileSlug" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AcceptTermsGate>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
