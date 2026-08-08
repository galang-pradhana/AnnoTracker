"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { AppLogo } from "@/components/shared/AppLogo";
import { ROUTES } from "@/constants";

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuestionOption {
  value: string;
  label: string;
  conditional?: {
    type: "multi_select_and_text" | "radio";
    subQuestion: string;
    checkboxes?: string[];
    textLabel?: string;
    subOptions?: { value: string; label: string }[];
  };
}

interface Question {
  id: string;
  text: string;
  type: "radio" | "radio_conditional";
  options: QuestionOption[];
  required: boolean;
}

interface ComparisonPair {
  id: string;
  left: string;
  right: string;
  label: string;
}

interface ComparisonOption {
  value: string;
  label: string;
}

interface FormTemplate {
  questions: Question[];
  justification: { label: string; description: string; required: boolean };
  responseLabels: string[];
  comparisonPairs?: ComparisonPair[];
  comparisonOptions?: ComparisonOption[];
}

interface AssessmentItem {
  id: string;
  item_number: number;
  user_request: string;
  responses: Record<string, string>;
}

interface AssessmentTask {
  id: string;
  title: string;
  task_type: string;
  description: string;
  status: string;
  form_template: FormTemplate;
  assessment_items: AssessmentItem[];
}

type AnswerObj = { value: string; sub?: string; detail?: string; selected?: string[] };
type AnswerValue = string | string[] | AnswerObj | null;
type ResponseAnswers = Record<string, AnswerValue>;
type ItemAnswers = Record<string, Record<string, ResponseAnswers>>;

const DEFAULT_PAIRWISE_PAIRS: ComparisonPair[] = [
  { id: "A_B", left: "A", right: "B", label: "Comparasi Response A vs Response B" },
  { id: "A_C", left: "A", right: "C", label: "Comparasi Response A vs Response C" },
  { id: "B_C", left: "B", right: "C", label: "Comparasi Response B vs Response C" },
];

const DEFAULT_PAIRWISE_OPTIONS: ComparisonOption[] = [
  { value: "left_much", label: "Left Much Better" },
  { value: "left_better", label: "Left Better" },
  { value: "left_slightly", label: "Left Slightly Better" },
  { value: "same", label: "Same" },
  { value: "right_slightly", label: "Right Slightly Better" },
  { value: "right_better", label: "Right Better" },
  { value: "right_much", label: "Right Much Better" },
];

export interface VcgComparisonQuestion {
  id: string;
  text: string;
  options: { value: string; label: string }[];
}

export const VCG_COMPARISON_QUESTIONS: VcgComparisonQuestion[] = [
  {
    id: "vcg_cq1",
    text: "1. Overall, which side of the image is better?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq2",
    text: "2. Between the two images, which has better visual quality?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq3",
    text: "3. Between the two images, which is better formed and more structurally sound?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq4",
    text: "4. Between the two images, which better represents what was requested in the prompt?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq5",
    text: "5. (Photorealistic style) Between the two images, which one looks more like a real photograph?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq6",
    text: "6. Between the two images, which has better text rendering quality?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same_na", label: "c. About the Same or Not Applicable" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
  {
    id: "vcg_cq7",
    text: "7. Between the two images, which has better aesthetic quality?",
    options: [
      { value: "left_better", label: "a. Left Better" },
      { value: "left_slightly", label: "b. Left Slightly Better" },
      { value: "same", label: "c. About the Same" },
      { value: "right_slightly", label: "d. Right Slightly Better" },
      { value: "right_better", label: "e. Right Better" },
    ],
  },
];

// ── Helper: format multi-line text ────────────────────────────────────────────
function MultiLineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\n|\n/).map((line, i) => (
        <React.Fragment key={i}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </>
  );
}

function getQAns(answers: ItemAnswers, itemId: string, response: string, qId: string): AnswerValue {
  const responseAnswers = answers?.[itemId]?.[response];
  if (!responseAnswers) return null;
  return responseAnswers[qId] ?? null;
}

