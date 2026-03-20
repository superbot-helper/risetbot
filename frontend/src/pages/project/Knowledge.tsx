import { useState, useCallback } from 'react';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import {
  useListKnowledge,
  useUploadKnowledge,
  useDeleteKnowledge,
  useConfirmExtraction,
  useListSchemas,
} from '@/services/api';
import { usePipelineStream } from '@/hooks/use-sse';
import { useDropzone } from 'react-dropzone';
import {
  FileUp,
  File as FileIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  PlayCircle,
  Eye,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

export default function Knowledge({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useListKnowledge(projectId);
  const { data: schemas } = useListSchemas(projectId);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const { mutate: upload, isPending: isUploading } = useUploadKnowledge();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { runPipeline, isRunning, logs } = usePipelineStream();

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  /**
   * Handle dropped files — stage them for batch upload.
   */
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setStagedFiles((prev) => [...prev, ...acceptedFiles]);
  }, []);

  /**
   * Remove a staged file before upload.
   */
  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Upload all staged files via FormData (multipart).
   */
  const handleUploadAll = () => {
    if (stagedFiles.length === 0) return;

    upload(
      {
        projectId,
        files: stagedFiles,
        schemaId: selectedSchema || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: `${stagedFiles.length} file(s) uploaded successfully`,
          });
          setStagedFiles([]);
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
        },
        onError: (err) => {
          toast({
            title: 'Upload failed',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12 flex flex-col h-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload PDF surveys and process them into structured data.
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <label className="text-sm font-medium">Processing Schema:</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">No Schema (Extract Raw Text)</option>
              {schemas?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200
              ${isDragActive ? 'border-primary bg-blue-50/50 scale-[1.01]' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'}`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <FileUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">
              Click or drag PDF files here
            </h3>
            <p className="text-sm text-gray-500">
              Supports batch upload — drop multiple files at once
            </p>
          </div>

          {/* Staged Files Preview */}
          <AnimatePresence>
            {stagedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    {stagedFiles.length} file(s) ready
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStagedFiles([])}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Clear All
                    </button>
                    <button
                      onClick={handleUploadAll}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white text-sm font-medium rounded-full shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      Upload All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {stagedFiles.map((file, i) => (
                    <motion.div
                      key={`${file.name}-${i}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                    >
                      <FileIcon className="w-4 h-4 text-red-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-gray-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => removeStagedFile(i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Active Pipeline Viewer */}
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
            <h3 className="font-semibold text-sm text-gray-700">
              Uploaded Surveys
            </h3>
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
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                      Loading files...
                    </td>
                  </tr>
                ) : files?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      No files uploaded yet.
                    </td>
                  </tr>
                ) : (
                  files?.map((file) => (
                    <tr
                      key={file.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium flex items-center gap-3">
                        <FileIcon className="w-4 h-4 text-primary" />
                        {file.fileName}
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {(file.fileSize / 1024).toFixed(1)} KB
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {format(new Date(file.createdAt), 'MMM d, HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {file.status === 'pending' && (
                            <button
                              onClick={() =>
                                runPipeline(
                                  projectId,
                                  file.id,
                                  selectedSchema || undefined,
                                )
                              }
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
                  ))
                )}
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
  const badges: Record<string, { className: string; icon?: React.ReactNode; label: string }> = {
    done: {
      className: 'bg-green-50 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: 'Done',
    },
    error: {
      className: 'bg-red-50 text-red-700 border-red-200',
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Error',
    },
    awaiting_confirmation: {
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertCircle className="w-3 h-3" />,
      label: 'Needs Review',
    },
    pending: {
      className: 'bg-gray-100 text-gray-600 border-gray-200',
      label: 'Pending',
    },
  };

  const badge = badges[status] || {
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.className}`}
    >
      {badge.icon}
      {badge.label}
    </span>
  );
}


function FileActions({
  projectId,
  file,
}: {
  projectId: string;
  file: any;
}) {
  const { mutate: del, isPending } = useDeleteKnowledge();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    del(
      { projectId, id: file.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
          toast({ title: 'File deleted' });
          setConfirmOpen(false);
        },
      },
    );
  };

  return (
    <>
      <button className="p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors">
        <Eye className="w-4 h-4" />
      </button>
      <button
        onClick={() => setConfirmOpen(true)}
        className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        isPending={isPending}
        title="Delete Survey File"
        description={
          <>
            Are you sure you want to delete <strong>{file.fileName}</strong>?
            <br />
            All extracted data will also be permanently removed.
          </>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}


function ReviewDataModal({
  projectId,
  fileId,
  onClose,
}: {
  projectId: string;
  fileId: string;
  onClose: () => void;
}) {
  const { mutate: confirm, isPending } = useConfirmExtraction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // TODO: fetch actual extracted data from API
  const mockData = {
    Responden: 'Ahmad Fauzi',
    Skor: 4,
    Komentar:
      'Pelayanan sangat baik dan cepat, namun ruang tunggu bisa diperluas.',
  };

  const handleAction = (action: 'confirm' | 'reject') => {
    confirm(
      { projectId, id: fileId, data: { action } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
          toast({ title: `Data ${action}ed successfully` });
          onClose();
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" /> Verify
            Extracted Data
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm font-mono text-sm">
            {Object.entries(mockData).map(([key, val]) => (
              <div
                key={key}
                className="grid grid-cols-3 gap-4 py-2 border-b border-gray-50 last:border-0"
              >
                <span className="font-semibold text-gray-500">{key}</span>
                <span className="col-span-2 text-gray-900">{String(val)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-4 text-center">
            Data extracted by AI Agent via OCR processing.
          </p>
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
      </motion.div>
    </div>
  );
}
