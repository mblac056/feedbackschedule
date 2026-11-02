import { createContext } from 'react';

export interface JudgeContextType {
  selectedJudge: string | null;
  setSelectedJudge: (judge: string | null) => void;
}

export const JudgeContext = createContext<JudgeContextType | undefined>(undefined);
