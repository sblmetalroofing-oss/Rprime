import { createHash } from "crypto";

export function generateErrorGroupId(message: string, stackTrace?: string): string {
  const normalizedMessage = normalizeErrorMessage(message);
  const stackFingerprint = stackTrace ? extractStackFingerprint(stackTrace) : "";
  
  const fingerprintSource = `${normalizedMessage}|${stackFingerprint}`;
  
  return createHash("sha256")
    .update(fingerprintSource)
    .digest("hex")
    .substring(0, 16);
}

function normalizeErrorMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<UUID>")
    .replace(/\b[0-9a-f]{24}\b/gi, "<OBJECT_ID>")
    .replace(/\b[0-9a-f]{32,}\b/gi, "<HASH>")
    .replace(/\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?/g, "<TIMESTAMP>")
    .replace(/\d{10,13}/g, "<EPOCH>")
    .replace(/\b\d{1,5}\b(?=\s*(ms|s|seconds|milliseconds))/gi, "<DURATION>")
    .replace(/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]{20,}/g, "/<PATH>/<ID>")
    .replace(/:[0-9]+:[0-9]+/g, ":<LINE>:<COL>")
    .replace(/line\s+\d+/gi, "line <LINE>")
    .replace(/row\s+\d+/gi, "row <ROW>")
    .replace(/column\s+\d+/gi, "column <COL>")
    .replace(/id[=:]\s*['"]?[a-zA-Z0-9_-]+['"]?/gi, "id=<ID>")
    .replace(/user[=:]\s*['"]?[a-zA-Z0-9@._-]+['"]?/gi, "user=<USER>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractStackFingerprint(stackTrace: string): string {
  const lines = stackTrace.split("\n").filter(line => line.trim());
  
  const relevantLines = lines
    .slice(0, 3)
    .map(line => {
      return line
        .replace(/:[0-9]+:[0-9]+/g, "")
        .replace(/\(.*\)/g, "")
        .replace(/at\s+/g, "")
        .replace(/https?:\/\/[^\s]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
    })
    .filter(line => line.length > 0);
  
  return relevantLines.join("|");
}
