import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import projectsRouter from "./projects.js";
import schemasRouter from "./schemas.js";
import knowledgeRouter from "./knowledge.js";
import reportsRouter from "./reports.js";
import chatRouter from "./chat.js";
import dashboardRouter from "./dashboard.js";
import templatesRouter from "./templates.js";
import agentsRouter from "./agents.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/schemas", schemasRouter);
router.use("/projects/:projectId/knowledge", knowledgeRouter);
router.use("/projects/:projectId/reports", reportsRouter);
router.use("/projects/:projectId/chat", chatRouter);
router.use("/projects/:projectId/templates", templatesRouter);
router.use("/dashboard", dashboardRouter);
router.use("/agents", agentsRouter);

export default router;
