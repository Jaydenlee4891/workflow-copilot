import express from "express";
import { authRouter } from "./routes/auth.js";
import { meRouter } from "./routes/me.js";
import { requestsRouter } from "./routes/requests.js";
import { documentsRouter } from "./routes/documents.js";
import { workflowsRouter } from "./routes/workflows.js";
import { usersRouter } from "./routes/users.js";
import { teamRouter } from "./routes/team.js";
import { platformAuthRouter } from "./routes/platformAuth.js";
import { adminTenantsRouter } from "./routes/adminTenants.js";
import { adminWorkflowsRouter } from "./routes/adminWorkflows.js";

export const app = express();

app.use(express.json());
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/requests", requestsRouter);
app.use("/requests", documentsRouter);
app.use("/workflows", workflowsRouter);
app.use("/users", usersRouter);
app.use("/team", teamRouter);
app.use("/platform-auth", platformAuthRouter);
app.use("/admin/tenants", adminTenantsRouter);
app.use("/admin/tenants", adminWorkflowsRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));
