import React, { useState } from "react";

interface GateViewProps {
  onComplete: (name: string) => void;
}

export const GateView: React.FC<GateViewProps> = ({ onComplete }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (cleaned.length < 2) {
      setError("Enter the candidate's name to continue.");
      return;
    }
    setError("");
    onComplete(cleaned);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="amay-card rounded-[28px] p-6">
        <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-[#0B1B4D] dark:text-[#EAF0FF]">
          Welcome to AmaySST Quiz
        </h1>
        <p className="text-base text-[#5A6A92] dark:text-[#93A3CC] mt-2">
          Enter the candidate&apos;s name to begin.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="amay-card rounded-[28px] p-6 space-y-4">
        <div>
          <label
            htmlFor="candidate-name"
            className="block text-sm font-bold text-[#0B1B4D] dark:text-[#EAF0FF] mb-2"
          >
            Candidate name
          </label>
          <input
            id="candidate-name"
            type="text"
            maxLength={20}
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="Your full name"
            className="w-full h-12 px-4 rounded-2xl bg-white/75 dark:bg-[#0B1224]/80 border border-[#1846AA]/15 dark:border-white/10 text-[#0B1B4D] dark:text-white placeholder:text-[#5A6A92]/60 focus:outline-none focus:border-[#1457E0] text-base font-medium"
          />
        </div>

        {error && (
          <p className="text-sm font-semibold text-[#D92D3A] dark:text-[#FF6B76]" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full h-13 rounded-[22px] amay-play-btn text-white font-bold text-base cursor-pointer"
        >
          Start
        </button>
      </form>
    </div>
  );
};
