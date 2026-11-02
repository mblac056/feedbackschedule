import { useContext } from 'react';
import { JudgeContext } from './JudgeTypes';

export function useJudge() {
  const context = useContext(JudgeContext);
  if (context === undefined) {
    throw new Error('useJudge must be used within a JudgeProvider');
  }
  return context;
}
