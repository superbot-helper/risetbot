/**
 * Zod validation schemas for API request bodies.
 * Replaces @workspace/api-zod.
 */
import { z } from "zod";

// ─── Shared Helpers ─────────────────────────────────────────
const UuidSchema = z.string().uuid();

const OptionalUuidArraySchema = z.array(UuidSchema).max(100).optional();

// ─── Health ───────────────────────────────────────────────
export const HealthCheckResponse = z.object({
  status: z.string(),
});

// ─── Projects ─────────────────────────────────────────────
export const CreateProjectBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export const UpdateProjectBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
});

// ─── Schemas ──────────────────────────────────────────────
export const SchemaColumnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "number", "date", "category", "boolean"]),
  aiGuidance: z.string(),
  required: z.boolean().optional(),
});

export const CreateSchemaBody = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  columns: z.array(SchemaColumnSchema),
  isDefault: z.boolean().optional(),
});

export const UpdateSchemaBody = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  columns: z.array(SchemaColumnSchema).optional(),
  isDefault: z.boolean().optional(),
});

export const AutoGenerateSchemaBody = z.object({
  sampleText: z.string().min(10),
  surveyType: z.string().nullable().optional(),
});

// ─── Knowledge ────────────────────────────────────────────
export const UploadKnowledgeBody = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().optional(),
  fileContent: z.string(), // base64 encoded
  schemaId: z.string().nullable().optional(),
});

export const ConfirmExtractionBody = z.object({
  action: z.enum(["confirm", "reject", "edit"]),
  editedData: z.any().optional(),
});

// ─── Reports ──────────────────────────────────────────────
export const GenerateReportBody = z.object({
  name: z.string().min(1).max(255),
  templateId: UuidSchema.optional(),
  sourceIds: OptionalUuidArraySchema,
  includeStatistics: z.boolean().optional(),
  includeSentiment: z.boolean().optional(),
  includeThemes: z.boolean().optional(),
  customPrompt: z.string().nullable().optional(),
});

// ─── Chat ─────────────────────────────────────────────────
export const SendChatMessageBody = z.object({
  message: z.string().min(1),
  sourceIds: OptionalUuidArraySchema,
});

// ─── Type exports ─────────────────────────────────────────
export type CreateProjectInput = z.infer<typeof CreateProjectBody>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectBody>;
export type CreateSchemaInput = z.infer<typeof CreateSchemaBody>;
export type UpdateSchemaInput = z.infer<typeof UpdateSchemaBody>;
export type AutoGenerateSchemaInput = z.infer<typeof AutoGenerateSchemaBody>;
export type UploadKnowledgeInput = z.infer<typeof UploadKnowledgeBody>;
export type ConfirmExtractionInput = z.infer<typeof ConfirmExtractionBody>;
export type GenerateReportInput = z.infer<typeof GenerateReportBody>;
export type SendChatMessageInput = z.infer<typeof SendChatMessageBody>;
