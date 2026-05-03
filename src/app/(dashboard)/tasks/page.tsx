"use client";

import { TasksPageClient } from "@/components/tasks/tasks-page-client";

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-text md:text-3xl">Tasks</h1>
        <p className="mt-1 text-sm text-text-muted">Projects, priorities, and Pomodoro focus.</p>
      </div>
      <TasksPageClient />
    </div>
  );
}
