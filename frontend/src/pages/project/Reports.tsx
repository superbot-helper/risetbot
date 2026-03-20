import { useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { useListReports, useGenerateReport, useDeleteReport } from '@/services/api';
import { BarChart3, Plus, Download, FileText, Loader2, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Reports({ projectId }: { projectId: string }) {
  const { data: reports, isLoading } = useListReports(projectId);
  const [isGenerating, setIsGenerating] = useState(false);
  const { mutate: generate } = useGenerateReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGenerate = () => {
    setIsGenerating(true);
    generate({ 
      projectId, 
      data: { name: `Executive Summary ${format(new Date(), 'MMM d')}`, includeStatistics: true } 
    }, {
      onSuccess: () => {
        toast({ title: "Report generation started. The Analyst Agent is working." });
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/reports`] });
        setIsGenerating(false);
      },
      onError: () => setIsGenerating(false)
    });
  };

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Analysis & Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm">Generate comprehensive Word/PDF reports from processed data.</p>
          </div>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-medium shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors text-sm disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Generate Report
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex-1">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-sm text-gray-700">Generated Reports</h3>
          </div>
          
          <table className="w-full text-left text-sm whitespace-nowrap">
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td className="p-8 text-center text-gray-400">Loading...</td></tr>
              ) : reports?.length === 0 ? (
                <tr>
                  <td className="p-12 text-center">
                    <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <p className="text-gray-500 font-medium">No reports generated yet</p>
                  </td>
                </tr>
              ) : reports?.map(report => (
                <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4 font-medium flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-gray-900">{report.name}</div>
                      <div className="text-xs text-gray-400 font-normal mt-0.5">{format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {report.status === 'done' ? (
                       <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">Ready</span>
                    ) : (
                       <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 flex items-center w-max gap-1">
                         <Loader2 className="w-3 h-3 animate-spin"/> {report.status}
                       </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-2 bg-white border border-gray-200 text-gray-600 hover:text-primary hover:border-primary rounded-lg shadow-sm">
                         <Download className="w-4 h-4" />
                       </button>
                       <DeleteReportButton projectId={projectId} id={report.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProjectLayout>
  );
}

function DeleteReportButton({ projectId, id }: { projectId: string, id: string }) {
  const { mutate: del } = useDeleteReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <button 
      onClick={() => {
        if(confirm("Delete this report?")) {
           del({ projectId, id }, {
             onSuccess: () => {
               queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/reports`]});
               toast({ title: "Report deleted" });
             }
           })
        }
      }}
      className="p-2 bg-white border border-gray-200 text-gray-400 hover:text-red-600 hover:border-red-200 rounded-lg shadow-sm"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