function getSatisfyingRatingLabel(
  answers: ItemAnswers,
  questions: Question[],
  itemId: string,
  responseLabel: string
): { label: string; isAnswered: boolean } {
  const satQ = questions.find(
    (q) => q.id === "q5" || q.id === "q_satisfying" || q.text.toLowerCase().includes("satisfying")
  ) || questions[questions.length - 1];

  if (!satQ) return { label: "Belum di-rating", isAnswered: false };

  const val = getQAns(answers, itemId, responseLabel, satQ.id);
  if (!val) return { label: "Belum di-rating", isAnswered: false };

  const selectedVal = typeof val === "string" ? val : (val as AnswerObj)?.value;
  if (!selectedVal) return { label: "Belum di-rating", isAnswered: false };

  const opt = satQ.options?.find((o) => o.value === selectedVal);
  if (opt) {
    return { label: opt.label, isAnswered: true };
  }

  return { label: String(selectedVal), isAnswered: true };
}

// ── Single Question renderer ──────────────────────────────────────────────────
function QuestionBlock({
  question,
  value,
  onChange,
  disabled,
}: {
  question: Question;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  disabled?: boolean;
}) {
  const parsed = value as AnswerObj | null;
  const selectedMain = typeof value === "string" ? value : parsed?.value ?? null;

  const setMain = (v: string) => {
    if (disabled) return;
    if (v === selectedMain) {
      onChange(null);
    } else {
      onChange({ value: v, sub: "", detail: "", selected: [] });
    }
  };

  return (
    <div className="space-y-2.5 pt-3 first:pt-0 border-t first:border-t-0 border-[var(--border)]">
      <div className="text-xs font-bold text-[var(--text-primary)] leading-relaxed">
        {question.text}
      </div>

      <div className="space-y-2">
        {question.options.map((opt) => {
          const isSelected = selectedMain === opt.value;
          return (
            <div key={opt.value} className="space-y-2">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                  isSelected
                    ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] font-semibold"
                    : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:brightness-95"
                } ${disabled ? "cursor-not-allowed opacity-80" : ""}`}
              >
                <input
                  type="radio"
                  disabled={disabled}
                  checked={isSelected}
                  onChange={() => setMain(opt.value)}
                  className="mt-0.5 accent-[var(--primary)] shrink-0"
                />
                <span className="leading-snug">{opt.label}</span>
              </label>

              {/* Conditional sub-question */}
              {isSelected && opt.conditional && (
                <div className="ml-5 p-3.5 rounded-xl bg-[var(--bg-surface)] border-l-4 border-l-[var(--primary)] border border-[var(--border)] space-y-3">
                  <div className="text-xs font-bold text-[var(--primary)]">
                    {opt.conditional.subQuestion}
                  </div>

                  {/* Checkboxes (multi_select_and_text) */}
                  {opt.conditional.type === "multi_select_and_text" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {opt.conditional.checkboxes?.map((cb) => {
                          const sel = (parsed?.selected || []).includes(cb);
                          return (
                            <label
                              key={cb}
                              className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                sel
                                  ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] font-semibold"
                                  : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-primary)]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={disabled}
                                checked={sel}
                                onChange={() => {
                                  if (disabled) return;
                                  const prev = parsed?.selected || [];
                                  const next = sel ? prev.filter((x) => x !== cb) : [...prev, cb];
                                  onChange({ ...(parsed || {}), value: opt.value, selected: next });
                                }}
                                className="accent-[var(--primary)]"
                              />
                              <span className="truncate">{cb}</span>
                            </label>
                          );
                        })}
                      </div>

                      {opt.conditional.textLabel && (
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                            {opt.conditional.textLabel}
                          </label>
                          <textarea
                            disabled={disabled}
                            value={parsed?.detail || ""}
                            onChange={(e) =>
                              onChange({ ...(parsed || {}), value: opt.value, detail: e.target.value })
                            }
                            rows={3}
                            placeholder="Tuliskan penjelasan..."
                            className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub radio */}
                  {opt.conditional.type === "radio" && (
                    <div className="space-y-2">
                      {opt.conditional.subOptions?.map((so) => {
                        const isSubSel = parsed?.sub === so.value;
                        return (
                          <label
                            key={so.value}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer ${
                              isSubSel
                                ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] font-semibold"
                                : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-primary)]"
                            }`}
                          >
                            <input
                              type="radio"
                              disabled={disabled}
                              checked={isSubSel}
                              onChange={() =>
                                onChange({ ...(parsed || {}), value: opt.value, sub: so.value })
                              }
                              className="accent-[var(--primary)]"
                            />
                            <span>{so.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeeAssessmentTakePage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;
  const supabase = createClient();

  const [task, setTask] = useState<AssessmentTask | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<ItemAnswers>({});
  const [justificationId, setJustificationId] = useState("");
  const [justificationEn, setJustificationEn] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeItem, setActiveItem] = useState(0);
  const [activeResponse, setActiveResponse] = useState<string>("A");
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(ROUTES.LOGIN); return; }
      setUserId(data.user.id);
    });
  }, [router, supabase]);

  const fetchTask = useCallback(async () => {
    if (!taskId || !userId) return;
    setLoading(true);

    const res = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_task", taskId }),
    });
    const data = await res.json();

    if (!data.task) { setLoading(false); return; }
    const t = data.task as AssessmentTask;
    t.assessment_items?.sort((a, b) => a.item_number - b.item_number);
    setTask(t);

    const subRes = await fetch("/api/admin/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_submission", taskId, userId }),
    });
    const subData = await subRes.json();
    if (subData.submission) {
      const sub = subData.submission;
      setAnswers(sub.answers || {});
      setJustificationId(sub.justification_id || "");
      setJustificationEn(sub.justification_en || "");
      if (sub.status === "submitted") setSubmitted(true);
    }

    setLoading(false);
  }, [taskId, userId]);

  useEffect(() => { fetchTask(); }, [fetchTask]);

  const save = useCallback(
    async (submitFinal = false) => {
      if (!userId || !task || submitted) return;
      setSaving(true);
      setSaveStatus("saving");
      await fetch("/api/admin/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_submission",
          taskId: task.id,
          userId,
          answers,
          justificationId,
          justificationEn,
          status: submitFinal ? "submitted" : "draft",
        }),
      });
      setSaving(false);
      setSaveStatus("saved");
      if (submitFinal) setSubmitted(true);
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    [userId, task, answers, justificationId, justificationEn, submitted]
  );

  useEffect(() => {
    if (submitted) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => { save(false); }, 3000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [answers, justificationId, justificationEn, save, submitted]);

  const setAnswer = (itemId: string, response: string, qId: string, val: AnswerValue) => {
    if (submitted) return;
    setAnswers((prev) => {
      const prevItem = prev[itemId] || {};
      const prevResponse: ResponseAnswers = (prevItem[response] as ResponseAnswers) || {};
      return {
        ...prev,
        [itemId]: {
          ...prevItem,
          [response]: {
            ...prevResponse,
            [qId]: val,
          } as ResponseAnswers,
        },
      };
    });
  };

  const calcProgress = () => {
    if (!task) return 0;
    const items = task.assessment_items || [];
    const qs = task.form_template?.questions || [];
    const responses = task.form_template?.responseLabels || ["A", "B", "C"];
    const pairs = task.form_template?.comparisonPairs || DEFAULT_PAIRWISE_PAIRS;
    const isVcg = task.task_type === "VCG";

    let total = items.length * (responses.length * qs.length + (isVcg ? pairs.length * VCG_COMPARISON_QUESTIONS.length : pairs.length)) + 2;
    let filled = 0;

    for (const item of items) {
      for (const r of responses) {
        for (const q of qs) {
          const v = getQAns(answers, item.id, r, q.id);
          if (v !== null && v !== "") filled++;
        }
      }
      for (const pair of pairs) {
        if (isVcg) {
          for (const vcgQ of VCG_COMPARISON_QUESTIONS) {
            const v = getQAns(answers, item.id, "comparison", `${pair.id}_${vcgQ.id}`);
            if (v !== null && v !== "") filled++;
          }
        } else {
          const v = getQAns(answers, item.id, "comparison", pair.id);
          if (v !== null && v !== "") filled++;
        }
      }
    }

    if (justificationId.trim().length > 0) filled++;
    if (justificationEn.trim().length > 0) filled++;

    return total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  };

  const isComplete = () => {
    if (!task) return false;
    const items = task.assessment_items || [];
    const qs = task.form_template?.questions || [];
    const responses = task.form_template?.responseLabels || ["A", "B", "C"];
    const pairs = task.form_template?.comparisonPairs || DEFAULT_PAIRWISE_PAIRS;
    const isVcg = task.task_type === "VCG";

    for (const item of items) {
      for (const r of responses) {
        for (const q of qs) {
          if (!q.required) continue;
          const v = getQAns(answers, item.id, r, q.id);
          if (v === null || v === "") return false;
        }
      }
      for (const pair of pairs) {
        if (isVcg) {
          for (const vcgQ of VCG_COMPARISON_QUESTIONS) {
            const v = getQAns(answers, item.id, "comparison", `${pair.id}_${vcgQ.id}`);
            if (v === null || v === "") return false;
          }
        } else {
          const v = getQAns(answers, item.id, "comparison", pair.id);
          if (v === null || v === "") return false;
        }
      }
    }
    return justificationId.trim().length > 0 && justificationEn.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!isComplete()) {
      alert("Harap lengkapi semua rating response, comparasi (A-B, A-C, B-C), dan justifikasi akhir sebelum submit.");
      return;
    }
    if (!confirm("Submit assessment ini? Jawaban tidak dapat diubah setelah disubmit.")) return;
    await save(true);
  };

  const items = task?.assessment_items || [];
  const questions = task?.form_template?.questions || [];
  const responseLabels = task?.form_template?.responseLabels || ["A", "B", "C"];
  const comparisonPairs = task?.form_template?.comparisonPairs || DEFAULT_PAIRWISE_PAIRS;
  const comparisonOptions = task?.form_template?.comparisonOptions || DEFAULT_PAIRWISE_OPTIONS;
  const currentItem = items[activeItem];
  const progress = calcProgress();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {loading ? (
          <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
            <div className="text-2xl mb-2 animate-bounce">⏳</div>
            Memuat soal assessment...
          </div>
        ) : !task ? (
          <div className="py-16 text-center space-y-3">
            <div className="text-3xl">❌</div>
            <p className="text-xs text-[var(--text-secondary)]">Assessment tidak ditemukan.</p>
            <Link href={ROUTES.EMPLOYEE_ASSESSMENT} className="text-xs text-[var(--primary)] font-bold">
              ← Kembali ke Daftar
            </Link>
          </div>
        ) : (
          <>
            {/* Top Action Toolbar */}
            <div className="flex items-center justify-between gap-3 bg-[var(--bg-surface)] p-3.5 px-5 rounded-2xl border border-[var(--border)] shadow-xs">
              <Link
                href={ROUTES.EMPLOYEE_ASSESSMENT}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--primary)] transition-colors"
              >
                <span>←</span>
                <span>Daftar Assessment</span>
              </Link>

              <div className="flex items-center gap-2.5">
                {saveStatus === "saving" && <span className="text-xs text-[var(--text-secondary)]">⏳ Menyimpan...</span>}
                {saveStatus === "saved" && <span className="text-xs text-[var(--accent-teal)] font-semibold">✓ Draft tersimpan</span>}

                {!submitted && (
                  <button
                    onClick={() => save(false)}
                    disabled={saving}
                    className="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs font-bold hover:bg-[var(--border)] transition-colors cursor-pointer"
                  >
                    💾 Simpan Draft
                  </button>
                )}

                {submitted ? (
                  <span className="px-4 py-1.5 rounded-xl bg-[var(--accent-teal-soft)] border border-[var(--accent-teal)]/40 text-[var(--accent-teal)] text-xs font-extrabold">
                    ✅ Completed
                  </span>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={saving || !isComplete()}
                    className={`px-4 py-1.5 rounded-xl text-xs font-extrabold text-white shadow-xs transition-all ${
                      isComplete()
                        ? "bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
                        : "bg-[var(--border)] text-[var(--text-secondary)] cursor-not-allowed"
                    }`}
                  >
                    📤 Submit Final
                  </button>
                )}
              </div>
            </div>
            {/* Title & Progress */}
            <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] bg-[var(--primary-soft)] px-2.5 py-0.5 rounded-md border border-[var(--primary)]/20">
                    Task {task.task_type}
                  </span>
                  <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">{task.title}</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{task.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Progress Pengisian</div>
                  <div className="text-lg font-bold text-[var(--primary)]">{progress}%</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[var(--border)] h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--primary)] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Item Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveItem(idx);
                    setActiveResponse(responseLabels[0] || "A");
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    idx === activeItem
                      ? "bg-[var(--primary)] text-white shadow-xs"
                      : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                  }`}
                >
                  Soal {item.item_number}
                </button>
              ))}
            </div>

            {/* Form grid for selected item */}
            {currentItem && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: User Request & Model Responses */}
                <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
                  {/* User Request */}
                  <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border)] shadow-xs overflow-hidden">
                    <div className="bg-[var(--bg-surface-alt)] px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
                      <span className="text-sm">👤</span>
                      <h3 className="text-xs font-bold text-[var(--text-primary)]">
                        User Request — Soal {currentItem.item_number}
                      </h3>
                    </div>
                    <div className="p-4 text-xs leading-relaxed text-[var(--text-primary)] max-h-[30vh] overflow-y-auto">
                      <MultiLineText text={currentItem.user_request} />
                    </div>
                  </div>

                  {/* Response & Comparison Selector */}
                  <div className="bg-[var(--bg-surface)] rounded-3xl border border-[var(--border)] shadow-xs p-4 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Pilih View & Evaluasi
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {responseLabels.map((r) => (
                        <button
                          key={r}
                          onClick={() => setActiveResponse(r)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeResponse === r
                              ? "bg-[var(--primary)] text-white shadow-xs"
                              : "bg-[var(--bg-surface-alt)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--primary-soft)]"
                          }`}
                        >
                          Resp {r}
                        </button>
                      ))}
                      <button
                        onClick={() => setActiveResponse("COMPARISON")}
                        className={`py-2 rounded-xl text-xs font-bold transition-all col-span-1 cursor-pointer ${
                          activeResponse === "COMPARISON"
                            ? "bg-[var(--accent-teal)] text-white shadow-xs"
                            : "bg-[var(--accent-teal-soft)] border border-[var(--accent-teal)]/30 text-[var(--accent-teal)] hover:brightness-95"
                        }`}
                      >
                        ⚡ Comparasi
                      </button>
                    </div>

                    {/* Left Column Preview Box */}
                    {activeResponse !== "COMPARISON" ? (
                      <div className="pt-2 border-t border-[var(--border)]">
                        <div className="text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">
                          {task.task_type === "VCG" ? `Gambar (${activeResponse}):` : `Teks Response ${activeResponse}:`}
                        </div>
                        <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border)] text-xs leading-relaxed text-[var(--text-primary)] max-h-[45vh] overflow-y-auto">
                          {(currentItem.responses?.[activeResponse]?.startsWith("http") || currentItem.responses?.[activeResponse]?.startsWith("/")) ? (
                            <div className="space-y-2 text-center">
                              {/* eslint-disable-next-html-element-suppression */}
                              <img
                                src={currentItem.responses[activeResponse]}
                                alt={activeResponse}
                                className="w-full max-h-64 object-contain rounded-xl border border-[var(--border)] shadow-xs mx-auto"
                              />
                              <p className="text-[10px] text-[var(--text-secondary)] font-mono truncate">
                                {currentItem.responses[activeResponse]}
                              </p>
                            </div>
                          ) : (
                            <MultiLineText text={currentItem.responses?.[activeResponse] || "—"} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-[var(--border)] space-y-3">
                        <div className="text-[11px] font-bold text-[var(--accent-teal)]">
                          🔍 Ringkasan Semua Response untuk Perbandingan:
                        </div>
                        {responseLabels.map((r) => {
                          const satInfo = getSatisfyingRatingLabel(answers, questions, currentItem.id, r);
                          return (
                            <div key={r} className="p-3 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border)] space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-[var(--primary)]">{r}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  satInfo.isAnswered
                                    ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30"
                                    : "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]"
                                }`}>
                                  {satInfo.label}
                                </span>
                              </div>
                              {(currentItem.responses?.[r]?.startsWith("http") || currentItem.responses?.[r]?.startsWith("/")) ? (
                                /* eslint-disable-next-html-element-suppression */
                                <img
                                  src={currentItem.responses[r]}
                                  alt={r}
                                  className="w-full h-24 object-cover rounded-lg border border-[var(--border)]"
                                />
                              ) : (
                                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed">
                                  {currentItem.responses?.[r]}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Questions Form OR Pairwise Comparison */}
                <div className="lg:col-span-7 space-y-5">
                  {activeResponse !== "COMPARISON" ? (
                    /* ── Individual Response Evaluation Form ── */
                    <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                          📝 Rating untuk Response {activeResponse} (Soal {currentItem.item_number})
                        </h3>
                        <span className="text-[11px] text-[var(--text-secondary)] font-medium">5 Pertanyaan</span>
                      </div>

                      <div className="space-y-4">
                        {questions.map((q) => (
                          <QuestionBlock
                            key={`${currentItem.id}-${activeResponse}-${q.id}`}
                            question={q}
                            value={getQAns(answers, currentItem.id, activeResponse, q.id)}
                            onChange={(val) => setAnswer(currentItem.id, activeResponse, q.id, val)}
                            disabled={submitted}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* ── Pairwise Comparison Form (Round Robin: A-B, A-C, B-C) ── */
                    <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-5">
                      <div className="pb-3 border-b border-[var(--border)]">
                        <div className="flex items-center gap-2">
                          <span className="text-base">⚡</span>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent-teal)]">
                            Pairwise Comparison (Round Robin) — Soal {currentItem.item_number}
                          </h3>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mt-1">
                          Bandingkan kualitas tiap pasangan response (A vs B, A vs C, B vs C) dan pilih mana yang lebih baik.
                        </p>
                      </div>

                      <div className="space-y-6">
                        {comparisonPairs.map((pair) => {
                          const currentVal = getQAns(answers, currentItem.id, "comparison", pair.id) as string | null;
                          const leftSat = getSatisfyingRatingLabel(answers, questions, currentItem.id, pair.left);
                          const rightSat = getSatisfyingRatingLabel(answers, questions, currentItem.id, pair.right);

                          return (
                            <div key={pair.id} className="p-4 rounded-2xl bg-[var(--bg-surface-alt)] border border-[var(--border)] space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded bg-[var(--primary-soft)] text-[var(--primary)] font-mono text-[11px]">
                                    {pair.left} vs {pair.right}
                                  </span>
                                  <span>{pair.label}</span>
                                </h4>
                              </div>

                              {/* Preview snippet left vs right with Satisfying rating badge */}
                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-[var(--bg-surface)] p-2.5 rounded-xl border border-[var(--border)]">
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-bold text-[var(--primary)]">Left ({pair.left}):</span>
                                  </div>
                                  {(currentItem.responses?.[pair.left]?.startsWith("http") || currentItem.responses?.[pair.left]?.startsWith("/")) ? (
                                    /* eslint-disable-next-html-element-suppression */
                                    <img
                                      src={currentItem.responses[pair.left]}
                                      alt={pair.left}
                                      className="w-full h-32 object-cover rounded-lg border border-[var(--border)]"
                                    />
                                  ) : (
                                    <p className="text-[var(--text-secondary)] line-clamp-2">{currentItem.responses?.[pair.left]}</p>
                                  )}
                                  <div className="mt-2 pt-1.5 border-t border-[var(--border)]">
                                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold block mb-0.5">Satisfying ({pair.left}):</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block border ${
                                      leftSat.isAnswered
                                        ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30"
                                        : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border)]"
                                    }`}>
                                      {leftSat.label}
                                    </span>
                                  </div>
                                </div>
                                <div className="border-l border-[var(--border)] pl-2">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="font-bold text-[var(--primary)]">Right ({pair.right}):</span>
                                  </div>
                                  {(currentItem.responses?.[pair.right]?.startsWith("http") || currentItem.responses?.[pair.right]?.startsWith("/")) ? (
                                    /* eslint-disable-next-html-element-suppression */
                                    <img
                                      src={currentItem.responses[pair.right]}
                                      alt={pair.right}
                                      className="w-full h-32 object-cover rounded-lg border border-[var(--border)]"
                                    />
                                  ) : (
                                    <p className="text-[var(--text-secondary)] line-clamp-2">{currentItem.responses?.[pair.right]}</p>
                                  )}
                                  <div className="mt-2 pt-1.5 border-t border-[var(--border)]">
                                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold block mb-0.5">Satisfying ({pair.right}):</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block border ${
                                      rightSat.isAnswered
                                        ? "bg-[var(--accent-teal-soft)] text-[var(--accent-teal)] border-[var(--accent-teal)]/30"
                                        : "bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] border-[var(--border)]"
                                    }`}>
                                      {rightSat.label}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 7 VCG Comparison Questions OR Default Single Pairwise Option */}
                              {task.task_type === "VCG" ? (
                                <div className="space-y-4 pt-2">
                                  {VCG_COMPARISON_QUESTIONS.map((vcgQ) => {
                                    const vcgVal = getQAns(answers, currentItem.id, "comparison", `${pair.id}_${vcgQ.id}`) as string | null;
                                    return (
                                      <div key={vcgQ.id} className="space-y-2 p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                                        <p className="text-xs font-bold text-[var(--text-primary)] leading-snug">
                                          {vcgQ.text}
                                        </p>
                                        <div className="space-y-1.5 pt-1">
                                          {vcgQ.options.map((opt) => {
                                            const isSelected = vcgVal === opt.value;
                                            return (
                                              <label
                                                key={opt.value}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                                  isSelected
                                                    ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] font-bold"
                                                    : "bg-[var(--bg-surface-alt)] border-[var(--border)] text-[var(--text-primary)] hover:brightness-95"
                                                } ${submitted ? "cursor-not-allowed opacity-80" : ""}`}
                                              >
                                                <input
                                                  type="radio"
                                                  disabled={submitted}
                                                  checked={isSelected}
                                                  onChange={() => setAnswer(currentItem.id, "comparison", `${pair.id}_${vcgQ.id}`, opt.value)}
                                                  className="accent-[var(--primary)] shrink-0"
                                                />
                                                <span>{opt.label}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-2 pt-1">
                                  {comparisonOptions.map((opt) => {
                                    const isSelected = currentVal === opt.value;
                                    return (
                                      <label
                                        key={opt.value}
                                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                                          isSelected
                                            ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)] font-bold"
                                            : "bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                                        } ${submitted ? "cursor-not-allowed opacity-80" : ""}`}
                                      >
                                        <input
                                          type="radio"
                                          disabled={submitted}
                                          checked={isSelected}
                                          onChange={() => setAnswer(currentItem.id, "comparison", pair.id, opt.value)}
                                          className="accent-[var(--primary)] shrink-0"
                                        />
                                        <span>{opt.label}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Navigation controls */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => {
                        if (activeResponse === "COMPARISON") {
                          setActiveResponse(responseLabels[responseLabels.length - 1]);
                        } else {
                          const idx = responseLabels.indexOf(activeResponse);
                          if (idx > 0) setActiveResponse(responseLabels[idx - 1]);
                          else if (activeItem > 0) {
                            setActiveItem(activeItem - 1);
                            setActiveResponse("COMPARISON");
                          }
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-bold hover:bg-[var(--bg-surface-alt)] transition-colors cursor-pointer"
                    >
                      ← Sebelumnya
                    </button>

                    <button
                      onClick={() => {
                        if (activeResponse !== "COMPARISON") {
                          const idx = responseLabels.indexOf(activeResponse);
                          if (idx < responseLabels.length - 1) setActiveResponse(responseLabels[idx + 1]);
                          else setActiveResponse("COMPARISON");
                        } else if (activeItem < items.length - 1) {
                          setActiveItem(activeItem + 1);
                          setActiveResponse(responseLabels[0]);
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      Selanjutnya →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Justifikasi Akhir ── */}
            <div className="bg-[var(--bg-surface)] rounded-3xl p-6 border border-[var(--border)] shadow-xs space-y-4 pt-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--primary)] flex items-center gap-2">
                  <span>✍️ Justifikasi Akhir & Komentar Keseluruhan Task</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Berikan alasan lengkap dan komentar akhir dari seluruh hasil pengerjaan dan comparasi task ini (wajib diisi dalam Bahasa Indonesia dan English).
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    🇮🇩 Bahasa Indonesia (Justifikasi & Komentar Akhir) *
                  </label>
                  <textarea
                    disabled={submitted}
                    value={justificationId}
                    onChange={(e) => setJustificationId(e.target.value)}
                    rows={4}
                    placeholder="Tuliskan justifikasi dan komentar akhir seluruh pengerjaan task ini dalam Bahasa Indonesia..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1.5">
                    🇬🇧 English (Overall Final Justification & Comments) *
                  </label>
                  <textarea
                    disabled={submitted}
                    value={justificationEn}
                    onChange={(e) => setJustificationEn(e.target.value)}
                    rows={4}
                    placeholder="Write your overall final justification and comments in English..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
