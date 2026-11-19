import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Scale,
  Sparkles,
  Unlock,
  X,
  XCircle,
} from "lucide-react";
import {
  CLASS_10_AR_QUESTIONS,
  type ARQuestion,
  type ARStandardOption,
} from "../../data/class10/assertionReasonData";
import { playCorrectSound, playIncorrectSound } from "../../lib/soundEffects";

interface AssertionReasonLabViewProps {
  onBack: () => void;
  onAwardXp: (amount: number, reason: string) => void;
}

export const AssertionReasonLabView: React.FC<AssertionReasonLabViewProps> = ({
  onBack,
  onAwardXp,
}) => {
  const [activeSubject, setActiveSubject] = useState<string>("All");
  const [questionIndex, setQuestionIndex] = useState(0);

  // 3-Step Interactive Toggles
  const [step1AssertionTrue, setStep1AssertionTrue] = useState<boolean | null>(null);
  const [step2ReasonTrue, setStep2ReasonTrue] = useState<boolean | null>(null);
  const [step3Explains, setStep3Explains] = useState<boolean | null>(null);

  // Submission & Feedback
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [answeredMap, setAnsweredMap] = useState<Record<string, { correct: boolean; earnedXp: boolean }>>({});

  const filteredQuestions = useMemo(() => {
    if (activeSubject === "All") return CLASS_10_AR_QUESTIONS;
    return CLASS_10_AR_QUESTIONS.filter((q) => q.subject === activeSubject);
  }, [activeSubject]);

  const currentQ: ARQuestion = filteredQuestions[questionIndex] || filteredQuestions[0];

  // Derive which CBSE option (A, B, C, D) the user's toggles represent
  const mappedOption: ARStandardOption | null = useMemo(() => {
    if (step1AssertionTrue === null || step2ReasonTrue === null) return null;

    if (step1AssertionTrue && step2ReasonTrue) {
      if (step3Explains === null) return null; // Needs step 3
      return step3Explains ? "A" : "B";
    }

    if (step1AssertionTrue && !step2ReasonTrue) {
      return "C";
    }

    if (!step1AssertionTrue && step2ReasonTrue) {
      return "D";
    }

    // Both false is non-standard in CBSE, defaults to D or custom
    return "D";
  }, [step1AssertionTrue, step2ReasonTrue, step3Explains]);

  const canSubmit = mappedOption !== null;

  const resetCurrentToggles = () => {
    setStep1AssertionTrue(null);
    setStep2ReasonTrue(null);
    setStep3Explains(null);
    setIsSubmitted(false);
  };

  const handleSubjectChange = (subject: string) => {
    setActiveSubject(subject);
    setQuestionIndex(0);
    resetCurrentToggles();
  };

  const handleNextQuestion = () => {
    if (questionIndex + 1 < filteredQuestions.length) {
      setQuestionIndex((i) => i + 1);
      resetCurrentToggles();
    }
  };

  const handlePrevQuestion = () => {
    if (questionIndex > 0) {
      setQuestionIndex((i) => i - 1);
      resetCurrentToggles();
    }
  };

  const handleSubmit = () => {
    if (!canSubmit || isSubmitted) return;

    const isCorrect = mappedOption === currentQ.correctOption;
    setIsSubmitted(true);

    if (isCorrect) {
      playCorrectSound();
      if (!answeredMap[currentQ.id]?.earnedXp) {
        setSessionScore((s) => s + 10);
        onAwardXp(10, `Class 10 A&R: ${currentQ.subject}`);
        setAnsweredMap((prev) => ({
          ...prev,
          [currentQ.id]: { correct: true, earnedXp: true },
        }));
      }
    } else {
      playIncorrectSound();
      setAnsweredMap((prev) => ({
        ...prev,
        [currentQ.id]: { correct: false, earnedXp: false },
      }));
    }
  };

  const bothAreTrue = step1AssertionTrue === true && step2ReasonTrue === true;

  return (
    <div className="w-full max-w-[532px] mx-auto px-3.5 py-4 space-y-3.5 pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] hover:brightness-105 active:scale-95 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#1457E0]/10 dark:bg-[#5AA2FF]/15 border border-[#1457E0]/20 text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>+{sessionScore} XP Earned</span>
        </div>
      </div>

      {/* Main Title Card */}
      <div className="amay-card rounded-[26px] p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[11px] font-extrabold tracking-wide uppercase">
            <span>CBSE Logic Lab</span>
          </div>

          <span className="text-xs font-bold text-[#5A6A92] dark:text-[#93A3CC]">
            Question {questionIndex + 1} of {filteredQuestions.length}
          </span>
        </div>

        <h1 className="text-[20px] font-extrabold text-[#0B1B4D] dark:text-white leading-tight">
          Assertion & Reason Logic Lab
        </h1>
        <p className="text-xs text-[#5A6A92] dark:text-[#93A3CC]">
          Master CBSE Assertion (A) & Reason (R) questions step-by-step using interactive logic toggles.
        </p>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 no-scrollbar text-xs font-bold">
          {["All", "History", "Civics", "Geography", "Economics"].map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => handleSubjectChange(sub)}
              className={`px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer ${
                activeSubject === sub
                  ? "bg-[#1457E0] text-white"
                  : "bg-white/60 dark:bg-white/5 text-[#5A6A92] dark:text-[#93A3CC] border border-[#1846AA]/10 dark:border-white/10"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* Question Card (Assertion & Reason Statements) */}
      <div className="amay-card rounded-[26px] p-4 space-y-3.5">
        <div className="flex items-center justify-between border-b border-[#1846AA]/10 dark:border-white/10 pb-2.5">
          <span className="text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
            {currentQ.subject} · {currentQ.chapter}
          </span>
          {answeredMap[currentQ.id]?.correct && (
            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
            </span>
          )}
        </div>

        {/* Assertion (A) Statement Box */}
        <div className="p-3.5 rounded-2xl bg-sky-500/[0.07] dark:bg-sky-500/[0.1] border border-sky-500/20 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#1457E0] dark:text-[#5AA2FF]">
            <span className="px-1.5 py-0.5 rounded-md bg-[#1457E0] text-white text-[10px]">A</span>
            <span>Assertion (A)</span>
          </div>
          <p className="text-sm font-bold text-[#0B1B4D] dark:text-[#EEF3FF] leading-relaxed">
            &ldquo;{currentQ.assertion}&rdquo;
          </p>
        </div>

        {/* Reason (R) Statement Box */}
        <div className="p-3.5 rounded-2xl bg-indigo-500/[0.07] dark:bg-indigo-500/[0.1] border border-indigo-500/20 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-indigo-600 dark:text-indigo-400">
            <span className="px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[10px]">R</span>
            <span>Reason (R)</span>
          </div>
          <p className="text-sm font-bold text-[#0B1B4D] dark:text-[#EEF3FF] leading-relaxed">
            &ldquo;{currentQ.reason}&rdquo;
          </p>
        </div>
      </div>

      {/* 3 Step Interactive Toggle Controls */}
      <div className="amay-card rounded-[26px] p-4 space-y-3.5 border-2 border-[#1457E0]/15">
        <h2 className="text-xs font-extrabold text-[#5A6A92] dark:text-[#93A3CC] tracking-wider uppercase">
          Step-by-Step Logic Analysis
        </h2>

        {/* Step 1: Is Assertion (A) True or False? */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#1846AA]/10 dark:border-white/10">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC] block">Step 1</span>
            <strong className="text-xs sm:text-sm font-bold text-[#0B1B4D] dark:text-white">
              Is Assertion (A) True?
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isSubmitted}
              onClick={() => {
                setStep1AssertionTrue(true);
                if (step2ReasonTrue !== true) setStep3Explains(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                step1AssertionTrue === true
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white hover:bg-emerald-500/20"
              }`}
            >
              <Check className="w-3.5 h-3.5" /> True
            </button>
            <button
              type="button"
              disabled={isSubmitted}
              onClick={() => {
                setStep1AssertionTrue(false);
                setStep3Explains(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                step1AssertionTrue === false
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white hover:bg-red-500/20"
              }`}
            >
              <X className="w-3.5 h-3.5" /> False
            </button>
          </div>
        </div>

        {/* Step 2: Is Reason (R) True or False? */}
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/60 dark:bg-white/5 border border-[#1846AA]/10 dark:border-white/10">
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC] block">Step 2</span>
            <strong className="text-xs sm:text-sm font-bold text-[#0B1B4D] dark:text-white">
              Is Reason (R) True?
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={isSubmitted}
              onClick={() => {
                setStep2ReasonTrue(true);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                step2ReasonTrue === true
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white hover:bg-emerald-500/20"
              }`}
            >
              <Check className="w-3.5 h-3.5" /> True
            </button>
            <button
              type="button"
              disabled={isSubmitted}
              onClick={() => {
                setStep2ReasonTrue(false);
                setStep3Explains(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${
                step2ReasonTrue === false
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white hover:bg-red-500/20"
              }`}
            >
              <X className="w-3.5 h-3.5" /> False
            </button>
          </div>
        </div>

        {/* Step 3: Unlocks ONLY when BOTH A and R are True! */}
        <div
          className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border transition-all ${
            bothAreTrue
              ? "bg-amber-500/[0.08] dark:bg-amber-500/[0.12] border-amber-500/30"
              : "bg-gray-500/[0.04] dark:bg-white/[0.02] border-gray-400/20 opacity-50"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC]">
              {bothAreTrue ? (
                <Unlock className="w-3 h-3 text-emerald-500" />
              ) : (
                <Lock className="w-3 h-3 text-gray-400" />
              )}
              <span>Step 3 (Unlocks if Both True)</span>
            </div>
            <strong className="text-xs sm:text-sm font-bold text-[#0B1B4D] dark:text-white">
              Does R correctly explain A?
            </strong>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!bothAreTrue || isSubmitted}
              onClick={() => setStep3Explains(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                step3Explains === true
                  ? "bg-[#1457E0] text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white disabled:opacity-30 hover:bg-[#1457E0]/20"
              }`}
            >
              Yes
            </button>
            <button
              type="button"
              disabled={!bothAreTrue || isSubmitted}
              onClick={() => setStep3Explains(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                step3Explains === false
                  ? "bg-[#1457E0] text-white shadow-sm"
                  : "bg-[#1457E0]/10 dark:bg-white/10 text-[#0B1B4D] dark:text-white disabled:opacity-30 hover:bg-[#1457E0]/20"
              }`}
            >
              No
            </button>
          </div>
        </div>

        {/* Live Automatic Mapping to CBSE Option (A, B, C, D) */}
        {mappedOption && (
          <div className="p-3 rounded-2xl bg-gradient-to-r from-[#1457E0]/10 to-[#5AA2FF]/15 border border-[#1457E0]/20 flex items-center justify-between gap-2">
            <div>
              <span className="text-[11px] font-bold text-[#5A6A92] dark:text-[#93A3CC] block">
                Mapped CBSE Board Option:
              </span>
              <strong className="text-sm font-extrabold text-[#0B1B4D] dark:text-white">
                Option ({mappedOption})
              </strong>
            </div>

            <div className="text-right text-[11px] font-semibold text-[#1457E0] dark:text-[#5AA2FF] max-w-[220px]">
              {mappedOption === "A" && "Both A and R are true, and R is the correct explanation of A."}
              {mappedOption === "B" && "Both A and R are true, but R is NOT the correct explanation of A."}
              {mappedOption === "C" && "Assertion (A) is true, but Reason (R) is false."}
              {mappedOption === "D" && "Assertion (A) is false, but Reason (R) is true."}
            </div>
          </div>
        )}
      </div>

      {/* Submission & Feedback Section */}
      {!isSubmitted ? (
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className="w-full h-13 rounded-[26px] amay-play-btn text-white font-bold text-base flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 active:scale-[0.98] transition-transform shadow-lg"
        >
          <Scale className="w-4 h-4" />
          <span>Submit Logic Solution</span>
        </button>
      ) : (
        <div
          className={`amay-card rounded-[26px] p-4 space-y-3 border-2 ${
            mappedOption === currentQ.correctOption
              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15"
              : "border-red-500 bg-red-500/10 dark:bg-red-500/15"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {mappedOption === currentQ.correctOption ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div>
                <strong className="text-base font-extrabold text-[#0B1B4D] dark:text-white">
                  {mappedOption === currentQ.correctOption
                    ? "Spot On! Option (" + currentQ.correctOption + ") is Correct"
                    : "Official Answer: Option (" + currentQ.correctOption + ")"}
                </strong>
                <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC]">
                  {mappedOption === currentQ.correctOption
                    ? "+10 XP added to your board score"
                    : `You selected Option (${mappedOption})`}
                </p>
              </div>
            </div>
          </div>

          {/* NCERT 2-Line Official Explanation */}
          <div className="p-3 rounded-2xl bg-white/70 dark:bg-[#0B1528]/70 border border-[#1846AA]/10 dark:border-white/10 space-y-1">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-emerald-600 dark:text-emerald-400 block">
              Official NCERT Explanation
            </span>
            <p className="text-xs font-medium text-[#0B1B4D] dark:text-[#EEF3FF] leading-relaxed">
              {currentQ.ncertExplanation}
            </p>
            <div className="pt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              💡 Takeaway: {currentQ.conceptSummary}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer (Prev / Next Questions) */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={questionIndex === 0}
          onClick={handlePrevQuestion}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-full amay-card text-xs font-bold text-[#0B1B4D] dark:text-[#EAF0FF] disabled:opacity-30 hover:brightness-105 active:scale-95 transition cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <span className="text-xs font-bold font-mono-nums text-[#5A6A92] dark:text-[#93A3CC]">
          {questionIndex + 1} / {filteredQuestions.length}
        </span>

        <button
          type="button"
          disabled={questionIndex === filteredQuestions.length - 1}
          onClick={handleNextQuestion}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#1457E0] text-white text-xs font-bold disabled:opacity-30 hover:brightness-105 active:scale-95 transition cursor-pointer shadow-md"
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
