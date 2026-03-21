import { useCallback, useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import {
  useListTemplates,
  useUploadTemplate,
  useDeleteTemplate,
  useSetDefaultTemplate,
} from "@/services/api";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Upload,
  FileSignature,
  Trash2,
  Star,
  Loader2,
  FileText,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes, sanitizeFilename, sanitizeUserText } from "@/lib/utils";

export default function Template({ projectId }: { projectId: string }) {
  const { data: templates, isLoading } = useListTemplates(projectId);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Report Templates
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Upload DOCX templates with Jinja2 tags for custom report
              generation.
            </p>
          </div>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-full font-medium shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors text-sm"
          >
            <Upload className="w-4 h-4" />
            Upload Template
          </button>
        </div>

        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-white text-primary flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Validasi file template aktif
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Sesuai Phase 9, frontend hanya menerima file{" "}
              <strong>.docx</strong>. File selain DOCX akan ditolak sebelum
              dikirim ke server.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-48 bg-white rounded-2xl border border-border animate-pulse"
              />
            ))}
          </div>
        ) : templates?.length === 0 ? (
          <EmptyState onUpload={() => setUploadModalOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates?.map((template, idx) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <TemplateCard template={template} projectId={projectId} />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {uploadModalOpen && (
          <UploadModal
            projectId={projectId}
            onClose={() => setUploadModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </ProjectLayout>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200">
      <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mb-4">
        <FileSignature className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
      <p className="text-muted-foreground text-sm max-w-sm text-center mb-6">
        Upload a DOCX template with Jinja2 tags like{" "}
        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
          {"{{ total_respondents }}"}
        </code>{" "}
        to generate reports.
      </p>
      <button
        onClick={onUpload}
        className="px-6 py-2.5 bg-primary text-white font-medium rounded-full shadow-md hover:bg-blue-600 transition-colors"
      >
        Upload First Template
      </button>
    </div>
  );
}

function TemplateCard({
  template,
  projectId,
}: {
  template: any;
  projectId: string;
}) {
  const { mutate: del, isPending: isDeleting } = useDeleteTemplate();
  const { mutate: setDefault, isPending: isSetting } = useSetDefaultTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: [`/api/projects/${projectId}/templates`],
    });

  const handleDelete = () => {
    del(
      { projectId, id: template.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "Template deleted" });
          setConfirmOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Delete failed",
            description:
              error instanceof Error
                ? error.message
                : "Gagal menghapus template",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleSetDefault = () => {
    setDefault(
      { projectId, id: template.id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: `${template.name} set as default` });
        },
        onError: (error) => {
          toast({
            title: "Set default failed",
            description:
              error instanceof Error
                ? error.message
                : "Gagal mengubah template default",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
      <div
        className={`bg-white rounded-2xl border shadow-sm p-5 flex flex-col h-full hover:shadow-md transition-shadow relative overflow-hidden ${
          template.isDefault
            ? "border-primary/30 shadow-[0_4px_20px_rgba(0,122,255,0.08)]"
            : "border-border"
        }`}
      >
        {template.isDefault && (
          <div className="absolute top-0 right-0 bg-primary text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-bl-lg tracking-wider">
            Active
          </div>
        )}

        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              template.isDefault
                ? "bg-primary/10 text-primary"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <FileSignature className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{template.name}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {template.createdAt
                ? format(new Date(template.createdAt), "MMM d, yyyy")
                : "DOCX Template"}
            </p>
          </div>
        </div>

        <div className="flex-1 bg-gray-50 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <FileText className="w-3.5 h-3.5" />
            <span className="truncate">
              {template.fileName || template.name}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          {!template.isDefault ? (
            <button
              onClick={handleSetDefault}
              disabled={isSetting}
              className="text-xs text-gray-500 hover:text-primary transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Star className="w-3.5 h-3.5" />
              Set as Default
            </button>
          ) : (
            <span className="text-xs text-primary font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Default Template
            </span>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        isPending={isDeleting}
        title="Delete Template"
        description={
          <>
            Delete <strong>{template.name}</strong>? Reports already generated
            with this template will not be affected.
          </>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

function UploadModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const { mutate: upload, isPending } = useUploadTemplate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileAccepted = useCallback(
    (accepted: File[]) => {
      if (accepted.length === 0) return;

      const selectedFile = accepted[0];
      const safeName = sanitizeFilename(selectedFile.name);
      const safeDisplayName = sanitizeUserText(
        safeName.replace(/\.docx$/i, ""),
        255,
      );

      const normalizedFile = new File([selectedFile], safeName, {
        type: selectedFile.type,
        lastModified: selectedFile.lastModified,
      });

      setFile(normalizedFile);
      if (!name.trim()) {
        setName(safeDisplayName);
      }
    },
    [name],
  );

  const handleRejected = useCallback(
    (rejections: FileRejection[]) => {
      for (const rejection of rejections) {
        const firstError = rejection.errors[0];
        toast({
          title: `File ditolak: ${rejection.file.name}`,
          description:
            firstError?.message ||
            "Hanya file DOCX hingga 10 MB yang diperbolehkan.",
          variant: "destructive",
        });
      }
    },
    [toast],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileAccepted,
    onDropRejected: handleRejected,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpload = () => {
    if (!file) return;

    const sanitizedName = sanitizeUserText(name, 255);

    if (!sanitizedName) {
      toast({
        title: "Template name is required",
        description: "Masukkan nama template terlebih dahulu.",
        variant: "destructive",
      });
      return;
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      toast({
        title: "Format file tidak valid",
        description: "Frontend hanya menerima file .docx.",
        variant: "destructive",
      });
      return;
    }

    upload(
      {
        projectId,
        file,
        name: sanitizedName,
        isDefault,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/templates`],
          });
          toast({
            title: "Template uploaded successfully",
            description: "Template DOCX siap digunakan untuk generate report.",
          });
          onClose();
        },
        onError: (err) => {
          toast({
            title: "Upload failed",
            description: err.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  const removeFile = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFile(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl"
      >
        <div className="px-6 pt-6 pb-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Upload Template</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                <div className="font-semibold text-foreground mb-1">
                  Aturan upload template
                </div>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Hanya file .docx</li>
                  <li>Maksimum ukuran 10 MB</li>
                  <li>Nama template akan disanitasi sebelum dikirim</li>
                </ul>
              </div>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-primary bg-blue-50/50"
                : file
                  ? "border-green-300 bg-green-50/30"
                  : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <FileSignature className="w-6 h-6 text-green-600" />
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <button
                  onClick={removeFile}
                  className="p-1 text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">
                  Drop DOCX file here
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Supports only .docx format
                </p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Template Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Laporan Standar Instansi v2"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-gray-600">
              Set as default template for this project
            </span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !name.trim() || isPending}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium shadow-md shadow-primary/20 hover:bg-blue-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Upload
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
