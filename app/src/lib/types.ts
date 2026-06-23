export type StepKey = "application" | "lease";
export type StepStatus = "pending" | "sent" | "submitted";

export interface StepState {
  requested: boolean;
  status: StepStatus;
  submittedAt: string | null;
}

export interface Invite {
  id: string;
  token: string;
  tenantName: string;
  tenantEmail: string;
  property: string;
  steps: Record<StepKey, StepState>;
  createdAt: string;
}

export interface DocMeta {
  present: boolean;
  skipped: boolean;
  name?: string;
  size?: number;
  type?: string;
}

export type SlotKey = "contract" | "id" | "bank" | "income";

export interface ApplicationData {
  traveling: string;
  businessDomain: string;
  facilityName: string;
  contractStart: string;
  contractEnd: string;
  shift: string;
  legalName: string;
  aliases: string;
  dob: string;
  taxHome: string;
  household: string;
  pets: string;
  vehicle: string;
  documents: Record<SlotKey, DocMeta>;
}

export interface AppRecord {
  invite: string;
  tenantEmail: string;
  data: ApplicationData;
  status: string;
  submittedAt: string;
  leaseStatus?: string;
  leaseSignedAt?: string;
  updatedAt?: string;
}
