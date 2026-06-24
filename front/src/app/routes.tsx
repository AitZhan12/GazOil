import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import { Login } from "./components/Login";
import { ShiftJournal } from "./components/ShiftJournal";
import { ShiftForm } from "./components/ShiftForm";
import { MonthlyReport } from "./components/MonthlyReport";
import { Deliveries } from "./components/Deliveries";
import { Operators } from "./components/Operators";
import { Settings } from "./components/Settings";
import { NotFound } from "./components/NotFound";

export const router = createBrowserRouter([
  { path: "/login", Component: Login },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: ShiftJournal },
      { path: "dashboard", lazy: async () => ({ Component: (await import("./components/Dashboard")).Dashboard }) },
      { path: "shift/new", Component: ShiftForm },
      { path: "shift/:id", Component: ShiftForm },
      { path: "report", Component: MonthlyReport },
      { path: "deliveries", Component: Deliveries },
      { path: "operators", Component: Operators },
      { path: "settings", Component: Settings },
      { path: "*", Component: NotFound },
    ],
  },
]);
