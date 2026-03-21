import { useMemo, useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import {
  useDeleteReport,
  useGenerateReport,
  useListKnowledge,
  useListReports,
  useListTemplates,
} from "@/services/api";
import {
  BarChart3,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  getReportStatusProgress,
  sanitizeMultilineText,
  sanitizeUserText,
} from "@/lib/utils";

type ReportLike = {
  id: string;
  name: string;
  status: string;
  progress?: number;
  createdAt: string;
  analysisData?: {
    pipeline?: {
      currentStep: number;
      totalSteps: number;
      currentLabel: string;
      steps?: Array<{
        key: string;
        label: string;
        status: "pending" | "active" | "done" | "error";
      }>;
      error?: string;
    };
    reportType?: string;
    reportPath?: string;
    reportContent?: string;
  } | null;
};

export default function Reports({ projectId }: { projectId: string }) {
  const { data: reports, isLoading } = useListReports(projectId);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Analysis & Reports
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Pilih data survey, jalankan analisis bertahap, lalu unduh hasil
              laporan saat pipeline selesai.
            </p>
          </div>

          <button
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-medium shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex-1">
          <div className="p-4 border-b border-border bg-secondary/30">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Generated Reports
            </h3>
          </div>

          <table className="w-full text-left text-sm">
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : reports?.length === 0 ? (
                <tr>
                  <td className="p-12 text-center">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                      <BarChart3 className="w-8 h-8" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      No reports generated yet
                    </p>
                    <p className="text-sm text-muted-foreground/60 mt-1">
                      Klik "Generate Report" untuk memulai analisis pertama.
                    </p>
                  </td>
                </tr>
              ) : (
                reports?.map((report: ReportLike, idx: number) => (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div>
                            <div className="text-foreground font-medium">
                              {report.name}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {format(
                                new Date(report.createdAt),
                                "MMM d, yyyy HH:mm",
                              )}
                            </div>
                          </div>

                          <ReportStatusBadge report={report} />

                          {report.status !== "done" &&
                            report.status !== "error" && (
                              <ReportPipelinePreview report={report} />
                            )}

                          {report.status === "error" &&
                            report.analysisData?.pipeline?.error && (
                              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {report.analysisData.pipeline.error}
                              </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 shrink-0">
                          <DownloadButton
                            projectId={projectId}
                            report={report}
                          />
                          <DeleteReportButton
                            projectId={projectId}
                            report={report}
                          />
                        </div>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showGenerateModal && (
          <GenerateReportModal
            projectId={projectId}
            onClose={() => setShowGenerateModal(false)}
          />
        )}
      </AnimatePresence>
    </ProjectLayout>
  );
}

function ReportStatusBadge({ report }: { report: ReportLike }) {
  const pipeline = report.analysisData?.pipeline;
  const progress = getReportStatusProgress(report.status, pipeline);

  if (report.status === "done") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
        <CheckCircle2 className="w-3 h-3" />
        Ready
      </span>
    );
  }

  if (report.status === "error") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 rounded-full text-xs font-medium border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
        <X className="w-3 h-3" />
        Error
      </span>
    );
  }

  return (
    <div className="space-y-2 max-w-md">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
        <Loader2 className="w-3 h-3 animate-spin" />
        {report.status}
      </span>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{pipeline?.currentLabel || "Pipeline running"}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
    </div>
  );
}

