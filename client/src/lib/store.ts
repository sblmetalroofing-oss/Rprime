// Remove zustand import since we are using simple mock data
// import { create } from 'zustand';

export type ReportStatus = 'draft' | 'submitted' | 'completed';
export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  id: string;
  category: string;
  severity: Urgency;
  description: string;
  recommendation: string;
  photoUrl?: string;
}

export interface EstimateItem {
  id: string;
  description: string;
  qty: number;
  unitCost: number;
  markup: number;
}

export interface Report {
  id: string;
  customerId?: string | null;
  jobId?: string | null;
  customerName: string;
  contactPhone?: string | null;
  address: string;
  suburb: string;
  date: string;
  inspector: string;
  status: ReportStatus;
  roofType: string;
  findings: Finding[];
  estimateItems?: EstimateItem[];
  measurements?: Record<string, string>;
  totalEstimates: number;
}

// Mock initial data
export const MOCK_REPORTS: Report[] = [
  {
    id: 'JOB-2024-001',
    customerName: 'Alice Johnson',
    address: '42 Maple Street',
    suburb: 'Chatswood',
    date: '2024-01-15',
    inspector: 'Dave Wilson',
    status: 'completed',
    roofType: 'Terracotta Tile',
    findings: [
      {
        id: 'f1',
        category: 'Tiles',
        severity: 'medium',
        description: 'Cracked ridge capping mortar.',
        recommendation: 'Re-point ridge capping.',
        photoUrl: 'https://images.unsplash.com/photo-1632759929286-90c74945d817?q=80&w=300&auto=format&fit=crop'
      }
    ],
    totalEstimates: 1250.00
  },
  {
    id: 'JOB-2024-002',
    customerName: 'Bob Smith',
    address: '88 Pacific Hwy',
    suburb: 'Roseville',
    date: '2024-01-16',
    inspector: 'Dave Wilson',
    status: 'draft',
    roofType: 'Colorbond',
    findings: [],
    totalEstimates: 0
  }
];

export const MOCK_USER = { name: 'Dave Wilson', role: 'inspector' as const };
