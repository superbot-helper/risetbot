import { useCallback, useEffect, useMemo, useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import {
  useListKnowledge,
  useDeleteKnowledge,
  useConfirmExtraction,
  useListSchemas,
  useGetKnowledge,
  uploadKnowledgeFilesWithProgress,
} from "@/services/api";
import { usePipelineStream } from "@/hooks/use-sse";
import { useDropzone, type FileRejection } from "react-dropzone";
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
  Sparkles,
  FileWarning,
  PencilLine,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  clampProgress,
  formatBytes,
  getKnowledgeStatusProgress,
  safeJsonParse,
  sanitizeFilename,
} from "@/lib/utils";

type StagedUpload = {
  id: string;
  file: File;
  progress: number;
  status: "ready" | "uploading" | "uploaded" | "error";
  error?: string;
};

type PipelineLog = {
  agent: string;
  message: string;
  progress: number;
  type: string;
};

export default function Knowledge({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useListKnowledge(projectId);
  const { data: schemas } = useListSchemas(projectId);
  const [selectedSchema, setSelectedSchema] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    runPipeline,
    isRunning,
    logs,
    error: pipelineError,
    clearError: clearPipelineError,
  } = usePipelineStream();

  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<StagedUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!pipelineError) return;
    toast({
      title: "Pipeline processing failed",
      description: pipelineError,
      variant: "destructive",
    });
    clearPipelineError();
  }, [pipelineError, clearPipelineError, toast]);

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const pipelineProgress = latestLog?.progress ?? 0;

  const currentPipelineStep = useMemo(() => {
    if (!latestLog) return null;

    if (latestLog.agent === "Extractor") {
      return {
        label: "OCR & Extraction",
        hint: "AI sedang mengekstrak isi PDF...",
      };
    }

    if (latestLog.agent === "Compiler") {
      return {
        label: "Standardizing Data",
        hint: "Merapikan hasil ekstraksi ke format tabular...",
      };
    }

    if (latestLog.agent === "Supervisor") {
      return {
        label: "Finalizing",
        hint: latestLog.message,
      };
    }

    return {
      label: latestLog.agent,
      hint: latestLog.message,
    };
  }, [latestLog]);

  const updateStagedFile = useCallback(
    (stagedId: string, updater: (current: StagedUpload) => StagedUpload) => {
      setStagedFiles((prev) =>
        prev.map((item) => (item.id === stagedId ? updater(item) : item)),
      );
    },
    [],
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const nextFiles = acceptedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file: new File([file], sanitizeFilename(file.name), {
        type: file.type,
        lastModified: file.lastModified,
      }),
      progress: 0,
      status: "ready" as const,
    }));

    setStagedFiles((prev) => [...prev, ...nextFiles]);
  }, []);

  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      for (const rejection of rejections) {
        const firstError = rejection.errors[0];
        toast({
          title: `File ditolak: ${rejection.file.name}`,
          description:
            firstError?.message ||
            "Hanya file PDF hingga 50 MB yang diperbolehkan.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCompletedUploads = () => {
    setStagedFiles((prev) =>
      prev.filter(
        (item) => item.status === "uploading" || item.status === "ready",
      ),
    );
  };

  const handleUploadAll = async () => {
    const readyFiles = stagedFiles.filter((item) => item.status !== "uploaded");
    if (readyFiles.length === 0 || isUploading) return;

    setIsUploading(true);

    try {
      await uploadKnowledgeFilesWithProgress({
        projectId,
        files: readyFiles.map((item) => item.file),
        schemaId: selectedSchema || undefined,
        onFileProgress: (file, progress) => {
          const match = readyFiles.find((item) => item.file === file);
          if (!match) return;

          updateStagedFile(match.id, (current) => ({
            ...current,
            progress: clampProgress(progress),
            status: "uploading",
            error: undefined,
          }));
        },
      });

      setStagedFiles((prev) =>
        prev.map((item) =>
          readyFiles.some((ready) => ready.id === item.id)
            ? {
                ...item,
                progress: 100,
                status: "uploaded",
                error: undefined,
              }
            : item,
        ),
      );

      toast({
        title: `${readyFiles.length} file berhasil diupload`,
        description: "Setiap file siap diproses melalui pipeline AI.",
      });

      queryClient.invalidateQueries({
        queryKey: [`/api/projects/${projectId}/knowledge`],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Upload knowledge gagal";

      setStagedFiles((prev) =>
        prev.map((item) =>
          readyFiles.some((ready) => ready.id === item.id) &&
          item.status !== "uploaded"
            ? {
                ...item,
                status: "error",
                error: message,
              }
            : item,
        ),
      );

      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
    disabled: isUploading,
  });

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12 flex flex-col h-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload PDF surveys, pantau progres ekstraksi, lalu review hasil AI
            sebelum dikonfirmasi.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <label className="text-sm font-medium">Processing Schema:</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            >
              <option value="">No Schema (Extract Raw Text)</option>
              {schemas?.map((schema) => (
                <option key={schema.id} value={schema.id}>
                  {schema.name}
                  {schema.isDefault ? " (Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? "border-primary bg-blue-50/50 scale-[1.01]"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
            } ${isUploading ? "pointer-events-none opacity-70" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="w-14 h-14 bg-white rounded-full shadow-sm flex items-center justify-center mx-auto mb-4 border border-gray-100">
              <FileUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">
              Click or drag PDF files here
            </h3>
            <p className="text-sm text-gray-500">
              Batch upload didukung. Hanya PDF hingga 50 MB per file.
            </p>
          </div>

          <AnimatePresence>
            {stagedFiles.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">
                      {stagedFiles.length} file siap / sedang diupload
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Progress ditampilkan per file sesuai Phase 7.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={clearCompletedUploads}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Clear Completed
                    </button>
                    <button
                      onClick={() => setStagedFiles([])}
                      disabled={isUploading}
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stagedFiles.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <FileIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate text-gray-900">
                                {item.file.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {formatBytes(item.file.size)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeStagedFile(item.id)}
                              disabled={item.status === "uploading"}
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span
                                className={`font-medium ${
                                  item.status === "uploaded"
                                    ? "text-green-600"
                                    : item.status === "error"
                                      ? "text-red-600"
                                      : item.status === "uploading"
                                        ? "text-primary"
                                        : "text-gray-500"
                                }`}
                              >
                                {item.status === "uploaded"
                                  ? "Uploaded"
                                  : item.status === "error"
                                    ? "Error"
                                    : item.status === "uploading"
                                      ? "Uploading..."
                                      : "Ready"}
                              </span>
                              <span className="text-gray-400">
                                {item.progress}%
                              </span>
                            </div>

                            <Progress value={item.progress} className="h-2" />

                            {item.error && (
                              <p className="text-[11px] text-red-500">
                                {item.error}
                              </p>
                            )}

                            {item.status === "uploaded" && (
                              <p className="text-[11px] text-green-600 inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                File tersimpan dan siap diproses
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isRunning && (
          <div className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">
                  AI sedang memproses PDF
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  {currentPipelineStep?.hint ||
                    "Menjalankan OCR, ekstraksi, dan standardisasi data..."}
                </p>
              </div>
              <Spinner className="w-5 h-5 text-primary" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {currentPipelineStep?.label || "Processing"}
                </span>
                <span className="text-gray-400">{pipelineProgress}%</span>
              </div>
              <Progress value={pipelineProgress} className="h-2.5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <PipelineStepCard
                title="Step 1"
                label="OCR / Extraction"
                active={pipelineProgress > 0 && pipelineProgress < 70}
                done={pipelineProgress >= 65}
              />
              <PipelineStepCard
                title="Step 2"
                label="Compilation"
                active={pipelineProgress >= 70 && pipelineProgress < 95}
                done={pipelineProgress >= 92}
              />
              <PipelineStepCard
                title="Step 3"
                label="Ready for Review"
                active={pipelineProgress >= 95 && pipelineProgress < 100}
                done={pipelineProgress >= 100}
              />
            </div>

            <div className="bg-gray-950 text-green-400 p-4 rounded-xl font-mono text-sm overflow-hidden h-48 flex flex-col shadow-lg shadow-black/10">
              <div className="flex items-center gap-2 mb-2 text-white/50 text-xs border-b border-white/10 pb-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AGENT PIPELINE RUNNING</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1">
                {logs.map((log: PipelineLog, index) => (
                  <div key={`${log.agent}-${index}`} className="flex gap-3">
                    <span className="text-blue-400 shrink-0">
                      [{log.agent}]
                    </span>
                    <span className="text-gray-300">{log.message}</span>
                  </div>
                ))}
                <div className="animate-pulse">_</div>
              </div>
            </div>
          </div>
        )}

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
                  <th className="px-6 py-3 font-medium">Progress</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-gray-400"
                    >
                      Loading files...
                    </td>
                  </tr>
                ) : files?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No files uploaded yet.
                    </td>
                  </tr>
                ) : (
                  files?.map((file) => {
                    const statusProgress = getKnowledgeStatusProgress(
                      file.status,
                    );

                    return (
                      <tr
                        key={file.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium">
                          <div className="flex items-center gap-3 min-w-[240px]">
                            <FileIcon className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <div className="truncate">{file.fileName}</div>
                              {file.status === "awaiting_confirmation" && (
                                <div className="text-[11px] text-amber-600 mt-0.5">
                                  Checkpoint 1: butuh verifikasi user
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 text-gray-500">
                          {formatBytes(file.fileSize)}
                        </td>

                        <td className="px-6 py-4 min-w-[220px]">
                          <div className="space-y-1.5">
                            <Progress value={statusProgress} className="h-2" />
                            <div className="text-[11px] text-gray-400">
                              {file.status === "extracting"
                                ? "Extracting..."
                                : file.status === "compiling"
                                  ? "Compiling..."
                                  : file.status === "awaiting_confirmation"
                                    ? "Review ready"
                                    : file.status === "done"
                                      ? "Complete"
                                      : file.status === "error"
                                        ? "Failed"
                                        : "Waiting to start"}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={file.status} />
                        </td>

                        <td className="px-6 py-4 text-gray-500">
                          {format(new Date(file.createdAt), "MMM d, HH:mm")}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {file.status === "pending" && (
                              <button
                                onClick={() =>
                                  runPipeline(
                                    projectId,
                                    file.id,
                                    selectedSchema ||
                                      file.schemaId ||
                                      undefined,
                                  )
                                }
                                className="p-1.5 text-primary hover:bg-blue-50 rounded-lg transition-colors"
                                title="Start Processing"
                              >
                                <PlayCircle className="w-4 h-4" />
                              </button>
                            )}

                            {(file.status === "awaiting_confirmation" ||
                              file.status === "done") && (
                              <button
                                onClick={() => setActiveFileId(file.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                                  file.status === "awaiting_confirmation"
                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {file.status === "awaiting_confirmation"
                                  ? "Review Data"
                                  : "View Data"}
                              </button>
                            )}

                            <FileActions projectId={projectId} file={file} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
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

function PipelineStepCard({
  title,
  label,
  active,
  done,
}: {
  title: string;
  label: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-all ${
        done
          ? "border-green-200 bg-green-50"
          : active
            ? "border-primary/30 bg-primary/5"
            : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">
        {title}
      </div>
      <div
        className={`text-sm font-medium mt-1 ${
          done ? "text-green-700" : active ? "text-primary" : "text-gray-500"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const badges: Record<
    string,
    { className: string; icon?: React.ReactNode; label: string }
  > = {
    done: {
      className: "bg-green-50 text-green-700 border-green-200",
      icon: <CheckCircle2 className="w-3 h-3" />,
      label: "Done",
    },
    error: {
      className: "bg-red-50 text-red-700 border-red-200",
      icon: <AlertCircle className="w-3 h-3" />,
      label: "Error",
    },
    awaiting_confirmation: {
      className: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <FileWarning className="w-3 h-3" />,
      label: "Needs Review",
    },
    pending: {
      className: "bg-gray-100 text-gray-600 border-gray-200",
      label: "Pending",
    },
    extracting: {
      className: "bg-blue-50 text-blue-700 border-blue-200",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Extracting",
    },
    compiling: {
      className: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Compiling",
    },
  };

  const badge = badges[status] || {
    className: "bg-blue-50 text-blue-700 border-blue-200",
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

function FileActions({ projectId, file }: { projectId: string; file: any }) {
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
          toast({ title: "File deleted" });
          setConfirmOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Delete failed",
            description:
              error instanceof Error ? error.message : "Gagal menghapus file",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
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
  const { data: fileData, isLoading } = useGetKnowledge(projectId, fileId);
  const { mutate: confirm, isPending } = useConfirmExtraction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const extractedRows = useMemo(
    () =>
      Array.isArray(fileData?.extractedData?.rows)
        ? fileData.extractedData.rows
        : [],
    [fileData],
  );

  const [editorValue, setEditorValue] = useState("[]");

  useEffect(() => {
    setEditorValue(JSON.stringify(extractedRows, null, 2));
  }, [extractedRows]);

  const rawText =
    typeof fileData?.extractedData?.rawText === "string"
      ? fileData.extractedData.rawText
      : "";
  const confidence =
    typeof fileData?.extractedData?.confidence === "number"
      ? fileData.extractedData.confidence
      : null;

  const handleConfirm = () => {
    confirm(
      {
        projectId,
        id: fileId,
        data: { action: "confirm" },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`, fileId],
          });
          toast({
            title: "Extraction confirmed",
            description: "Data hasil ekstraksi telah disimpan.",
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Confirm failed",
            description:
              error instanceof Error
                ? error.message
                : "Gagal mengonfirmasi data",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleReject = () => {
    confirm(
      {
        projectId,
        id: fileId,
        data: { action: "reject" },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`, fileId],
          });
          toast({
            title: "Extraction rejected",
            description: "File ditandai error dan perlu diproses ulang.",
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Reject failed",
            description:
              error instanceof Error ? error.message : "Gagal menolak data",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSaveEdits = () => {
    const rows = safeJsonParse<Record<string, unknown>[]>(editorValue, []);
    if (!Array.isArray(rows)) {
      toast({
        title: "Format JSON tidak valid",
        description: "Pastikan editor berisi array JSON yang valid.",
        variant: "destructive",
      });
      return;
    }

    confirm(
      {
        projectId,
        id: fileId,
        data: {
          action: "edit",
          editedData: {
            rows,
            rawText,
            confidence,
          },
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`],
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/knowledge`, fileId],
          });
          toast({
            title: "Edited extraction saved",
            description: "Perubahan Anda telah dikonfirmasi dan disimpan.",
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Save edit failed",
            description:
              error instanceof Error ? error.message : "Gagal menyimpan edit",
            variant: "destructive",
          });
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
        className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <PencilLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Verify Extracted Data</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Checkpoint 1 — review, edit, lalu konfirmasi hasil AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-3 text-gray-500">
            <Spinner className="w-5 h-5 text-primary" />
            Loading extracted data...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-0 flex-1 min-h-0">
            <div className="border-r border-gray-100 bg-gray-50/70 p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">
                      Extraction Summary
                    </h3>
                    {confidence !== null && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                        Confidence {Math.round(confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      <span className="font-medium text-gray-900">Rows:</span>{" "}
                      {extractedRows.length}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Status:</span>{" "}
                      {fileData?.status || "—"}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">
                        Version:
                      </span>{" "}
                      {fileData?.version ?? "—"}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Parsed Rows Preview
                  </h3>

                  {extractedRows.length === 0 ? (
                    <div className="text-sm text-gray-400 italic">
                      Belum ada baris data yang berhasil diekstrak.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {extractedRows.slice(0, 5).map((row, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                        >
                          <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">
                            Row {index + 1}
                          </div>
                          <div className="space-y-2">
                            {Object.entries(row).map(([key, value]) => (
                              <div
                                key={key}
                                className="grid grid-cols-[140px_1fr] gap-3 text-sm"
                              >
                                <span className="font-medium text-gray-600 break-words">
                                  {key}
                                </span>
                                <span className="text-gray-900 break-words">
                                  {String(value ?? "—")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      {extractedRows.length > 5 && (
                        <div className="text-xs text-gray-400 text-center">
                          Menampilkan 5 baris pertama dari{" "}
                          {extractedRows.length} hasil.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Raw Extraction Text
                  </h3>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {rawText || "Tidak ada preview raw text tersedia."}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 overflow-y-auto bg-white">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Edit Extracted JSON
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Anda dapat mengoreksi hasil ekstraksi sebelum menyimpannya.
                  </p>
                </div>

                <textarea
                  value={editorValue}
                  onChange={(e) => setEditorValue(e.target.value)}
                  className="w-full min-h-[360px] rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                  spellCheck={false}
                />

                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  Pastikan format tetap berupa array JSON, misalnya:
                  <span className="font-mono ml-1">[{`{...}`}]</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={handleReject}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {isPending ? <Spinner className="w-4 h-4" /> : null}
                    Reject
                  </button>

                  <button
                    onClick={handleSaveEdits}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-primary bg-primary/10 hover:bg-primary/15 transition-colors disabled:opacity-50"
                  >
                    {isPending ? <Spinner className="w-4 h-4" /> : null}
                    Save Edited Data
                  </button>

                  <button
                    onClick={handleConfirm}
                    disabled={isPending}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-white bg-green-500 hover:bg-green-600 shadow-md shadow-green-500/20 transition-all disabled:opacity-50"
                  >
                    {isPending ? <Spinner className="w-4 h-4" /> : null}
                    Confirm & Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
