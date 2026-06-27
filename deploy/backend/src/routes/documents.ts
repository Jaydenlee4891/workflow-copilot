import { Router } from "express";
import multer from "multer";
import { withTenantContext } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { asyncHandler, HttpError } from "../httpError.js";
import { storage } from "../storage.js";

export const documentsRouter = Router();

// In-memory multer: files are small administrative docs, and we hand the
// buffer straight to the storage backend. 25 MB cap — a basic sanity
// limit, not a tuned policy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ---------- POST /requests/:id/documents ----------
// Upload one file, tagged to a required-document label. The storage key is
// "<requestId>/<documentId>" so files are naturally grouped per request.
documentsRouter.post(
  "/:id/documents",
  requireAuth,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { tenantId, userId } = req.user!;
    const { documentLabel } = req.body ?? {};
    const file = req.file;

    if (!file) return res.status(400).json({ error: "file is required" });
    if (!documentLabel) return res.status(400).json({ error: "documentLabel is required" });

    const documentId = await withTenantContext(tenantId, async (client) => {
      // Request must exist and belong to the caller's tenant (RLS) — and
      // we additionally require it to be the requester's own request.
      const reqResult = await client.query(
        "SELECT id, requester_id FROM requests WHERE id = $1",
        [req.params.id]
      );
      const request = reqResult.rows[0];
      if (!request) throw new HttpError(404, "Request not found");
      if (request.requester_id !== userId) throw new HttpError(403, "Not your request");

      const insertResult = await client.query(
        `INSERT INTO request_documents (request_id, document_label, storage_key, uploaded_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [req.params.id, documentLabel, "", userId]
      );
      const newDocId = insertResult.rows[0].id;

      const storageKey = `${req.params.id}/${newDocId}`;
      await storage.put(storageKey, file.buffer);

      await client.query(
        "UPDATE request_documents SET storage_key = $1 WHERE id = $2",
        [storageKey, newDocId]
      );

      return newDocId;
    });

    res.status(201).json({ id: documentId, documentLabel });
  })
);

// ---------- GET /requests/:id/documents ----------
// List uploaded documents for a request (labels + ids, not the bytes).
documentsRouter.get(
  "/:id/documents",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tenantId } = req.user!;
    const rows = await withTenantContext(tenantId, async (client) => {
      const result = await client.query(
        `SELECT id, document_label, uploaded_at FROM request_documents
         WHERE request_id = $1 ORDER BY uploaded_at`,
        [req.params.id]
      );
      return result.rows;
    });
    res.json(rows);
  })
);

// ---------- GET /requests/:id/documents/:docId ----------
// Download the actual file bytes.
documentsRouter.get(
  "/:id/documents/:docId",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { tenantId } = req.user!;
    const doc = await withTenantContext(tenantId, async (client) => {
      const result = await client.query(
        "SELECT document_label, storage_key FROM request_documents WHERE id = $1 AND request_id = $2",
        [req.params.docId, req.params.id]
      );
      return result.rows[0] ?? null;
    });
    if (!doc) throw new HttpError(404, "Document not found");

    const data = await storage.get(doc.storage_key);
    res.setHeader("Content-Disposition", `attachment; filename="${doc.document_label}"`);
    res.send(data);
  })
);
