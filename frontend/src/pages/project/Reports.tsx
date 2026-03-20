import { useState } from 'react';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import {
  useListReports,
  useGenerateReport,
  useDeleteReport,
  useListKnowledge,
  useListTemplates,
} from '@/services/api';
import {
  BarChart3,
  Plus,
  Download,
  FileText,
  Loader2,
  Trash2,
  X,
  Wand2,
  FileSignature,
  CheckCircle2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

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
              Generate comprehensive Word/PDF reports from processed data.
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

          <table className="w-full text-left text-sm whitespace-nowrap">
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
                      Click "Generate Report" to create your first analysis
                    </p>
                  </td>
                </tr>
              ) : (
                reports?.map((report, idx) => (
                  <motion.tr
                    key={report.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="hover:bg-muted/30 transition-colors group"
                  >
                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-foreground">{report.name}</div>
                        <div className="text-xs text-muted-foreground font-normal mt-0.5">
                          {format(
                            new Date(report.createdAt),
                            'MMM d, yyyy HH:mm',
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'done' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {report.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary rounded-lg shadow-sm transition-all">
                          <Download className="w-4 h-4" />
                        </button>
                        <DeleteReportButton
                          projectId={projectId}
                          report={report}
                        />
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


function DeleteReportButton({
  projectId,
  report,
}: {
  projectId: string;
  report: any;
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
                toast({ title: 'Report deleted' });
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


/**
 * Modal to configure and generate a new report.
 * Allows selecting data sources, template, and report name.
 */
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

  const [name, setName] = useState(
    `Executive Summary ${format(new Date(), 'MMM d')}`,
  );
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const handleGenerate = () => {
    generate(
      {
        projectId,
        data: {
          name,
          templateId: selectedTemplate || undefined,
          includeStatistics: true,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Report generation started. The Analyst Agent is working.',
          });
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/reports`],
          });
          onClose();
        },
        onError: (err) => {
          toast({
            title: 'Failed to generate report',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const processedCount =
    knowledge?.filter((k) => k.status === 'done').length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-card rounded-3xl w-full max-w-md shadow-2xl"
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

        <div className="px-6 pb-6 space-y-4">
          {/* Report name */}
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

          {/* Template selection */}
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
              {templates?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.isDefault ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Data source info */}
          <div className="bg-secondary/30 rounded-xl p-3 flex items-center gap-3 border border-border/50">
            <FileSignature className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-foreground">
                {processedCount} processed survey(s)
              </span>
              <span className="text-muted-foreground">
                {' '}
                will be included in the analysis
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!name.trim() || isPending}
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
