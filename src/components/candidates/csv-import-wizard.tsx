"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  invalidRowsToCsv,
  parseCsvText,
  type CandidateMapping,
  type CandidateValidationResult,
  type ParsedCsv,
} from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type CandidateListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  organization: string;
  department: string;
  metadata: Record<string, string>;
  createdAt?: string;
};

type Target = "" | "name" | "email" | "phone" | "role" | "organization" | "department" | "metadata";
type Stage = "upload" | "mapping" | "preview";

const targets: Array<{ value: Target; label: string }> = [
  { value: "", label: "Do not import" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "role", label: "Role" },
  { value: "organization", label: "Organization" },
  { value: "department", label: "Department" },
  { value: "metadata", label: "Metadata (extra)" },
];

export function CsvImportWizard({
  eventId,
  initialCandidates,
}: {
  eventId: string;
  initialCandidates: CandidateListItem[];
}) {
  const [stage, setStage] = useState<Stage>("upload");
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Target>>({});
  const [metadataKeys, setMetadataKeys] = useState<Record<string, string>>({});
  const [validation, setValidation] = useState<CandidateValidationResult | null>(null);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [busy, setBusy] = useState(false);

  // Manual add state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    organization: "",
    department: "",
  });
  const [manualError, setManualError] = useState<string | null>(null);

  const mapping = useMemo(() => buildMapping(assignments, metadataKeys), [assignments, metadataKeys]);
  const canValidate = Boolean(mapping.name && mapping.email && parsed?.rows.length);

  async function onFile(file?: File) {
    if (!file) return;
    try {
      const result = parseCsvText(await file.text());
      const autoAssignments = autoMapHeaders(result.headers);
      setParsed(result);
      setAssignments(autoAssignments);
      setMetadataKeys(
        Object.fromEntries(result.headers.map((header) => [header, header]))
      );
      setValidation(null);
      setStage("mapping");
      toast.success(`${result.rows.length} CSV rows loaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to parse CSV");
    }
  }

  function updateAssignment(header: string, target: Target) {
    setAssignments((current) => {
      const next = { ...current };
      if (target && target !== "metadata") {
        for (const key of Object.keys(next)) {
          if (next[key] === target) next[key] = "";
        }
      }
      next[header] = target;
      return next;
    });
    setValidation(null);
  }

  async function validate() {
    if (!parsed || !canValidate) {
      toast.error("Map both name and email before validating");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}/candidates/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows, mapping }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Validation failed");
      setValidation(body.validation);
      setStage("preview");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Validation failed");
    } finally {
      setBusy(false);
    }
  }

  async function importCandidates() {
    if (!parsed || !validation?.counts.valid) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${eventId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.rows, mapping }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Import failed");

      const listResponse = await fetch(`/api/events/${eventId}/candidates`);
      const listBody = await listResponse.json();
      if (!listResponse.ok) throw new Error(listBody.error ?? "Candidates imported, but the list could not refresh");
      setCandidates(listBody.candidates);
      toast.success(`${body.imported} candidate${body.imported === 1 ? "" : "s"} imported`);
      resetImport();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function resetImport() {
    setStage("upload");
    setParsed(null);
    setAssignments({});
    setMetadataKeys({});
    setValidation(null);
  }

  function resetManualForm() {
    setManualForm({ name: "", email: "", phone: "", role: "", organization: "", department: "" });
    setManualError(null);
    setShowManualForm(false);
  }

  async function addManualCandidate(e: React.FormEvent) {
    e.preventDefault();
    if (!manualForm.name.trim() || !manualForm.email.trim()) {
      setManualError("Name and email are required.");
      return;
    }
    setManualBusy(true);
    setManualError(null);
    try {
      const response = await fetch(`/api/events/${eventId}/candidates/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manualForm),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to add candidate");
      setCandidates((prev) => [body.candidate, ...prev]);
      toast.success(`${body.candidate.name} added successfully`);
      resetManualForm();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : "Failed to add candidate");
    } finally {
      setManualBusy(false);
    }
  }

  function downloadInvalidRows() {
    if (!validation) return;
    const csv = invalidRowsToCsv(validation);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "invalid-candidate-rows.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsvTemplate() {
    const templateContent = "Name,Email,Phone,Role,Organization,Department\nJohn Doe,john@example.com,+1234567890,Participant,Acme Corp,Engineering\nJane Smith,jane@example.com,+0987654321,Speaker,Global Tech,Design\n";
    const blob = new Blob([templateContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "candidates-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Import candidates</CardTitle>
              <CardDescription>Upload, map, validate, and import a CSV file.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCsvTemplate}
              >
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
              <div className="flex gap-2 text-xs">
                {(["upload", "mapping", "preview"] as Stage[]).map((item, index) => (
                  <Badge key={item} variant={stage === item ? "default" : "outline"}>
                    {index + 1}. {item === "upload" ? "Upload" : item === "mapping" ? "Map" : "Review"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {stage === "upload" && (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center hover:bg-muted/40">
              <FileSpreadsheet className="h-9 w-9 text-muted-foreground" />
              <div>
                <p className="font-medium">Choose a CSV file</p>
                <p className="text-sm text-muted-foreground">The first row must contain column headers.</p>
              </div>
              <Input
                className="hidden"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                  <Upload className="mr-2 h-4 w-4" /> Select CSV
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    downloadCsvTemplate();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" /> Download CSV Template
                </Button>
              </div>
            </label>
          )}

          {stage === "mapping" && parsed && (
            <div className="space-y-5">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 text-sm font-medium md:grid-cols-[1fr_1fr_1fr]">
                <span>CSV column</span>
                <span>Import as</span>
                <span className="hidden md:block">Metadata key</span>
              </div>
              <div className="space-y-3">
                {parsed.headers.map((header) => (
                  <div key={header} className="grid grid-cols-2 items-center gap-3 md:grid-cols-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{parsed.originalHeaders[header]}</p>
                      <p className="truncate text-xs text-muted-foreground">{parsed.rows[0]?.[header] || "Empty"}</p>
                    </div>
                    <select
                      className="h-10 rounded-lg border bg-card px-3 text-sm"
                      value={assignments[header] ?? ""}
                      onChange={(event) => updateAssignment(header, event.target.value as Target)}
                    >
                      {targets.map((target) => (
                        <option key={target.value} value={target.value}>{target.label}</option>
                      ))}
                    </select>
                    {assignments[header] === "metadata" ? (
                      <Input
                        aria-label={`Metadata key for ${header}`}
                        value={metadataKeys[header] ?? header}
                        onChange={(event) => {
                          setMetadataKeys((current) => ({ ...current, [header]: event.target.value }));
                          setValidation(null);
                        }}
                      />
                    ) : <span className="hidden text-xs text-muted-foreground md:block">—</span>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={resetImport}>Choose another file</Button>
                <Button disabled={!canValidate || busy} onClick={() => void validate()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Validate rows
                </Button>
              </div>
            </div>
          )}

          {stage === "preview" && validation && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Count label="Total" value={validation.counts.total} />
                <Count label="Valid" value={validation.counts.valid} tone="text-emerald-700" />
                <Count label="Duplicates" value={validation.counts.duplicate} tone="text-amber-700" />
                <Count label="Invalid" value={validation.counts.invalid} tone="text-red-700" />
              </div>

              {(validation.counts.invalid > 0 || validation.counts.duplicate > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm text-muted-foreground">
                    Duplicate and invalid rows will not be imported.
                  </p>
                  <Button size="sm" variant="outline" onClick={downloadInvalidRows}>
                    <Download className="h-4 w-4" /> Download skipped rows
                  </Button>
                </div>
              )}

              <div className="max-h-72 overflow-auto rounded-lg border">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.rows.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber} className="border-t">
                        <td className="px-3 py-2">{row.rowNumber}</td>
                        <td className="px-3 py-2">{row.candidate?.name || row.source[mapping.name]}</td>
                        <td className="px-3 py-2">{row.candidate?.email || row.source[mapping.email]}</td>
                        <td className="px-3 py-2">
                          <Badge variant={row.status === "valid" ? "success" : row.status === "duplicate" ? "warning" : "destructive"}>
                            {row.errors[0] ?? "Valid"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={() => setStage("mapping")}>Back to mapping</Button>
                <Button disabled={validation.counts.valid === 0 || busy} onClick={() => void importCandidates()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Import {validation.counts.valid} valid rows
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Candidates ({candidates.length})</CardTitle>
              <CardDescription>Candidates currently attached to this event.</CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant={showManualForm ? "outline" : "default"}
              onClick={() => {
                setShowManualForm((v) => !v);
                setManualError(null);
              }}
              className="shrink-0"
            >
              {showManualForm ? (
                <><X className="mr-2 h-4 w-4" /> Cancel</>
              ) : (
                <><Plus className="mr-2 h-4 w-4" /> Add Candidate Manually</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showManualForm && (
            <form
              onSubmit={(e) => void addManualCandidate(e)}
              className="mb-6 rounded-xl border bg-muted/30 p-5 space-y-4"
            >
              <p className="text-sm font-medium">New candidate details</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-name">Name *</label>
                  <Input
                    id="manual-name"
                    placeholder="Full name"
                    value={manualForm.name}
                    onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                    disabled={manualBusy}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-email">Email *</label>
                  <Input
                    id="manual-email"
                    type="email"
                    placeholder="email@example.com"
                    value={manualForm.email}
                    onChange={(e) => setManualForm((f) => ({ ...f, email: e.target.value }))}
                    disabled={manualBusy}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-phone">Phone</label>
                  <Input
                    id="manual-phone"
                    placeholder="+91 9876543210"
                    value={manualForm.phone}
                    onChange={(e) => setManualForm((f) => ({ ...f, phone: e.target.value }))}
                    disabled={manualBusy}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-role">Role</label>
                  <Input
                    id="manual-role"
                    placeholder="Participant, Speaker…"
                    value={manualForm.role}
                    onChange={(e) => setManualForm((f) => ({ ...f, role: e.target.value }))}
                    disabled={manualBusy}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-org">Organization</label>
                  <Input
                    id="manual-org"
                    placeholder="Company / College"
                    value={manualForm.organization}
                    onChange={(e) => setManualForm((f) => ({ ...f, organization: e.target.value }))}
                    disabled={manualBusy}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-dept">Department</label>
                  <Input
                    id="manual-dept"
                    placeholder="Engineering, Design…"
                    value={manualForm.department}
                    onChange={(e) => setManualForm((f) => ({ ...f, department: e.target.value }))}
                    disabled={manualBusy}
                  />
                </div>
              </div>
              {manualError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {manualError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={resetManualForm} disabled={manualBusy}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={manualBusy}>
                  {manualBusy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</> : "Add Candidate"}
                </Button>
              </div>
            </form>
          )}

          {candidates.length === 0 && !showManualForm ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No candidates imported yet.
            </p>
          ) : candidates.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Organization</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{candidate.name}</td>
                      <td className="px-4 py-3">{candidate.email}</td>
                      <td className="px-4 py-3">{candidate.organization || "—"}</td>
                      <td className="px-4 py-3">{candidate.role || "—"}</td>
                      <td className="px-4 py-3">{candidate.department || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Count({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function autoMapHeaders(headers: string[]): Record<string, Target> {
  const aliases: Record<Exclude<Target, "" | "metadata">, string[]> = {
    name: ["name", "full_name", "candidate_name"],
    email: ["email", "email_address", "e_mail"],
    phone: ["phone", "phone_number", "mobile", "mobile_number"],
    role: ["role", "job_title", "title"],
    organization: ["organization", "organisation", "company", "college"],
    department: ["department", "dept"],
  };
  const result: Record<string, Target> = {};
  for (const header of headers) {
    result[header] =
      (Object.entries(aliases).find(([, values]) => values.includes(header))?.[0] as Target | undefined) ??
      "metadata";
  }
  return result;
}

function buildMapping(
  assignments: Record<string, Target>,
  metadataKeys: Record<string, string>
): CandidateMapping {
  const find = (target: Target) => Object.keys(assignments).find((header) => assignments[header] === target) ?? "";
  return {
    name: find("name"),
    email: find("email"),
    phone: find("phone"),
    role: find("role"),
    organization: find("organization"),
    department: find("department"),
    extras: Object.fromEntries(
      Object.keys(assignments)
        .filter((header) => assignments[header] === "metadata" && metadataKeys[header]?.trim())
        .map((header) => [header, metadataKeys[header].trim()])
    ),
  };
}
