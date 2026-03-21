import { useState } from "react";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import {
  useListSchemas,
  useCreateSchema,
  useUpdateSchema,
  useDeleteSchema,
  useAutoGenerateSchema,
  type SchemaColumn,
  type SchemaItem,
} from "@/services/api";
import { Database, Plus, Wand2, Trash2, Edit, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { sanitizeMultilineText, sanitizeUserText } from "@/lib/utils";

export default function Schemas({ projectId }: { projectId: string }) {
  const { data: schemas, isLoading } = useListSchemas(projectId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [editingSchema, setEditingSchema] = useState<SchemaItem | null>(null);

  return (
    <ProjectLayout projectId={projectId}>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Data Schemas
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Define what data the AI should extract from the surveys.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setIsAutoModalOpen(true)}
              className="inline-flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-full font-medium shadow-sm hover:bg-secondary transition-colors text-sm"
            >
              <Wand2 className="w-4 h-4 text-purple-500" />
              Auto-Generate
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-full font-medium shadow-md shadow-primary/20 hover:bg-blue-600 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              New Schema
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-card rounded-2xl border border-border animate-pulse" />
          </div>
        ) : schemas?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-card rounded-3xl border border-dashed border-border">
            <Database className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No schemas defined</h3>
            <p className="text-muted-foreground text-sm max-w-sm text-center">
              Create a schema manually or let AI generate one from a sample
              document.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {schemas?.map((schema, idx) => (
              <motion.div
                key={schema.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <SchemaCard
                  schema={schema}
                  projectId={projectId}
                  onEdit={setEditingSchema}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <CreateSchemaModal
            projectId={projectId}
            onClose={() => setIsModalOpen(false)}
          />
        )}
        {editingSchema && (
          <CreateSchemaModal
            projectId={projectId}
            initialSchema={editingSchema}
            onClose={() => setEditingSchema(null)}
          />
        )}
        {isAutoModalOpen && (
          <AutoGenerateModal
            projectId={projectId}
            onClose={() => setIsAutoModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </ProjectLayout>
  );
}

function SchemaCard({
  schema,
  projectId,
  onEdit,
}: {
  schema: SchemaItem;
  projectId: string;
  onEdit: (schema: SchemaItem) => void;
}) {
  const { mutate: del, isPending } = useDeleteSchema();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = () => {
    del(
      { projectId, id: schema.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${projectId}/schemas`],
          });
          toast({ title: "Schema deleted" });
          setConfirmOpen(false);
        },
        onError: (error) => {
          toast({
            title: "Delete failed",
            description:
              error instanceof Error ? error.message : "Gagal menghapus schema",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-bold text-lg text-foreground">{schema.name}</h3>
          {schema.isDefault && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              Default
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {schema.description}
        </p>

        <div className="flex-1 bg-secondary/30 rounded-xl p-3 mb-4 space-y-2 text-xs">
          {schema.columns?.slice(0, 4).map((col: any, i: number) => (
            <div
              key={i}
              className="flex justify-between border-b border-border/50 pb-1 last:border-0 last:pb-0"
            >
              <span className="font-medium text-foreground/80 truncate mr-2">
                {col.name}
              </span>
              <span className="text-muted-foreground capitalize">
                {col.type}
              </span>
            </div>
          ))}
          {schema.columns?.length > 4 && (
            <div className="text-center text-muted-foreground pt-1 italic">
              +{schema.columns.length - 4} more fields
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {schema.updatedAt
              ? format(new Date(schema.updatedAt), "MMM d, yyyy")
              : "—"}
          </span>

          <div className="flex gap-1">
            <button
              onClick={() => onEdit(schema)}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmOpen(true)}
              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        isPending={isPending}
        title="Delete Schema"
        description={
          <>
            Delete <strong>{schema.name}</strong>? Files processed with this
            schema will not be affected.
          </>
        }
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}

function CreateSchemaModal({
  projectId,
  initialSchema,
  onClose,
}: {
  projectId: string;
  initialSchema?: SchemaItem;
  onClose: () => void;
}) {
  const isEditMode = Boolean(initialSchema?.id);
  const [name, setName] = useState(initialSchema?.name ?? "");
  const [description, setDescription] = useState(initialSchema?.description ?? "");
  const [columns, setColumns] = useState<SchemaColumn[]>(
    initialSchema?.columns?.length
      ? initialSchema.columns.map((column) => ({
          name: column.name ?? "",
          type: column.type ?? "text",
          aiGuidance: column.aiGuidance ?? "",
          required: Boolean(column.required),
        }))
      : [
          {
            name: "",
            type: "text",
            aiGuidance: "",
            required: false,
          },
        ],
  );
  const { mutate: create, isPending: isCreating } = useCreateSchema();
  const { mutate: update, isPending: isUpdating } = useUpdateSchema();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isPending = isCreating || isUpdating;

  const updateColumn = <K extends keyof SchemaColumn>(
    index: number,
    key: K,
    value: SchemaColumn[K],
  ) => {
    setColumns((prev) =>
      prev.map((column, colIndex) =>
        colIndex === index ? { ...column, [key]: value } : column,
      ),
    );
  };

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      {
        name: "",
        type: "text",
        aiGuidance: "",
        required: false,
      },
    ]);
  };

  const removeColumn = (index: number) => {
    setColumns((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      return prev.filter((_, colIndex) => colIndex !== index);
    });
  };

  const handleCreate = () => {
    const sanitizedName = sanitizeUserText(name, 255);
    const sanitizedDescription = sanitizeMultilineText(description, 2000);
    const sanitizedColumns = columns.map((column) => ({
      name: sanitizeUserText(column.name, 255),
      type: column.type,
      aiGuidance: sanitizeMultilineText(column.aiGuidance, 800),
      required: Boolean(column.required),
    }));

    if (!sanitizedName) {
      toast({
        title: "Schema name is required",
        variant: "destructive",
      });
      return;
    }

    if (sanitizedColumns.some((column) => !column.name)) {
      toast({
        title: "Field name is required",
        description: "Setiap field schema wajib punya nama.",
        variant: "destructive",
      });
      return;
    }

    if (sanitizedColumns.length === 0) {
      toast({
        title: "At least one field is required",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      name: sanitizedName,
      description: sanitizedDescription || undefined,
      columns: sanitizedColumns,
    };

    const mutationOptions = {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${projectId}/schemas`],
        });
        toast({ title: isEditMode ? "Schema updated" : "Schema created" });
        onClose();
      },
      onError: (error: unknown) => {
        toast({
          title: isEditMode ? "Update schema failed" : "Create schema failed",
          description:
            error instanceof Error
              ? error.message
              : isEditMode
                ? "Gagal memperbarui schema"
                : "Gagal membuat schema",
          variant: "destructive",
        });
      },
    };

    if (isEditMode && initialSchema?.id) {
      update(
        {
          projectId,
          id: initialSchema.id,
          data: payload,
        },
        mutationOptions,
      );
      return;
    }

    create(
      {
        projectId,
        data: payload,
      },
      mutationOptions,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card rounded-2xl w-full max-w-3xl p-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {isEditMode ? "Edit Schema" : "Schema Builder"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Schema Name"
          className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 mb-4 outline-none focus:border-primary"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Deskripsi schema (opsional)"
          className="w-full h-20 bg-secondary/30 border border-border rounded-xl px-4 py-2 mb-4 text-sm outline-none focus:border-primary resize-none"
        />

        <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1 mb-4">
          {columns.map((column, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-secondary/20 p-3"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  value={column.name}
                  onChange={(e) =>
                    updateColumn(index, "name", e.target.value)
                  }
                  placeholder="Field Name"
                  className="md:col-span-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                />

                <select
                  value={column.type}
                  onChange={(e) =>
                    updateColumn(index, "type", e.target.value as SchemaColumn["type"])
                  }
                  className="md:col-span-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="category">Category</option>
                  <option value="boolean">Boolean</option>
                </select>

                <div className="md:col-span-1 flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-foreground/90">
                    <input
                      type="checkbox"
                      checked={Boolean(column.required)}
                      onChange={(e) =>
                        updateColumn(index, "required", e.target.checked)
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    Required
                  </label>

                  <button
                    type="button"
                    onClick={() => removeColumn(index)}
                    disabled={columns.length <= 1}
                    className="inline-flex items-center gap-1 text-xs text-red-500 disabled:text-muted-foreground disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              </div>

              <textarea
                value={column.aiGuidance}
                onChange={(e) =>
                  updateColumn(index, "aiGuidance", e.target.value)
                }
                placeholder="AI guidance (contoh: Ambil skor numerik 1-5 dari jawaban)"
                className="w-full h-20 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addColumn}
          className="w-full mb-4 inline-flex justify-center items-center gap-2 py-2 border border-dashed border-border rounded-xl text-sm font-medium hover:bg-secondary/50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-secondary rounded-xl font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="flex-1 py-2 bg-primary text-white rounded-xl font-medium disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEditMode ? "Save Changes" : "Save"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function AutoGenerateModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const { mutate: generate, isPending } = useAutoGenerateSchema();
  const { mutate: create, isPending: isCreating } = useCreateSchema();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleGen = () => {
    const sanitizedText = sanitizeMultilineText(text, 8000);

    if (!sanitizedText) {
      toast({
        title: "Sample text is required",
        variant: "destructive",
      });
      return;
    }

    generate(
      { projectId, data: { sampleText: sanitizedText } },
      {
        onSuccess: (data) => {
          create(
            {
              projectId,
              data: {
                name: sanitizeUserText(
                  data.suggestedName || "Schema Baru",
                  255,
                ),
                description: sanitizeMultilineText(
                  data.suggestedDescription || "",
                  2000,
                ),
                columns: Array.isArray(data.columns) ? data.columns : [],
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: [`/api/projects/${projectId}/schemas`],
                });
                toast({
                  title: "AI Schema Generated Successfully!",
                  description:
                    "Schema baru telah dibuat dari hasil analisis AI.",
                });
                onClose();
              },
              onError: (error) => {
                toast({
                  title: "Create generated schema failed",
                  description:
                    error instanceof Error
                      ? error.message
                      : "Gagal menyimpan schema hasil AI",
                  variant: "destructive",
                });
              },
            },
          );
        },
        onError: (error) => {
          toast({
            title: "Auto-generate failed",
            description:
              error instanceof Error
                ? error.message
                : "Gagal menganalisis contoh survey",
            variant: "destructive",
          });
        },
      },
    );
  };

  const busy = isPending || isCreating;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card rounded-3xl w-full max-w-xl shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Auto-Generate Schema</h2>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Paste a sample block of text from your survey. Our AI Agent will
          analyze it and suggest the extraction schema.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 'Pertanyaan 1: Apakah Anda puas dengan layanan kami? Sangat Puas. Berikan saran: Tingkatkan kecepatan antrian...'"
          className="w-full h-40 bg-secondary/30 border border-border rounded-xl p-4 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 resize-none mb-4"
        />

        {busy && (
          <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Spinner className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  AI sedang menganalisis contoh survey...
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Meninjau struktur pertanyaan, pola jawaban, dan kandidat kolom
                  schema agar hasil ekstraksi lebih presisi.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 bg-secondary text-secondary-foreground rounded-xl font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleGen}
            disabled={!text.trim() || busy}
            className="flex-1 py-2.5 bg-gradient-to-r from-purple-500 to-primary text-white rounded-xl font-medium shadow-md flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {busy ? (
              <>
                <Spinner className="w-4 h-4 text-white" />
                Analyzing...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate Schema
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
