import type {
  ContestSecurityEvent,
  SecurityEventType,
  SecurityEventSeverity,
} from "@/types/contest";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { submitContestExam } from "@/lib/contest/service";

// Fallback in-memory security event store
const memorySecurityEvents = new Map<string, ContestSecurityEvent[]>(); // contestId:participantId -> events

export interface SecurityPolicyConfig {
  warning_threshold: number; // e.g. 2
  violation_threshold: number; // e.g. 5
  action_on_violation: "warning" | "continue" | "lock" | "terminate" | "auto_submit";
  auto_submit_on_violation?: boolean;
}

const DEFAULT_POLICY: SecurityPolicyConfig = {
  warning_threshold: 2,
  violation_threshold: 5,
  action_on_violation: "lock",
  auto_submit_on_violation: false,
};

/**
 * Records an auditable security event during an active contest.
 * Never blindly accuses users of cheating; logs facts with metadata.
 */
export async function recordSecurityEvent(params: {
  contest_id: string;
  participant_id: string;
  user_id: string;
  event_type: SecurityEventType;
  severity?: SecurityEventSeverity;
  metadata?: Record<string, unknown>;
  policy?: Partial<SecurityPolicyConfig>;
}): Promise<{
  event: ContestSecurityEvent;
  total_events: number;
  action: "warning" | "continue" | "lock" | "terminate" | "auto_submit";
  message: string;
  auto_submitted?: boolean;
}> {
  const policy: SecurityPolicyConfig = {
    ...DEFAULT_POLICY,
    ...params.policy,
  };

  const severity: SecurityEventSeverity =
    params.severity ||
    (params.event_type === "fullscreen_exit" || params.event_type === "tab_switch"
      ? "medium"
      : "low");

  const event: ContestSecurityEvent = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    contest_id: params.contest_id,
    participant_id: params.participant_id,
    user_id: params.user_id,
    event_type: params.event_type,
    severity,
    metadata: params.metadata || {},
    created_at: new Date().toISOString(),
  };

  const key = `${params.contest_id}:${params.participant_id}`;
  const list = memorySecurityEvents.get(key) || [];
  list.push(event);
  memorySecurityEvents.set(key, list);

  // Sync to Supabase if configured
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    try {
      await supabase.from("contest_security_events").insert({
        contest_id: event.contest_id,
        participant_id: event.participant_id,
        user_id: event.user_id,
        event_type: event.event_type,
        severity: event.severity,
        metadata: event.metadata,
      });
    } catch {
      // Ignore
    }
  }

  const count = list.length;
  let action: "warning" | "continue" | "lock" | "terminate" | "auto_submit" = "continue";
  let message = "Event logged";
  let autoSubmitted = false;

  if (count >= policy.violation_threshold) {
    if (policy.auto_submit_on_violation || policy.action_on_violation === "auto_submit" || policy.action_on_violation === "terminate") {
      action = "auto_submit";
      message = `Violation threshold reached (${count}/${policy.violation_threshold} events). Assessment automatically submitted due to integrity policy.`;
      try {
        await submitContestExam({
          contest_id: params.contest_id,
          user_id: params.user_id,
          reason: "integrity_violation",
          violations_count: count,
        });
        autoSubmitted = true;
      } catch {
        // Fallback
      }
    } else {
      action = policy.action_on_violation;
      message = `Violation threshold reached (${count} events). Policy action enforced: ${action}.`;
    }
  } else if (count >= policy.warning_threshold) {
    action = "warning";
    message = `Exam integrity warning (${count}/${policy.violation_threshold} events). Please maintain continuous exam focus.`;
  }

  return {
    event,
    total_events: count,
    action,
    message,
    auto_submitted: autoSubmitted,
  };
}

/**
 * Retrieves auditable security event log for a participant or contest.
 */
export async function getParticipantSecurityEvents(
  contest_id: string,
  participant_id: string
): Promise<ContestSecurityEvent[]> {
  const key = `${contest_id}:${participant_id}`;
  return memorySecurityEvents.get(key) || [];
}
