export type UserRole = 'Admin' | 'Analyst' | 'User';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
}

export interface ThreatIntelIndicator {
  type: 'url' | 'domain' | 'phone' | 'email';
  value: string;
  reputation: 'clean' | 'suspicious' | 'malicious' | 'unknown';
  details?: string;
}

export interface DetectionResult {
  verdict: 'Scam' | 'Safe';
  riskLevel: 'Low' | 'Medium' | 'High';
  confidence: number;
  analysis: string;
  category?: string;
  suspicious_phrases?: string[];
  reasons?: string[];
  recommended_actions?: string[];
  threat_intel?: ThreatIntelIndicator[];
  fallback_used?: boolean;
}

export interface Stats {
  totalUsers: number;
  totalScams: number;
  recentDetections: Array<{
    id: number;
    message_text: string;
    verdict: string;
    riskLevel: string;
    timestamp: string;
  }>;
  riskDistribution: Array<{
    riskLevel: string;
    count: number;
  }>;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_email?: string;
  user_name?: string;
  action: string;
  resource: string;
  resource_id: string | null;
  details: string; // JSON string
  ip_address: string;
  timestamp: string;
}
