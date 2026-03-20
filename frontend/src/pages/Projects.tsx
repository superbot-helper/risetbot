import { useState } from "react";
import { useListProjects, useCreateProject, useDeleteProject } from '@/services/api';
import { AppLayout } from "@/components/layout/AppLayout";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Link } from "wouter";
import { format } from "date-fns";
import { FolderKanban, Plus, MoreVertical, Trash2, Search, ArrowRight, FileText, BarChart2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProjects = projects?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    (p.description && p.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage your survey analysis workspaces.</p>
          </div>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-medium shadow-md shadow-primary/20 hover:bg-blue-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            New Project
          </button>
        </div>

        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-border shadow-sm max-w-xl">
          <div className="pl-3 text-muted-foreground">
            <Search className="w-5 h-5" />
          </div>
          <input 
            type="text" 
            placeholder="Search projects..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none py-1.5 pr-4 text-sm"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-48 bg-white rounded-2xl border border-border animate-pulse shadow-sm"></div>)}
          </div>
        ) : filteredProjects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4">
              <FolderKanban className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-6 max-w-sm text-center">Create a new workspace to start processing and analyzing your survey PDFs.</p>
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="text-primary font-medium hover:underline"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects?.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <CreateProjectModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </AppLayout>
  );
}

function ProjectCard({ project }: { project: any }) {
  const queryClient = useQueryClient();
  const { mutate: deleteProject, isPending: isDeleting } = useDeleteProject();
  const { toast } = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    deleteProject({ id: project.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project deleted successfully" });
        setConfirmOpen(false);
      }
    });
  };

  return (
    <>
      <Link href={`/projects/${project.id}/knowledge`} className="block group">
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-primary/20 transition-all duration-300 relative h-full flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FolderKanban className="w-6 h-6" />
            </div>
            
            <div className="relative">
              <button 
                onClick={(e) => { e.preventDefault(); setShowMenu(!showMenu); }}
                className="p-1.5 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden py-1">
                  <button 
                    onClick={(e) => { e.preventDefault(); setShowMenu(false); setConfirmOpen(true); }}
                    disabled={isDeleting}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-foreground leading-tight mb-2 group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-6 flex-1">
            {project.description || "No description provided."}
          </p>

          <div className="mt-auto">
            <div className="flex items-center gap-4 text-sm font-medium text-foreground mb-4">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span>{project.knowledgeCount || 0} Files</span>
              </div>
              <div className="flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-muted-foreground" />
                <span>{project.reportCount || 0} Reports</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Updated {format(new Date(project.updatedAt), 'MMM d, yyyy')}
              </span>
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white text-muted-foreground transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </Link>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        isPending={isDeleting}
        title="Delete Project"
        description={<>Delete <strong>{project.name}</strong>? All files, schemas, and reports in this project will be permanently removed.</>}
        confirmText="Delete Project"
        variant="destructive"
      />
    </>
  );
}

function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: create, isPending } = useCreateProject();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create({ data: { name, description } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project created successfully" });
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold">New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:bg-gray-100 p-2 rounded-full transition-colors">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Project Name</label>
            <input 
              required
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Employee Satisfaction Q3"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this workspace..."
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all resize-none"
            />
          </div>
          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isPending || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-primary hover:bg-blue-600 shadow-lg shadow-primary/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
