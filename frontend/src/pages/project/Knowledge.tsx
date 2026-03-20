import { useState, useCallback } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { useListKnowledge, useUploadKnowledge, useDeleteKnowledge, useConfirmExtraction, useListSchemas } from '@/services/api';
import { usePipelineStream } from "@/hooks/use-sse";
import { useDropzone } from "react-dropzone";
import { FileUp, File as FileIcon, CheckCircle2, AlertCircle, Loader2, PlayCircle, Eye, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function Knowledge({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useListKnowledge(projectId);
  const { data: schemas } = useListSchemas(projectId);
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const { mutate: upload } = useUploadKnowledge();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { runPipeline, isRunning, logs } = usePipelineStream();

  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (base64) {
          upload({ 
            projectId, 
            data: { 
              fileName: file.name, 
              fileSize: file.size, 
              fileContent: base64,
              schemaId: selectedSchema || null
            } 
          }, {
            onSuccess: () => {
              toast({ title: `${file.name} uploaded` });
              queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/knowledge`] });
            }
          });
        }
      };
    });
  }, [projectId, selectedSchema, upload, queryClient, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'application/pdf': ['.pdf'] }
  });

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12 flex flex-col h-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Knowledge Base</h1>
          <p className="text-muted-foreground mt-1 text-sm">Upload PDF surveys and process them into structured data.</p>
        </div>

        {/* Upload Area */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Processing Schema:</label>
            <select 
              value={selectedSchema} 
              onChange={e => setSelectedSchema(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">No Schema (Extract Raw Text)</option>
              {schemas?.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-primary bg-blue-50/50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <FileUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Click or drag PDF files here</h3>
            <p className="text-sm text-gray-500">Supports single or batch upload</p>
          </div>
        </div>

        {/* Active Pipeline Viewer (if running) */}
        {isRunning && (
          <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-sm overflow-hidden h-48 flex flex-col shadow-lg shadow-black/10">
            <div className="flex items-center gap-2 mb-2 text-white/50 text-xs border-b border-white/10 pb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>AGENT PIPELINE RUNNING</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-blue-400 shrink-0">[{log.agent}]</span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
              <div className="animate-pulse">_</div>
            </div>
          </div>
        )}

        {/* File List */}
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden flex-1 flex flex-col min-h-[300px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="font-semibold text-sm text-gray-700">Uploaded Surveys</h3>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 text-muted-foreground">
                  <th className="px-6 py-3 font-medium">File Name</th>
                  <th className="px-6 py-3 font-medium">Size</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading files...</td></tr>
                ) : files?.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No files uploaded yet.</td></tr>
                ) : files?.map(file => (
                  <tr key={file.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <FileIcon className="w-4 h-4 text-primary" />
                      {file.fileName}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{(file.fileSize / 1024).toFixed(1)} KB</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={file.status} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{format(new Date(file.createdAt), 'MMM d, HH:mm')}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {file.status === 'pending' && (
                          <button 
                            onClick={() => runPipeline(projectId, file.id, selectedSchema || undefined)}
                            className="p-1.5 text-primary hover:bg-blue-50 rounded-lg transition-colors"
                            title="Start Processing"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        {file.status === 'awaiting_confirmation' && (
                          <button 
                            onClick={() => setActiveFileId(file.id)}
                            className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full hover:bg-amber-200 transition-colors"
                          >
                            Review Data
                          </button>
                        )}
                        <FileActions projectId={projectId} file={file} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeFileId && (
        <ReviewDataModal 
          projectId={projectId} 
          fileId={activeFileId} 
          onClose={() => setActiveFileId(null)} 
        />
      )}
    </ProjectLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch(status) {
    case 'done': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3"/> Done</span>;
    case 'error': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200"><AlertCircle className="w-3 h-3"/> Error</span>;
    case 'awaiting_confirmation': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><AlertCircle className="w-3 h-3"/> Needs Review</span>;
    case 'pending': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">Pending</span>;
    default: return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"><Loader2 className="w-3 h-3 animate-spin"/> {status}</span>;
  }
}

function FileActions({ projectId, file }: { projectId: string, file: any }) {
  const { mutate: del } = useDeleteKnowledge();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    if(confirm("Delete this file?")) {
      del({ projectId, id: file.id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/knowledge`] });
          toast({ title: "File deleted" });
        }
      });
    }
  };

  return (
    <>
      <button className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
        <Eye className="w-4 h-4" />
      </button>
      <button onClick={handleDelete} className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );
}

function ReviewDataModal({ projectId, fileId, onClose }: { projectId: string, fileId: string, onClose: () => void }) {
  const { mutate: confirm, isPending } = useConfirmExtraction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Mocking extracted data display for UI purposes
  const mockData = {
    "Responden": "Ahmad Fauzi",
    "Skor": 4,
    "Komentar": "Pelayanan sangat baik dan cepat, namun ruang tunggu bisa diperluas."
  };

  const handleAction = (action: 'confirm' | 'reject') => {
    confirm({ projectId, id: fileId, data: { action } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/knowledge`] });
        toast({ title: `Data ${action}ed successfully` });
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Verify Extracted Data
          </h2>
        </div>
        <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm font-mono text-sm">
            {Object.entries(mockData).map(([key, val]) => (
              <div key={key} className="grid grid-cols-3 gap-4 py-2 border-b border-gray-50 last:border-0">
                <span className="font-semibold text-gray-500">{key}</span>
                <span className="col-span-2 text-gray-900">{String(val)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">Data extracted by AI Agent via OCR processing.</p>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-3 bg-white">
          <button 
            onClick={() => handleAction('reject')}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
          >
            Reject & Reprocess
          </button>
          <button 
            onClick={() => handleAction('confirm')}
            disabled={isPending}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 shadow-md shadow-green-500/20 transition-all"
          >
            Confirm & Save Data
          </button>
        </div>
      </div>
    </div>
  );
}
