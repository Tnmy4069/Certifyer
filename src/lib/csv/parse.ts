import Papa from "papaparse";
import { z } from "zod";

export type CsvRow = Record<string, string>;

export type CandidateMapping = {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  organization?: string;
  department?: string;
  /** Source CSV header -> metadata key. */
  extras?: Record<string, string>;
};

export type CandidateImportValue = {
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string;
  department: string;
  metadata: Record<string, string>;
};

export type ValidatedCandidateRow = {
  rowNumber: number;
  source: CsvRow;
  status: "valid" | "duplicate" | "invalid";
  errors: string[];
  candidate?: CandidateImportValue;
};

export type CandidateValidationResult = {
  rows: ValidatedCandidateRow[];
  counts: {
    total: number;
    valid: number;
    duplicate: number;
    invalid: number;
  };
};

export type ParsedCsv = {
  headers: string[];
  rows: CsvRow[];
  originalHeaders: Record<string, string>;
};

const emailSchema = z.string().email();

export function normalizeHeader(value: string, index = 0) {
  const normalized = value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `column_${index + 1}`;
}

export function parseCsvText(text: string): ParsedCsv {
  if (!text.trim()) throw new Error("CSV file is empty");

  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
  });

  const fatalError = parsed.errors.find((error) => error.type === "Quotes");
  if (fatalError) throw new Error(`CSV parse error: ${fatalError.message}`);
  if (parsed.data.length < 2) throw new Error("CSV must contain a header and at least one data row");

  const used = new Map<string, number>();
  const originalHeaders: Record<string, string> = {};
  const headers = parsed.data[0].map((rawHeader, index) => {
    const base = normalizeHeader(rawHeader, index);
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    const header = seen === 0 ? base : `${base}_${seen + 1}`;
    originalHeaders[header] = rawHeader.replace(/^\uFEFF/, "").trim() || `Column ${index + 1}`;
    return header;
  });

  const rows = parsed.data.slice(1).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, String(values[index] ?? "").trim()]))
  );

  return { headers, rows, originalHeaders };
}

export function validateCandidateRows(
  rows: CsvRow[],
  mapping: CandidateMapping,
  existingEmails: Iterable<string> = []
): CandidateValidationResult {
  const existing = new Set(Array.from(existingEmails, (email) => email.trim().toLowerCase()));
  const seen = new Set<string>();

  const validated = rows.map<ValidatedCandidateRow>((source, index) => {
    const name = readMapped(source, mapping.name);
    const email = readMapped(source, mapping.email).toLowerCase();
    const errors: string[] = [];

    if (!name) errors.push("Name is required");
    if (!email) errors.push("Email is required");
    else if (!emailSchema.safeParse(email).success) errors.push("Email is invalid");

    if (errors.length) {
      return { rowNumber: index + 2, source, status: "invalid", errors };
    }

    if (seen.has(email)) {
      return {
        rowNumber: index + 2,
        source,
        status: "duplicate",
        errors: ["Duplicate email in this file"],
      };
    }
    seen.add(email);

    if (existing.has(email)) {
      return {
        rowNumber: index + 2,
        source,
        status: "duplicate",
        errors: ["Email already exists for this event"],
      };
    }

    const metadata = Object.fromEntries(
      Object.entries(mapping.extras ?? {})
        .map(([sourceHeader, metadataKey]) => [metadataKey.trim(), readMapped(source, sourceHeader)])
        .filter(([key]) => Boolean(key))
    );

    return {
      rowNumber: index + 2,
      source,
      status: "valid",
      errors: [],
      candidate: {
        name,
        email,
        phone: readMapped(source, mapping.phone),
        role: readMapped(source, mapping.role),
        organization: readMapped(source, mapping.organization),
        department: readMapped(source, mapping.department),
        metadata,
      },
    };
  });

  return {
    rows: validated,
    counts: {
      total: validated.length,
      valid: validated.filter((row) => row.status === "valid").length,
      duplicate: validated.filter((row) => row.status === "duplicate").length,
      invalid: validated.filter((row) => row.status === "invalid").length,
    },
  };
}

export function invalidRowsToCsv(result: CandidateValidationResult) {
  const rows = result.rows
    .filter((row) => row.status !== "valid")
    .map((row) => ({
      ...row.source,
      _status: row.status,
      _errors: row.errors.join("; "),
      _row: String(row.rowNumber),
    }));
  return Papa.unparse(rows);
}

function readMapped(row: CsvRow, header?: string) {
  return header ? String(row[header] ?? "").trim() : "";
}
