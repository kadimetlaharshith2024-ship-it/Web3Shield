import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProvider } from "./context/App";
import { AuthProvider, useAuth } from "./context/Auth";
import { ToastProvider } from "./components/ui";
import { Shell } from "./components/Shell";
import { AuthPage } from "./pages/Auth";
import { HistoryPage } from "./pages/History";
import { AccessPage, ContractPage, ScanPage, TxPage, WalletPage } from "./pages/Tools";

function Protected({ children }: { children: JSX.Element }) {
  const { session } = useAuth();
  return session ? children : <Navigate to="/welcome" replace />;
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/welcome" element={<AuthPage />} />
              <Route
                element={
                  <Protected>
                    <Shell />
                  </Protected>
                }
              >
                <Route index element={<ScanPage />} />
                <Route path="transaction" element={<TxPage />} />
                <Route path="wallet" element={<WalletPage />} />
                <Route path="access" element={<AccessPage />} />
                <Route path="contract" element={<ContractPage />} />
                <Route path="history" element={<HistoryPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </AppProvider>
  );
}
