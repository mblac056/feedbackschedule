import { useMemo, useState, type ReactNode } from 'react';
import { JudgeContext, type JudgeContextType } from './JudgeTypes';

interface JudgeProviderProps {
  children: ReactNode;
}

export function JudgeProvider({ children }: JudgeProviderProps) {
  const [selectedJudge, setSelectedJudge] = useState<string | null>(null);

  const value = useMemo<JudgeContextType>(
    () => ({
      selectedJudge,
      setSelectedJudge,
    }),
    [selectedJudge]
  );

  return (
    <JudgeContext.Provider value={value}>
      {children}
    </JudgeContext.Provider>
  );
}
