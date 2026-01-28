/**
 * Component: YearlyHandoverPanel
 * 
 * Special admin component for performing the yearly role handover.
 * Only visible to current Head or Co-Head.
 * 
 * Yearly Handover Flow:
 * 1. Old Co-Head becomes new Head
 * 2. Old Head becomes Executive (or can be demoted further)
 * 3. An Executive becomes new Co-Head
 * 4. New Executives are added to the system
 * 5. Any departing members are marked as Inactive
 * 
 * This component provides a step-by-step guide for this process.
 */

"use client";

import { useState } from "react";
import { UserRole } from "@/types";
import { formatRole } from "@/lib/rbac";

interface YearlyHandoverStep {
  title: string;
  description: string;
  completed: boolean;
}

export default function YearlyHandoverPanel() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<YearlyHandoverStep[]>([
    {
      title: "Backup Current Data",
      description:
        "Take a screenshot or export of current roles before making changes. You can view role history in the audit log.",
      completed: false,
    },
    {
      title: "Promote Co-Head to Head",
      description:
        'In User Management, select the current Co-Head, click "Change Role", and promote them to Head. The current Head will automatically be demoted.',
      completed: false,
    },
    {
      title: "Promote Executive to Co-Head",
      description:
        'In User Management, select the Executive who will become Co-Head, click "Change Role", and promote them. The old Co-Head will automatically become Executive.',
      completed: false,
    },
    {
      title: "Add New Executives",
      description:
        "Invite new members through the application or have them created by an admin. Assign them the Executive role with appropriate permissions.",
      completed: false,
    },
    {
      title: "Manage Permissions",
      description:
        'For each new Executive, click "Permissions" to grant them the abilities they need (e.g., canAddEvents, canUploadPhotos).',
      completed: false,
    },
    {
      title: "Deactivate Departing Members",
      description:
        "For any members who left during the year, click their \"Deactivate\" button to revoke all access immediately.",
      completed: false,
    },
  ]);

  const handleStepComplete = (index: number) => {
    const newSteps = [...steps];
    newSteps[index].completed = !newSteps[index].completed;
    setSteps(newSteps);
  };

  const completedCount = steps.filter((s) => s.completed).length;

  return (
    <div className="bg-gray-900 rounded-xl p-8 border border-gray-700">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Yearly Role Handover</h2>
        <p className="text-gray-400">
          Follow these steps to perform your yearly role transitions and permissions updates.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-300">Progress</span>
          <span className="text-white font-semibold">{completedCount}/{steps.length}</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`p-6 rounded-lg border-2 transition-all ${
              step.completed
                ? "bg-green-900/20 border-green-700"
                : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={step.completed}
                onChange={() => handleStepComplete(index)}
                className="w-6 h-6 mt-1 accent-green-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-gray-400">
                    Step {index + 1}
                  </span>
                  {step.completed && (
                    <span className="text-xs px-2 py-1 bg-green-700 text-green-200 rounded-full">
                      ✓ Completed
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
                <p className="text-gray-300">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Reference */}
      <div className="mt-8 bg-blue-900/20 border border-blue-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-white mb-4">Quick Reference: Role Hierarchy</h3>
        <div className="space-y-3">
          <div>
            <span className="font-semibold text-red-400">Head</span>
            <p className="text-gray-300 text-sm">
              1 person max. Full supreme admin rights. Can do everything.
            </p>
          </div>
          <div>
            <span className="font-semibold text-orange-400">Co-Head</span>
            <p className="text-gray-300 text-sm">
              1 person max. Same full supreme admin rights as Head.
            </p>
          </div>
          <div>
            <span className="font-semibold text-blue-400">Executive</span>
            <p className="text-gray-300 text-sm">
              Multiple people. Limited permissions: view everything, but can only add events, upload
              photos, edit/delete their own content UNLESS granted extra permissions.
            </p>
          </div>
          <div>
            <span className="font-semibold text-gray-400">Member</span>
            <p className="text-gray-300 text-sm">Normal user. Read-only access.</p>
          </div>
          <div>
            <span className="font-semibold text-gray-600">Inactive</span>
            <p className="text-gray-300 text-sm">
              No access. Use this when someone leaves the club.
            </p>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="mt-8 bg-yellow-900/20 border border-yellow-700 rounded-lg p-6">
        <h3 className="text-lg font-bold text-yellow-400 mb-3">⚠️ Important Notes</h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>
            • There can be only <strong>1 Head</strong> at a time. When you promote someone to
            Head, the current Head is automatically demoted.
          </li>
          <li>
            • There can be only <strong>1 Co-Head</strong> at a time. Same automatic demotion
            applies.
          </li>
          <li>
            • <strong>Deactivating a user immediately revokes all access.</strong> Use this when
            someone leaves the club mid-year.
          </li>
          <li>
            • All role changes are tracked in the audit log for security and accountability.
          </li>
          <li>• Executives can have granular permissions. Assign only what they need.</li>
        </ul>
      </div>
    </div>
  );
}
