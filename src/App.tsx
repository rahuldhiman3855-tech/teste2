import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import SavedResponses from "./pages/SavedResponses";
import SharedResponse from "./pages/SharedResponse";
import Auth from "./pages/Auth";
import AcceptInvite from "./pages/AcceptInvite";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Analytics from "./pages/admin/Analytics";
import SourcesPage from "./pages/admin/SourcesPage";
import UsersPage from "./pages/admin/UsersPage";
import Configuration from "./pages/admin/Configuration";
import Debug from "./pages/admin/Debug";
import NotFound from "./pages/NotFound";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/saved" element={<SavedResponses />} />
              <Route path="/shared/:token" element={<SharedResponse />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="sources" element={<SourcesPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="config" element={<Configuration />} />
                <Route path="debug" element={<Debug />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
