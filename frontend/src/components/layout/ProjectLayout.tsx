import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetProject } from '@/services/api';
import {
  ArrowLeft, FileText, Database,
  BarChart3, MessageSquare, LayoutTemplate,
  MoreVertical, Activity, PanelLeftClose, PanelLeftOpen, Sun, Moon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

interface ProjectLayoutProps {
  projectId: string;
  children: ReactNode;
}

export function ProjectLayout({ projectId, children }: ProjectLayoutProps) {
  const [location] = useLocation();
  const { data: project, isLoading } = useGetProject(projectId);
  const [collapsed, setCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { icon: FileText, label: "Knowledge", path: `/projects/${projectId}/knowledge` },
    { icon: Database, label: "Schema", path: `/projects/${projectId}/schemas` },
    { icon: BarChart3, label: "Analysis & Report", path: `/projects/${projectId}/reports` },
    { icon: MessageSquare, label: "Chat", path: `/projects/${projectId}/chat` },
    { icon: LayoutTemplate, label: "Template", path: `/projects/${projectId}/templates` },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
      {/* Project Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="bg-sidebar border-r border-sidebar-border flex-col hidden md:flex shrink-0 z-10 shadow-[2px_0_12px_rgba(0,0,0,0.02)] overflow-hidden"
      >
        {/* Back + Project Name */}
        <div className={`pt-4 pb-2 ${collapsed ? "px-2" : "px-4"}`}>
          <Link
            href="/projects"
            className={`inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group cursor-pointer px-2 ${collapsed ? "justify-center w-full" : ""}`}
            title={collapsed ? "Back to Projects" : undefined}
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  key="back-label"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  Back to Projects
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div
                key="project-title"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="px-2 mb-2 overflow-hidden"
              >
                {isLoading ? (
                  <div className="h-6 w-3/4 bg-black/5 rounded animate-pulse" />
                ) : (
                  <h2 className="font-semibold text-base leading-tight line-clamp-2" title={project?.name}>
                    {project?.name}
                  </h2>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className={`flex-1 space-y-1 ${collapsed ? "px-2" : "px-4"}`}>
          {navItems.map((item) => {
            const isActive = location === item.path || location.startsWith(item.path + "/");
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
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur-md sticky top-0 z-20 border-b border-border/50">
          <div className="flex items-center gap-2">
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
            {/* Mobile back button */}
            <div className="md:hidden flex items-center">
              <Link href="/projects" className="p-2 text-muted-foreground">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </div>
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground hidden sm:flex">
              <span>Projects</span>
              <span>/</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">{project?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-full border border-border shadow-sm text-sm font-medium text-primary">
              <Activity className="w-4 h-4" />
              Pipeline Ready
            </div>
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-all hover:shadow-md"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-all hover:shadow-md">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-20 md:pb-8 scroll-smooth">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-6xl mx-auto h-full flex flex-col"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border z-30 flex items-center justify-around px-1 py-2 safe-area-bottom">
        {navItems.map((item) => {
          const isActive = location === item.path || location.startsWith(item.path + "/");
          return (
            <Link key={item.path} href={item.path} className="block">
              <div className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}>
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
