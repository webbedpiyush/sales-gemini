export type CallStatus =
  | "idle"
  | "connecting"
  | "live"
  | "ending"
  | "ended"
  | "error";

export interface AgentResearch {
  public_presence?: string;
  incumbent_solution_info?: string;
  problem_aware_info?: string;
  solution_aware_info?: string;
  pre_existing_champion_info?: string;
  cold_call_scenario?: string;
  warm_call_scenario?: string;
  warm_call_context?: string;
  checkin_call_scenario?: string;
  checkin_call_context?: string;
  renewal_call_scenario?: string;
  renewal_call_context?: string;
  demo_call_scenario?: string;
  demo_call_context?: string;
  manager_one_on_one_call_scenario?: string;
  manager_one_on_one_call_context?: string;
  freight_call_context?: string;
  freight_call_scenario?: string;
  discovery_call_context?: string;
  discovery_call_scenario?: string;
  custom_call_context?: string;
  gatekeeper_name?: string;
  gatekeeper_voice?: string;
  gatekeeper_gender?: string;
  gatekeeper_context?: string;
  gatekeeper_call_scenario?: string;
  messages?: string;
  language?: string;
  keywords?: string[];
  third_party_demo?: boolean;
}

export interface AgentProfile {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string;
  companyName: string;
  openerLine: string;
  emotionalState: string;
  callType: string;
  language: string;
  description: string;
  personalDetails: string[];
  companyDetails: string[];
  companyOrgStructure: string[];
  goals: string[];
  opinions: string[];
  objections: string[];
  research: AgentResearch | null;
}

export interface AgentSummary {
  id: number;
  fullName: string;
  jobTitle: string;
  companyName: string;
  callType: string;
  emotionalState: string;
  language: string;
  industry: string;
}

export interface ScoreCriterion {
  passed: boolean;
  criterion: string;
  explanation: string;
  coaching: string;
  improvement: string;
}

export interface ScoreSection {
  sectionTitle: string;
  description: string;
  maxScore: number;
  achievedScore: number;
  totalCriteriaCount: number;
  passedCriteriaCount: number;
  criteria: ScoreCriterion[];
}

export interface ScorecardTemplate {
  scorecardConfigId: number;
  sections: ScoreSection[];
  totalScore: number;
  passedScore: number;
  finalCallScore: number;
  summary: string;
}

export interface LiveSessionBootstrap {
  sessionId: string;
  agentId: number;
  model: string;
  responseModalities: string[];
  voiceName: string;
  systemInstruction: string;
  transport: "sdk-server";
  status: "ready" | "missing_api_key";
}
