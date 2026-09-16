"use client";

import { useState } from "react";
import StudentsView from "@/components/admin/management/StudentsView";
import LessonsView from "@/components/admin/management/LessonsView";
import BookkeepingView from "@/components/admin/management/BookkeepingView";

// Tab "Schüler & Buchhaltung": Schülerprofile, alle Nachhilfestunden und die
// Einnahmenüberschussrechnung an einer Stelle. Rechnungen selbst bleiben im
// Tab "Rechnungen"; von hier aus wird nur dorthin verzweigt.
const VIEWS = [
  ["students", "Schüler:innen"],
  ["lessons", "Stunden"],
  ["bookkeeping", "Buchhaltung"],
];

export default function ManagementPanel({ adminFetch, pin, setNotice, onCreateInvoice }) {
  const [view, setView] = useState("students");
  const [openStudentId, setOpenStudentId] = useState(null);

  function showStudent(id) {
    setOpenStudentId(id);
    setView("students");
  }

  const shared = { adminFetch, pin, setNotice, onCreateInvoice, onShowStudent: showStudent };

  return (
    <div className="mt-8 min-w-0">
      <div className="flex flex-wrap gap-2">
        {VIEWS.map(([key, text]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              view === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {view === "students" && (
          <StudentsView {...shared} openStudentId={openStudentId} onOpened={() => setOpenStudentId(null)} />
        )}
        {view === "lessons" && <LessonsView {...shared} />}
        {view === "bookkeeping" && <BookkeepingView {...shared} />}
      </div>
    </div>
  );
}
