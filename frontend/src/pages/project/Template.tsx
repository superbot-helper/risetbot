import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { LayoutTemplate, Upload, FileSignature } from "lucide-react";

export default function Template({ projectId }: { projectId: string }) {
  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Report Templates</h1>
          <p className="text-muted-foreground mt-1 text-sm">Upload DOCX templates with Jinja2 tags for custom report generation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-2xl border border-border p-8 text-center flex flex-col items-center justify-center min-h-[300px] border-dashed">
             <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4">
                <Upload className="w-8 h-8" />
             </div>
             <h3 className="font-semibold text-lg mb-1">Upload DOCX Template</h3>
             <p className="text-muted-foreground text-sm max-w-sm mb-6">Drag and drop your word document containing tags like {"{{ total_respondents }}"}</p>
             <button className="px-6 py-2.5 bg-primary text-white font-medium rounded-full shadow-md hover:bg-blue-600 transition-colors">
               Browse Files
             </button>
          </div>

          <div className="space-y-4">
             <h3 className="font-semibold text-sm text-gray-700">Available Templates</h3>
             <div className="bg-white p-4 rounded-xl border border-primary/20 shadow-[0_4px_20px_rgba(0,122,255,0.08)] relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-bl-lg">Active</div>
                <div className="flex items-center gap-3 mb-2">
                   <FileSignature className="w-5 h-5 text-primary" />
                   <span className="font-medium text-sm">Standard Instansi v2.docx</span>
                </div>
                <p className="text-xs text-gray-500">System default template</p>
             </div>
             
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-3 mb-2 opacity-60">
                   <FileSignature className="w-5 h-5 text-gray-500" />
                   <span className="font-medium text-sm text-gray-700">Laporan Ringkas.docx</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
}
