import _ from "lodash";
import { SidebarNav } from "./sidebar-nav";
import { Outlet, Navigate, useLocation } from "react-router-dom";

const sidebarNavItems = [
  {
    title: "Configuration",
    href: "/settings/configuration",
  },
  {
    title: "General",
    href: "/settings/general",
  },
  {
    title: "Data",
    href: "/settings/data",
  },
  {
    title: "System",
    href: "/settings/systemInfo",
  },
];

const App = () => {
  const lo = useLocation();

  return (
    <div className="space-y-6 p-5 pb-8 md:block">
      <div className="flex flex-col space-y-4 lg:flex-row lg:space-x-6 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <SidebarNav items={sidebarNavItems} />
        </aside>
        {/* <div>{version}</div> */}
        <div className="flex-1 lg:max-w-2xl">
          <Outlet></Outlet>
          {lo.pathname === "/settings" && (
            <Navigate to="/settings/configuration" />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
