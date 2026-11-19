import React from "react";
import { STATIC_QUESTIONS, type QuizKey, type RawQuestion, type SubjectKey } from "../data/questions";
import {
  formatXpValue,
  getAvailableCount,
  getNegativePenalty,
  getSubjectMeta,
  LEVELS,
  QUIZ_LENGTHS,
  SUBJECT_ORDER,
  XP_PER_LEVEL,
} from "../lib/quizEngine";

interface SubjectsGridViewProps {
  onSelectSubject: (k: QuizKey) => void;
}

export const SubjectsGridView: React.FC<SubjectsGridViewProps> = ({ onSelectSubject }) => {
  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        Subjects
      </h1>

      <div className="grid grid-cols-2 gap-3">
        {SUBJECT_ORDER.map((k) => {
          const bank = STATIC_QUESTIONS[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelectSubject(k)}
              className="amay-card rounded-[24px] p-4 sm:p-5 text-left cursor-pointer hover:-translate-y-0.5 active:scale-[0.97] transition-all"
            >
              <span className="block text-[30px] mb-2" aria-hidden="true">
                {bank.e}
              </span>
              <span className="block text-[17px] font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">
                {bank.n}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface SubjectConfigViewProps {
  subjectKey: QuizKey;
  level: number;
  length: number;
  mergedBank: Record<SubjectKey, RawQuestion[]>;
  onChangeLevel: (l: number) => void;
  onChangeLength: (n: number) => void;
  onBack: () => void;
  onStart: () => void;
}

export const SubjectConfigView: React.FC<SubjectConfigViewProps> = ({
  subjectKey,
  level,
  length,
  mergedBank,
  onChangeLevel,
  onChangeLength,
  onBack,
  onStart,
}) => {
  const meta = getSubjectMeta(subjectKey);
  const maxAvail = getAvailableCount(subjectKey, mergedBank);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="amay-card rounded-[20px] px-4 py-2.5 text-sm font-bold text-[#1457E0] dark:text-[#5AA2FF] cursor-pointer"
      >
        ‹ Back
      </button>

      <h1 className="text-[26px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF] px-1">
        {meta.emoji} {meta.name}
      </h1>

      <div className="space-y-2">
        <h2 className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF] px-1">Level</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {LEVELS.map((lvlName, idx) => {
            const active = level === idx;
            const penalty = formatXpValue(getNegativePenalty(idx));
            return (
              <button
                key={lvlName}
                type="button"
                onClick={() => onChangeLevel(idx)}
                className={`rounded-[18px] p-3.5 text-left transition-all cursor-pointer ${
                  active
                    ? "bg-[#1457E0]/15 dark:bg-[#5AA2FF]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF]"
                    : "amay-card"
                }`}
              >
                <div className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">{lvlName}</div>
                <div className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                  +{XP_PER_LEVEL[idx]} XP right · −{penalty} XP wrong
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF] px-1">Questions and time</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {Object.keys(QUIZ_LENGTHS)
            .map(Number)
            .map((n) => {
              const disabled = maxAvail < n;
              const active = length === n;
              const mins = QUIZ_LENGTHS[n];
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeLength(n)}
                  className={`rounded-[18px] p-3.5 text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    active
                      ? "bg-[#1457E0]/15 dark:bg-[#5AA2FF]/20 border-2 border-[#1457E0] dark:border-[#5AA2FF]"
                      : "amay-card"
                  }`}
                >
                  <div className="text-base font-bold text-[#0B1B4D] dark:text-[#EAF0FF]">{n} questions</div>
                  <div className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] mt-0.5">
                    {disabled ? "Needs more questions" : `${mins} minutes`}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      <p className="text-xs font-semibold text-[#5A6A92] dark:text-[#93A3CC] px-1">
        1/4 negative marking applies to wrong answers. Unanswered (skipped) questions carry 0 penalty.
      </p>

      <button
        type="button"
        onClick={onStart}
        className="w-full h-14 rounded-[22px] amay-play-btn text-white font-bold text-lg cursor-pointer mt-2"
      >
        Start quiz
      </button>
    </div>
  );
};
