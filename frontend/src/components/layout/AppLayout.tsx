import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, Settings, Bell, Search, PanelLeftClose, PanelLeftOpen, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/" },
    { icon: FolderKanban, label: "Projects", path: "/projects" },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="bg-sidebar border-r border-sidebar-border flex-col hidden md:flex shrink-0 z-10 shadow-[2px_0_12px_rgba(0,0,0,0.02)] overflow-hidden"
      >
        {/* Logo */}
        <div className={`h-16 flex items-center shrink-0 ${collapsed ? "justify-center px-0" : "px-6 gap-3"}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
            R
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                key="logo-label"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="font-semibold text-lg tracking-tight whitespace-nowrap overflow-hidden"
              >
                RisetBot
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className={`flex-1 py-2 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path} className="block" title={collapsed ? item.label : undefined}>
                <div className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer
                  ${collapsed ? "justify-center" : ""}
                  ${isActive
                    ? "bg-card text-primary shadow-[0_2px_10px_rgba(0,0,0,0.06)] font-medium"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"}
                `}>
                  <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-primary" : ""}`} strokeWidth={isActive ? 2.5 : 2} />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        key={`label-${item.path}`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.18 }}
                        className="whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className={`border-t border-sidebar-border ${collapsed ? "px-2 py-3" : "p-4"} space-y-1`}>
          <div
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-muted-foreground hover:bg-black/5 cursor-pointer transition-colors ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? "Settings" : undefined}
          >
            <Settings className="w-5 h-5 shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="settings-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        {/* Top Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <div className="flex items-center gap-3 flex-1">
            {/* Sidebar toggle — always in header, never clipped */}
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center text-muted-foreground hover:bg-black/5 hover:text-foreground transition-all"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed
                ? <PanelLeftOpen className="w-5 h-5" />
                : <PanelLeftClose className="w-5 h-5" />}
            </button>
            <div className="relative max-w-md w-full hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search anything..."
                className="w-full bg-card/60 border border-border rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-card transition-all shadow-sm text-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-all hover:shadow-md"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-all hover:shadow-md">
              <Bell className="w-5 h-5" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 border border-border shadow-sm"></div>
          </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="max-w-6xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
