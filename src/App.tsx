import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "@/components/layout/Navigation";
import Index from "./pages/Index";
import DiretoriaForm from "./pages/DiretoriaForm";
import Members from "./pages/Members";
import FinancialEntries from "./pages/FinancialEntries";
import FinancialExpenses from "./pages/FinancialExpenses";
import FinancialDashboard from "./pages/FinancialDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/diretoria-form" element={<DiretoriaForm />} />
          <Route path="/members" element={<Members />} />
          <Route path="/entries" element={<FinancialEntries />} />
          <Route path="/expenses" element={<FinancialExpenses />} />
          <Route path="/dashboard" element={<FinancialDashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
