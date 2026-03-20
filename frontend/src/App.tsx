import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Knowledge from "@/pages/project/Knowledge";
import Schemas from "@/pages/project/Schemas";
import Reports from "@/pages/project/Reports";
import Chat from "@/pages/project/Chat";
import Template from "@/pages/project/Template";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={Projects} />
      
      {/* Project Sub-routes */}
      <Route path="/projects/:id/knowledge">
        {params => <Knowledge projectId={params.id} />}
      </Route>
      <Route path="/projects/:id/schemas">
        {params => <Schemas projectId={params.id} />}
      </Route>
      <Route path="/projects/:id/reports">
        {params => <Reports projectId={params.id} />}
      </Route>
      <Route path="/projects/:id/chat">
        {params => <Chat projectId={params.id} />}
      </Route>
      <Route path="/projects/:id/templates">
        {params => <Template projectId={params.id} />}
      </Route>
      
      {/* Redirect /projects/:id to its knowledge base */}
      <Route path="/projects/:id">
        {params => {
          window.location.href = `/projects/${params.id}/knowledge`;
          return null;
        }}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