function ReportPipelinePreview({ report }: { report: ReportLike }) {
  const pipeline = report.analysisData?.pipeline;

  if (!pipeline?.steps || pipeline.steps.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 max-w-3xl">
      {pipeline.steps.map((step) => {
        const styles =
          step.status === "done"
            ? "border-green-200 bg-green-50 text-green-700"
            : step.status === "active"
              ? "border-primary/30 bg-primary/5 text-primary"
              : step.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-gray-200 bg-gray-50 text-gray-500";

        return (
          <div
            key={step.key}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${styles}`}
          >
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

function DownloadButton({
  projectId,
  report,
}: {
  projectId: string;
  report: ReportLike;
}) {
  const { toast } = useToast();

  const handleDownload = () => {
    if (report.status !== "done") {
      toast({
        title: "Report belum siap",
        description: "Tunggu sampai pipeline selesai sebelum mengunduh.",
        variant: "destructive",
      });
      return;
    }

    window.open(
      `/api/projects/${projectId}/reports/${report.id}/download`,
      "_blank",
    );
  };

  return (
    <button
      onClick={handleDownload}
      className="p-2 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary rounded-lg shadow-sm transition-all"
      title="Download report"
    >
      <Download className="w-4 h-4" />
    </button>
  );
}

function DeleteReportButton({
  projectId,
  report,
}: {
  projectId: string;
  report: ReportLike;
}) {
  const { mutate: del, isPending } = useDeleteReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="p-2 bg-card border border-border text-muted-foreground hover:text-red-600 hover:border-red-200 rounded-lg shadow-sm transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          del(
            { projectId, id: report.id },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: [`/api/projects/${projectId}/reports`],
                });
                toast({ title: "Report deleted" });
                setConfirmOpen(false);
              },
            },
          );
        }}
        isPending={isPending}
        title="Delete Report"
        description={
          <>
            Delete <strong>{report.name}</strong>? This cannot be undone.
          </>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

function GenerateReportModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { data: knowledge } = useListKnowledge(projectId);
  const { data: templates } = useListTemplates(projectId);
  const { mutate: generate, isPending } = useGenerateReport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const processedFiles = useMemo(
    () => knowledge?.filter((item: any) => item.status === "done") ?? [],
    [knowledge],
  );

  const [name, setName] = useState(
    `Executive Summary ${format(new Date(), "MMM d")}`,
  );
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>(
    processedFiles.map((item: any) => item.id),
  );

  const toggleSource = (id: string) => {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleAllSources = () => {
    if (selectedSources.length === processedFiles.length) {
      setSelectedSources([]);
      return;
    }

    setSelectedSources(processedFiles.map((item: any) => item.id));
  };

  const handleGenerate = () => {
    const sanitizedName = sanitizeUserText(name, 255);
    const sanitizedPrompt = sanitizeMultilineText(customPrompt, 5000);

    if (!sanitizedName) {
      toast({
        title: "Nama laporan wajib diisi",
        variant: "destructive",
      });
      return;
    }

    if (selectedSources.length === 0) {
      toast({
        title: "Pilih minimal satu sumber data",
        description: "Step 1 analisis membutuhkan minimal satu file survey.",
        variant: "destructive",
      });
      return;
    }

    generate(
      {
        projectId,
        data: {
          name: sanitizedName,
          templateId: selectedTemplate || undefined,
          sourceIds: selectedSources,
          includeStatistics: true,
          includeSentiment: true,
          includeThemes: true,
          customPrompt: sanitizedPrompt || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "Report generation started",
            description:
              "Pipeline analisis berjalan. Progress akan diperbarui otomatis.",
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/reports`],
          });
          onClose();
        },
        onError: (err) => {
          toast({
            title: "Failed to generate report",
            description: err.message,
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
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-card rounded-3xl w-full max-w-2xl shadow-2xl"
      >
        <div className="px-6 pt-6 pb-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold">Generate Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Report Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Template
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-all"
            >
              <option value="">Default Template</option>
              {templates?.map((template: any) => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.isDefault ? "(Active)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-secondary/30 rounded-xl p-4 border border-border/50 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileSignature className="w-5 h-5 text-muted-foreground shrink-0" />
                <div className="text-sm">
                  <span className="font-medium text-foreground">
                    Step 1 — Pilih Data Survey
                  </span>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    Pilih file hasil ekstraksi yang akan masuk ke analisis.
                  </p>
                </div>
              </div>

              <button
                onClick={toggleAllSources}
                className="text-xs text-primary hover:underline"
              >
                {selectedSources.length === processedFiles.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            {processedFiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Belum ada file survey berstatus <strong>done</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {processedFiles.map((file: any) => {
                  const checked = selectedSources.includes(file.id);

                  return (
                    <button
                      key={file.id}
                      onClick={() => toggleSource(file.id)}
                      className={`text-left rounded-xl border px-3 py-3 transition-all ${
                        checked
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-background hover:border-primary/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 h-4 w-4 rounded border ${
                            checked
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">
                            {file.fileName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Included in analysis
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Optional Report Guidance
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Contoh: fokuskan rekomendasi pada keluhan antrean dan kualitas layanan."
              className="w-full min-h-[120px] bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-none"
            />
          </div>

          <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 space-y-2">
            <div className="text-sm font-semibold text-foreground">
              Pipeline yang akan dijalankan
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
              <div className="rounded-xl bg-background border border-border px-3 py-2">
                1/4 Pilih sumber data
              </div>
              <div className="rounded-xl bg-background border border-border px-3 py-2">
                2/4 Analisis Pandas
              </div>
              <div className="rounded-xl bg-background border border-border px-3 py-2">
                3/4 Generate report
              </div>
              <div className="rounded-xl bg-background border border-border px-3 py-2">
                4/4 Finalisasi output
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={
                !name.trim() || isPending || processedFiles.length === 0
              }
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium shadow-md shadow-primary/20 hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Generate
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
