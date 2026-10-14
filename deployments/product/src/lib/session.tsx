import { createContext, useContext, useState, type ReactNode } from 'react';
import { api } from '@appdeploy/client';

export interface Relation {
  path: string;
  excerpt: string;
  reason: string;
  resolution: string;
}

export interface Report {
  historical: unknown[];
  memory: unknown[];
  capturedAt: string;
  objective: string;
  path: string;
  excerpt: string;
  dirty: boolean;
  documentVersion: number;
  truncated: boolean;
  redactions: number;
  focused: { name: string; path: string };
  related: Relation[];
  limitations: string[];
}

interface EvidenceState {
  report: Report | null;
  status: 'idle' | 'loading' | 'error';
  message: string;
  inspect: (body: { sample?: boolean; source?: string }) => Promise<void>;
}

const EvidenceContext = createContext<EvidenceState | null>(null);

function readError(caught: unknown): string {
  const error = caught as { response?: { data?: { message?: string } } };
  return (
    error.response?.data?.message || 'The evidence could not be inspected.'
  );
}

export function EvidenceProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<Report | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function inspect(body: { sample?: boolean; source?: string }) {
    setReport(null);
    setStatus('loading');
    setMessage('');
    try {
      const response = await api.post('/api/inspect', body);
      setReport(response.data as Report);
      setStatus('idle');
    } catch (caught) {
      setStatus('error');
      setMessage(readError(caught));
    }
  }

  return (
    <EvidenceContext.Provider value={{ report, status, message, inspect }}>
      {children}
    </EvidenceContext.Provider>
  );
}

export function useEvidence(): EvidenceState {
  const value = useContext(EvidenceContext);
  if (!value) throw new Error('Evidence session is missing.');
  return value;
}
