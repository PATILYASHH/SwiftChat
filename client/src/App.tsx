import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./hooks/use-auth";
import { ChatProvider } from "./hooks/use-chat";
import { GroupsProvider } from "./hooks/use-groups";
import HomePage from "./pages/home-page";
import AuthPage from "./pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GroupsProvider>
          <ChatProvider>
            <Router />
            <Toaster />
          </ChatProvider>
        </GroupsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;