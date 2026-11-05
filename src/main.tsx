import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installToastLanguageGuard } from "./utils/toastLanguageGuard";

installToastLanguageGuard();

createRoot(document.getElementById("root")!).render(<App />);
