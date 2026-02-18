import { getSessionDurationSlots } from "../config/timeConfig";
import type { SessionBlock, Judge, Entrant} from "../types";
import { getEntrants } from "./localStorage";
import type { SessionSettings } from "../config/timeConfig";


export const populateGrid = (
  allSessionBlocks: SessionBlock[],
  judges: Judge[],
  onSessionBlockUpdate: (sessionBlock: SessionBlock) => void,
  sessionSettings?: SessionSettings
): Judge[] => {
  // First, clear all scheduled sessions to avoid conflicts
  allSessionBlocks.forEach(block => {
    if (block.isScheduled) {
      const clearedBlock: SessionBlock = {
        ...block,
        isScheduled: false,
        startRowIndex: undefined,
        endRowIndex: undefined,
        judgeId: undefined
      };
      onSessionBlockUpdate(clearedBlock);
    }
  });
  
  //Fetch Entrants, filtered to only include entrants that have Session Blocks from Blocks
  const entrants = getEntrants().filter(entrant => allSessionBlocks.some(block => block.entrantId === entrant.id));

  // Count the session blocks of each type
  const threeX10Count = allSessionBlocks.filter(block => block.type === '3x10').length;
  const threeX20Count = allSessionBlocks.filter(block => block.type === '3x20').length;
  const oneXLongCount = allSessionBlocks.filter(block => block.type === '1xLong').length;

  const [judgeNumberToJudge, groupNumberToGroup, judgeSchedules] = createMatrix(
    threeX10Count,
    threeX20Count,
    oneXLongCount,
    getSessionDurationSlots('3x10', sessionSettings),
    getSessionDurationSlots('3x20', sessionSettings),
    getSessionDurationSlots('1xLong', sessionSettings),
    judges,
    entrants,
    allSessionBlocks
  );
  let assignments = assignSessionBlocksToGrid(judgeNumberToJudge, groupNumberToGroup, judgeSchedules, allSessionBlocks, sessionSettings);

  if (sessionSettings?.moving === 'judges' && assignments.length > 0) {
    assignments = applyRoomBuffer(assignments, entrants);
  }

  assignments.forEach(block => onSessionBlockUpdate(block));
  console.log(`✓ Assigned ${assignments.length} session blocks to grid`);

  return reorderJudgesByPods(judgeNumberToJudge, judges.length);
};

const assignSessionBlocksToGrid = (
  judgeNumberToJudge: Map<number, Judge>,
  groupNumberToGroup: Map<number, Entrant>,
  judgeSchedules: number[][],
  allSessionBlocks: SessionBlock[],
  sessionSettings?: SessionSettings
): SessionBlock[] => {
  const sessionBlocksByEntrant = new Map<string, SessionBlock[]>();
  allSessionBlocks.forEach(block => {
    if (!sessionBlocksByEntrant.has(block.entrantId)) {
      sessionBlocksByEntrant.set(block.entrantId, []);
    }
    sessionBlocksByEntrant.get(block.entrantId)!.push(block);
  });

  const assignedBlocks = new Set<SessionBlock>();
  const result: SessionBlock[] = [];

  for (let judgeIndex = 0; judgeIndex < judgeSchedules.length; judgeIndex++) {
    const judgeSchedule = judgeSchedules[judgeIndex];
    const judgeNumber = judgeIndex + 1;
    const judge = judgeNumberToJudge.get(judgeNumber);

    if (!judge) continue;

    const groupFirstOccurrence = new Map<number, number>();
    for (let slotIndex = 0; slotIndex < judgeSchedule.length; slotIndex++) {
      const groupNumber = judgeSchedule[slotIndex];
      if (groupNumber !== 0 && !groupFirstOccurrence.has(groupNumber)) {
        groupFirstOccurrence.set(groupNumber, slotIndex);
      }
    }

    for (const [groupNumber, startRowIndex] of groupFirstOccurrence) {
      const group = groupNumberToGroup.get(groupNumber);
      if (!group) continue;

      const groupBlocks = sessionBlocksByEntrant.get(group.id) || [];
      const unassignedBlock = groupBlocks.find(block => !assignedBlocks.has(block));
      if (!unassignedBlock) continue;

      const durationSlots = getSessionDurationSlots(unassignedBlock.type, sessionSettings);
      const endRowIndex = startRowIndex + durationSlots - 1;

      const updatedBlock: SessionBlock = {
        ...unassignedBlock,
        isScheduled: true,
        startRowIndex,
        endRowIndex,
        judgeId: judge.id,
      };
      result.push(updatedBlock);
      assignedBlocks.add(unassignedBlock);
    }
  }

  return result;
};

/** 10-minute buffer in slots (2 x 5-min slots). */
const ROOM_BUFFER_SLOTS = 2;

/**
 * When moving === 'judges', same room can host different groups. Only add a 10-minute buffer
 * when the room is actually changing from one group to another at that time (sessions
 * back-to-back with no gap). Do not add buffer between every session in the same room.
 */
function applyRoomBuffer(assignments: SessionBlock[], entrants: Entrant[]): SessionBlock[] {
  const entrantById = new Map(entrants.map(e => [e.id, e]));
  const roomToSessions = new Map<string, SessionBlock[]>();

  for (const block of assignments) {
    const entrant = entrantById.get(block.entrantId);
    const room = (entrant?.roomNumber ?? '').trim() || null;
    if (room == null) continue;
    if (!roomToSessions.has(room)) roomToSessions.set(room, []);
    roomToSessions.get(room)!.push(block);
  }

  let changed = true;
  const mutable = assignments.map(b => ({ ...b }));

  while (changed) {
    changed = false;
    for (const [, roomBlocks] of roomToSessions) {
      if (roomBlocks.length < 2) continue;
      const byStart = [...roomBlocks].sort(
        (a, b) => (mutable.find(m => m.id === a.id)!.startRowIndex ?? 0) - (mutable.find(m => m.id === b.id)!.startRowIndex ?? 0)
      );
      for (let i = 0; i < byStart.length - 1; i++) {
        const earlier = mutable.find(m => m.id === byStart[i].id)!;
        const later = mutable.find(m => m.id === byStart[i + 1].id)!;
        // Only add buffer when the room is changing from one group to a different group.
        // Same group (e.g. Circle City Sound) having multiple sessions in the same room needs no buffer.
        if (earlier.entrantId === later.entrantId) continue;
        const firstSlotAfterEarlier = (earlier.endRowIndex ?? earlier.startRowIndex!) + 1;
        const laterStart = later.startRowIndex ?? 0;
        // Only when different group takes over and sessions are back-to-back (no gap)
        if (laterStart <= firstSlotAfterEarlier) {
          const needStart = firstSlotAfterEarlier + ROOM_BUFFER_SLOTS;
          const delta = needStart - laterStart;
          for (const m of mutable) {
            const s = m.startRowIndex ?? -1;
            if (s >= laterStart) {
              m.startRowIndex = s + delta;
              m.endRowIndex = (m.endRowIndex ?? s) + delta;
            }
          }
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return mutable;
}

const CATEGORY_ORDER: Record<'SNG' | 'MUS' | 'PER', number> = {
  SNG: 0,
  MUS: 1,
  PER: 2
};

const reorderJudgesByPods = (judgeNumberToJudge: Map<number, Judge>, totalJudges: number): Judge[] => {
  const reorderedJudges: Judge[] = [];
  const numPods = Math.floor(totalJudges / 3);

  for (let podIndex = 0; podIndex < numPods; podIndex++) {
    const baseJudgeNumber = podIndex * 3;
    const podJudges = [1, 2, 3]
      .map(offset => judgeNumberToJudge.get(baseJudgeNumber + offset))
      .filter((judge): judge is Judge => Boolean(judge));

    podJudges.sort((a, b) => {
      const aRank = a.category ? CATEGORY_ORDER[a.category] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      const bRank = b.category ? CATEGORY_ORDER[b.category] ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
      return aRank - bRank;
    });

    reorderedJudges.push(...podJudges);
  }

  const remainingStart = numPods * 3 + 1;
  for (let judgeNumber = remainingStart; judgeNumber <= totalJudges; judgeNumber++) {
    const judge = judgeNumberToJudge.get(judgeNumber);
    if (judge) {
      reorderedJudges.push(judge);
    }
  }

  // Ensure all judges from the map are included even if judge numbering exceeds totalJudges
  const includedJudgeIds = new Set(reorderedJudges.map(judge => judge.id));
  judgeNumberToJudge.forEach(judge => {
    if (!includedJudgeIds.has(judge.id)) {
      reorderedJudges.push(judge);
    }
  });

  return reorderedJudges;
};


const createMatrix = (threeX10Count: number, threeX20Count: number, oneXLongCount: number, threeX10Height: number, threeX20Height: number, oneXLongHeight: number, judges: Judge[], entrants: Entrant[], allSessionBlocks: SessionBlock[]): [Map<number, Judge>, Map<number, Entrant>, number[][]] => {
  console.log('=== GENERATING SCHEDULE ===');
  console.log(`Sessions: ${threeX10Count / 3}×3x10, ${threeX20Count / 3}×3x20, ${oneXLongCount}×1xLong | Judges: ${judges.length}`);

  // Step 1: Analyze and create pods
  const pods = createPods(threeX10Count, threeX20Count);
  
  // Step 2: Generate schedule matrix
  const judgeSchedules = generateScheduleMatrix(pods, judges, threeX10Height, threeX20Height, oneXLongCount, oneXLongHeight);
  
  // Step 3: Assign judges and groups
  const judgeGroupAssignments = getJudgeGroupAssignments(judgeSchedules);
  const groupTypes = getGroupTypes(pods, oneXLongCount);

  const [judgeNumberToJudge, groupNumberToGroup] = assignGroupsAndJudges(judgeGroupAssignments, groupTypes, judges, entrants, allSessionBlocks);

  return [judgeNumberToJudge, groupNumberToGroup, judgeSchedules];
};


// Step 1: Pod Analysis and Creation
const createPods = (threeX10Count: number, threeX20Count: number): Array<string>[] => {
  // Convert session counts to group counts
  const threeX10Groups = threeX10Count / 3;
  const threeX20Groups = threeX20Count / 3;
  
  const podTypes: Array<string>[] = [];

  const totalGroups = threeX10Groups + threeX20Groups;
  
  // Create pods prioritizing 3s, then 4s+3s, then 4s+3s+2s
  let remaining3x10 = threeX10Groups;
  let remaining3x20 = threeX20Groups;
  
  // Strategy 1: Try to make all pods of 3
  if (totalGroups % 3 === 0) {
    // Create homogeneous pods of 3 first
    while (remaining3x10 >= 3) {
            podTypes.push(['3x10', '3x10', '3x10']);
      remaining3x10 -= 3;
        }
    while (remaining3x20 >= 3) {
            podTypes.push(['3x20', '3x20', '3x20']);
      remaining3x20 -= 3;
    }
    
    // Create mixed pods of 3 with remaining groups
    const totalRemaining = remaining3x10 + remaining3x20;
    if (totalRemaining === 3) {
      if (remaining3x10 === 1 && remaining3x20 === 2) {
            podTypes.push(['3x10', '3x20', '3x20']);
        remaining3x10 = 0;
        remaining3x20 = 0;
      } else if (remaining3x10 === 2 && remaining3x20 === 1) {
            podTypes.push(['3x10', '3x10', '3x20']);
        remaining3x10 = 0;
        remaining3x20 = 0;
      }
    }
  }
  // Strategy 2: If we can't do all 3s, try 4s + 3s, but avoid leaving single groups
  else if (totalGroups >= 4) {
    // Check if we would leave a single group with the current approach
    const wouldLeaveSingle = (remaining3x10 % 4 === 1) || (remaining3x20 % 4 === 1);
    
    if (wouldLeaveSingle) {
      // Instead of 4+1, create 3+2 by taking one from a pod of 4
      // Create homogeneous pods of 3 first (this will leave 2s instead of 1s)
      while (remaining3x10 >= 3) {
        podTypes.push(['3x10', '3x10', '3x10']);
        remaining3x10 -= 3;
      }
      while (remaining3x20 >= 3) {
        podTypes.push(['3x20', '3x20', '3x20']);
        remaining3x20 -= 3;
      }
    } else {
      // Create homogeneous pods of 4 first
      while (remaining3x10 >= 4) {
        podTypes.push(['3x10', '3x10', '3x10', '3x10']);
        remaining3x10 -= 4;
      }
      while (remaining3x20 >= 4) {
        podTypes.push(['3x20', '3x20', '3x20', '3x20']);
        remaining3x20 -= 4;
      }
    }
    
    // Create homogeneous pods of 3 with remaining groups
    while (remaining3x10 >= 3) {
      podTypes.push(['3x10', '3x10', '3x10']);
      remaining3x10 -= 3;
    }
    while (remaining3x20 >= 3) {
      podTypes.push(['3x20', '3x20', '3x20']);
      remaining3x20 -= 3;
    }
    
    // Create mixed pods of 3 if we have exactly 3 remaining
    const totalRemaining = remaining3x10 + remaining3x20;
    if (totalRemaining === 3) {
      if (remaining3x10 === 1 && remaining3x20 === 2) {
        podTypes.push(['3x10', '3x20', '3x20']);
        remaining3x10 = 0;
        remaining3x20 = 0;
      } else if (remaining3x10 === 2 && remaining3x20 === 1) {
        podTypes.push(['3x10', '3x10', '3x20']);
        remaining3x10 = 0;
        remaining3x20 = 0;
      }
    }
    
    // Strategy 3: If still remaining groups, use pods of 2
    if (remaining3x10 >= 2) {
      podTypes.push(['3x10', '3x10']);
      remaining3x10 -= 2;
    }
    if (remaining3x20 >= 2) {
      podTypes.push(['3x20', '3x20']);
      remaining3x20 -= 2;
    }
    
    // Handle any single remaining groups (create mixed pod of 2)
    if (remaining3x10 === 1 && remaining3x20 === 1) {
      podTypes.push(['3x10', '3x20']);
      remaining3x10 = 0;
      remaining3x20 = 0;
    }
  }
  
  // Last resort: Handle single remaining groups (they just rotate through judges)
  if (remaining3x10 === 1) {
    podTypes.push(['3x10']);
    remaining3x10 = 0;
  }
  if (remaining3x20 === 1) {
    podTypes.push(['3x20']);
    remaining3x20 = 0;
  }
  
  // Log any unassigned groups (shouldn't happen with this logic)
  if (remaining3x10 > 0 || remaining3x20 > 0) {
    console.warn(`Unassigned groups: ${remaining3x10} 3x10, ${remaining3x20} 3x20`);
  }
  return podTypes;
};

// Step 2: Schedule Generation
const generateScheduleMatrix = (pods: Array<string>[], judges: Judge[], threeX10Height: number, threeX20Height: number, oneXLongCount: number, oneXLongHeight: number): number[][] => {
  let lastGroupIndex = 0;
  
  // Initialize judge schedules - each judge gets an empty array
  const judgeSchedules: number[][] = [];
  for (let i = 0; i < judges.length; i++) {
    judgeSchedules.push([]);
  }
  
  // Assign each pod to a set of judges, rotating through the judge sets
  for (let i = 0; i < pods.length; i++) {
    const pod = pods[i];
    const judgeAssignments = assignPodsToJudges(pod, threeX10Height, threeX20Height);
    
    // Renumber the groups in this pod's assignments
    lastGroupIndex = renumberGroups(judgeAssignments, lastGroupIndex);
    
    // Find the next available set of 3 judges (complete judge sets only)
    const judgeSlotCounts = judgeSchedules.map(schedule => schedule.length);
    
    // Group judges into sets of 3 and find the set with the lowest total slots
    const judgeSets: number[][] = [];
    for (let setIndex = 0; setIndex < Math.floor(judges.length / 3); setIndex++) {
      const judgeSet = [setIndex * 3, setIndex * 3 + 1, setIndex * 3 + 2];
      judgeSets.push(judgeSet);
    }
    
    // Find the judge set with the lowest total slots
    let bestJudgeSet = judgeSets[0];
    let lowestTotalSlots = judgeSets[0].reduce((sum, judgeIndex) => sum + judgeSlotCounts[judgeIndex], 0);
    
    for (let setIndex = 1; setIndex < judgeSets.length; setIndex++) {
      const totalSlots = judgeSets[setIndex].reduce((sum, judgeIndex) => sum + judgeSlotCounts[judgeIndex], 0);
      if (totalSlots < lowestTotalSlots) {
        lowestTotalSlots = totalSlots;
        bestJudgeSet = judgeSets[setIndex];
      }
    }
    
    // Assign the 3 pod judge arrays to the selected judge set
    for (let j = 0; j < 3; j++) {
      const targetJudgeIndex = bestJudgeSet[j];
      judgeSchedules[targetJudgeIndex] = judgeSchedules[targetJudgeIndex].concat(judgeAssignments[j]);
    }
  }

  // Clear out trailing bye slots before assigning the 1xLong groups
  clearTrailingByeSlots(judgeSchedules);

  // Assign the 1xLong groups to the judges with the most available slots
  assign1xLongGroups(judgeSchedules, oneXLongCount, oneXLongHeight, lastGroupIndex + 1);
  
  return judgeSchedules;
};

const clearTrailingByeSlots = (judgeSchedules: number[][]) => {
  let removedAny = false;
  
  // Check if any judge has a bye slot at the end
  for (let i = 0; i < judgeSchedules.length; i++) {
    const judgeSchedule = judgeSchedules[i];
    if (judgeSchedule.length > 0 && judgeSchedule[judgeSchedule.length - 1] === 0) {
      judgeSchedule.splice(judgeSchedule.length - 1, 1);
      removedAny = true;
    }
  }
  
  // If we removed any bye slots, recursively call again
  if (removedAny) {
    clearTrailingByeSlots(judgeSchedules);
  }
}

const assign1xLongGroups = (judgeSchedules: number[][], oneXLongCount: number, oneXLongHeight: number, startGroupNumber: number) => {
  if (oneXLongCount === 0) return;
  
  for (let i = 0; i < oneXLongCount; i++) {
    // Find the judge with the fewest slots assigned
    const judgeSlotCounts = judgeSchedules.map(schedule => schedule.length);
    const minSlots = Math.min(...judgeSlotCounts);
    const judgeWithFewestSlots = judgeSlotCounts.indexOf(minSlots);
    
    const groupNumber = startGroupNumber + i;
    
    // Assign the 1xLong session to this judge (add the full duration)
    for (let slot = 0; slot < oneXLongHeight; slot++) {
      judgeSchedules[judgeWithFewestSlots].push(groupNumber);
    }
  }
}

const renumberGroups = (judgeAssignments: number[][], lastGroupIndex: number): number => {
  // Find the highest group number in this pod to determine how many groups we have
  let maxGroupNumber = 0;
  for (let i = 0; i < judgeAssignments.length; i++) {
    for (let j = 0; j < judgeAssignments[i].length; j++) {
      if (judgeAssignments[i][j] > maxGroupNumber) {
        maxGroupNumber = judgeAssignments[i][j];
      }
    }
  }
  
  // Renumber the groups
  for (let i = 0; i < judgeAssignments.length; i++) {
    for (let j = 0; j < judgeAssignments[i].length; j++) {
      // Only renumber non-zero values (0s are byes and should stay 0)
      if (judgeAssignments[i][j] !== 0) {
        judgeAssignments[i][j] += lastGroupIndex;
      }
    }
  }
  
  // Return the next available group number (lastGroupIndex + number of groups in this pod)
  return lastGroupIndex + maxGroupNumber;
}

const assignPodsToJudges = (pod: string[], threeX10Height: number, threeX20Height: number): number[][] => {
  
  // Create rotation matrix based on pod size
  const numGroups = pod.length;
  const judgeAssignments: number[][] = [[],[],[]];

  // Check if the pod is homogeneous or hybrid
  const isHomogeneous = pod.every(group => group === pod[0]);

  // Determine the height for this pod (use the maximum height for hybrid pods)
  const podHeight = isHomogeneous 
    ? (pod[0] === '3x10' ? threeX10Height : threeX20Height)
    : Math.max(threeX10Height, threeX20Height);

  if (numGroups === 1) {
    // For 1 group, rotate through all judges sequentially
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(1); // Group 1 sees judge 1
      judgeAssignments[1].push(0); // Judge 2 has a bye
      judgeAssignments[2].push(0); // Judge 3 has a bye
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(0); // Judge 1 has a bye
      judgeAssignments[1].push(1); // Group 1 sees judge 2
      judgeAssignments[2].push(0); // Judge 3 has a bye
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(0); // Judge 1 has a bye
      judgeAssignments[1].push(0); // Judge 2 has a bye
      judgeAssignments[2].push(1); // Group 1 sees judge 3
    }
  } else if (numGroups === 2) {
    // For 2 groups, simple rotation
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(1); // Group 1 sees judge 1
      judgeAssignments[1].push(2); // Group 2 sees judge 2
      judgeAssignments[2].push(0); // Judge 3 has a bye
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(0); // Judge 1 has a bye
      judgeAssignments[1].push(1); // Group 1 sees judge 2
      judgeAssignments[2].push(2); // Group 2 sees judge 3
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(2); // Group 2 sees judge 1
      judgeAssignments[1].push(0); // Judge 2 has a bye
      judgeAssignments[2].push(1); // Group 1 sees judge 3
    }
  } else if (numGroups === 3) {
    // For 3 groups, standard rotation
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(1); // Group 1 sees judge 1
      judgeAssignments[1].push(2); // Group 2 sees judge 2
      judgeAssignments[2].push(3); // Group 3 sees judge 3
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(2); // Group 1 sees judge 2
      judgeAssignments[1].push(3); // Group 2 sees judge 3
      judgeAssignments[2].push(1); // Group 3 sees judge 1
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(3); // Group 1 sees judge 3
      judgeAssignments[1].push(1); // Group 2 sees judge 1
      judgeAssignments[2].push(2); // Group 3 sees judge 2
    }
  } else if (numGroups === 4) {
    // For 4 groups, modified rotation with byes
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(1); // Group 1 sees judge 1
      judgeAssignments[1].push(2); // Group 2 sees judge 2
      judgeAssignments[2].push(3); // Group 3 sees judge 3
      // Group 4 has bye
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(4); // Group 4 sees judge 1
      judgeAssignments[1].push(1); // Group 1 sees judge 2
      // Group 3 has bye
      judgeAssignments[2].push(2); // Group 2 sees judge 3
    }
    for (let slot = 0; slot < podHeight; slot++) {
      judgeAssignments[0].push(3); // Group 3 sees judge 1
      // Group 2 has bye
      judgeAssignments[1].push(4); // Group 4 sees judge 2
      judgeAssignments[2].push(1); // Group 1 sees judge 3
    }
    for (let slot = 0; slot < podHeight; slot++) {
      // Group 1 has bye
      judgeAssignments[0].push(2); // Group 2 sees judge 1
      judgeAssignments[1].push(3); // Group 3 sees judge 2
      judgeAssignments[2].push(4); // Group 4 sees judge 3
    }
  }

  if (!isHomogeneous) {
    // Figure out which groups are 3X10 (by index)
    const threeX10GroupIndices = pod.map((group, index) => group === '3x10' ? index + 1 : null).filter(i => i !== null);
    // Calculate bye slots for 3x10 groups
    const byeSlots = threeX20Height - threeX10Height;
    
    // Go through each judge's assignments and clear slots where 3x10 groups appear
    for (let judgeIndex = 0; judgeIndex < judgeAssignments.length; judgeIndex++) {
      const judgeArray = judgeAssignments[judgeIndex];
      const rotationBlockSize = threeX20Height; // Each rotation is threeX20Height slots
      const numRotations = Math.floor(judgeArray.length / rotationBlockSize);
      
      for (let rotation = 0; rotation < numRotations; rotation++) {
        const rotationStart = rotation * rotationBlockSize;
        const rotationEnd = (rotation + 1) * rotationBlockSize;
        
        // Find where 3x10 groups appear in this rotation block
        for (let slot = rotationStart; slot < rotationEnd; slot++) {
          const groupNumber = judgeArray[slot];
          if (threeX10GroupIndices.includes(groupNumber)) {
            // This judge is evaluating a 3x10 group, clear the last byeSlots of this rotation
            for (let byeSlot = rotationEnd - byeSlots; byeSlot < rotationEnd; byeSlot++) {
              if (byeSlot < judgeArray.length) {
                judgeArray[byeSlot] = 0; // Set to bye
              }
            }
            break; // Only clear once per rotation block
          }
        }
        }
      }
    }
  
  return judgeAssignments;
}

// Helper functions for extracting assignment data
const getJudgeGroupAssignments = (judgeSchedules: number[][]): Map<number, Set<number>> => {
  const judgeGroups = new Map<number, Set<number>>();
  
  for (let judgeIndex = 0; judgeIndex < judgeSchedules.length; judgeIndex++) {
    const groups = new Set<number>();
    const schedule = judgeSchedules[judgeIndex];
    
    for (const groupNumber of schedule) {
      if (groupNumber !== 0) { // Skip byes
        groups.add(groupNumber);
      }
    }
    
    judgeGroups.set(judgeIndex + 1, groups); // Judge numbers are 1-based
  }
  
  return judgeGroups;
};

const getGroupTypes = (pods: Array<string>[], oneXLongCount: number): Map<number, string> => {
  const groupTypes = new Map<number, string>();
  let groupNumber = 1;
  
  // Process pods to get group types
  for (const pod of pods) {
    for (const groupType of pod) {
      groupTypes.set(groupNumber, groupType);
      groupNumber++;
    }
  }
  
  // Add 1xLong groups
  for (let i = 0; i < oneXLongCount; i++) {
    groupTypes.set(groupNumber, '1xLong');
    groupNumber++;
  }
  
  return groupTypes;
};

const assignGroupsAndJudges = (judgeGroups: Map<number, Set<number>>, groupTypes: Map<number, string>, judges: Judge[], groups: Entrant[], allSessionBlocks: SessionBlock[]): [Map<number, Judge>, Map<number, Entrant>] => {
  const judgeStats = judgePopularity(judges, groups);

  // Group judges by category
  const judgesByCategory = {
    MUS: judges.filter(j => j.category === 'MUS'),
    SNG: judges.filter(j => j.category === 'SNG'),
    PER: judges.filter(j => j.category === 'PER')
  };
  
  // Create mappings
  const judgeNumberToJudge = new Map<number, Judge>();
  const groupNumberToGroup = new Map<number, Entrant>();
  
  // Track which judges have been assigned
  const assignedJudges = new Set<Judge>();
  
  const numPods = Math.floor(judges.length / 3);
  
  // Helper function to get first choice count for a judge
  const getFirstChoiceCount = (judge: Judge): number => {
    const stats = judgeStats.get(judge.id);
    return stats ? stats.first : 0;
  };
  
  // Helper function to calculate remaining first choices and target
  const calculateTarget = (remainingPods: number): number => {
    const remainingFirstChoices = judges
      .filter(j => !assignedJudges.has(j))
      .reduce((sum, judge) => sum + getFirstChoiceCount(judge), 0);
    return remainingPods > 0 ? remainingFirstChoices / remainingPods : 0;
  };
  
  // Helper function to find best pod assignment that balances first choices
  const findBestPodAssignment = (targetTotal: number): (Judge | null)[] => {
    const availableMUS = judgesByCategory.MUS.filter(j => !assignedJudges.has(j));
    const availableSNG = judgesByCategory.SNG.filter(j => !assignedJudges.has(j));
    const availablePER = judgesByCategory.PER.filter(j => !assignedJudges.has(j));
    
    let bestAssignment: (Judge | null)[] = [null, null, null];
    let bestScore = Infinity;
    
    // Try all combinations of available judges
    for (const musJudge of availableMUS) {
      for (const sngJudge of availableSNG) {
        for (const perJudge of availablePER) {
          const podTotal = getFirstChoiceCount(musJudge) + getFirstChoiceCount(sngJudge) + getFirstChoiceCount(perJudge);
          const score = Math.abs(podTotal - targetTotal);
          
          if (score < bestScore) {
            bestScore = score;
            bestAssignment = [musJudge, sngJudge, perJudge];
          }
        }
      }
    }
    
    // If we couldn't find a complete assignment, try with missing categories
    if (bestAssignment[0] === null && bestAssignment[1] === null && bestAssignment[2] === null) {
      // Fallback: assign any available judges
      if (availableMUS.length > 0) bestAssignment[0] = availableMUS[0];
      if (availableSNG.length > 0) bestAssignment[1] = availableSNG[0];
      if (availablePER.length > 0) bestAssignment[2] = availablePER[0];
    }
    
    return bestAssignment;
  };
  
  // For each pod, assign judges to balance first choices
  for (let podIndex = 0; podIndex < numPods; podIndex++) {
    const podJudges = [podIndex * 3 + 1, podIndex * 3 + 2, podIndex * 3 + 3]; // Judge numbers 1,2,3 or 4,5,6, etc.
    
    // Calculate target based on remaining pods (dynamic adjustment)
    const remainingPods = numPods - podIndex;
    const targetTotal = calculateTarget(remainingPods);
    
    // Find the best assignment for this pod
    const podAssignments = findBestPodAssignment(targetTotal);
    
    // Assign the judges
    for (let i = 0; i < 3; i++) {
      if (podAssignments[i]) {
        const judge = podAssignments[i]!;
        assignedJudges.add(judge);
        judgeNumberToJudge.set(podJudges[i], judge);
      }
    }
    
    // Fill in any remaining slots with unassigned judges
    const unassignedJudges = judges.filter(j => !assignedJudges.has(j));
    for (let i = 0; i < 3; i++) {
      if (podAssignments[i] === null && unassignedJudges.length > 0) {
        const judge = unassignedJudges.shift()!;
        podAssignments[i] = judge;
        assignedJudges.add(judge);
        judgeNumberToJudge.set(podJudges[i], judge);
      }
    }
  }
  
  // Assign remaining judges to any leftover judge numbers
  const remainingJudges = judges.filter(j => !assignedJudges.has(j));
  let remainingJudgeNumber = numPods * 3 + 1;
  for (const judge of remainingJudges) {
    judgeNumberToJudge.set(remainingJudgeNumber, judge);
    remainingJudgeNumber++;
  }
  
  // Assign groups to group numbers based on their session types with preference optimization
  // Get session types from allSessionBlocks
  const entrantSessionTypes = new Map<string, string>();
  allSessionBlocks.forEach(block => {
    if (!entrantSessionTypes.has(block.entrantId)) {
      entrantSessionTypes.set(block.entrantId, block.type);
    }
  });
  
  // Track which groups have been assigned
  const assignedGroups = new Set<Entrant>();
  const findJudgeNumberById = (judgeId: string): number | null => {
    for (const [judgeNum, judge] of judgeNumberToJudge) {
      if (judge.id === judgeId) {
        return judgeNum;
      }
    }
    return null;
  };

  const getPodIndexForJudgeNumber = (judgeNumber: number): number => Math.floor((judgeNumber - 1) / 3);

  const getJudgeNumbersForPod = (podIndex: number): number[] => {
    const judgeNumbers: number[] = [];
    for (let offset = 0; offset < 3; offset++) {
      const judgeNumber = podIndex * 3 + offset + 1;
      if (judgeNumberToJudge.has(judgeNumber)) {
        judgeNumbers.push(judgeNumber);
      }
    }
    return judgeNumbers;
  };

  const isPodUnlocked = (podIndex: number): boolean => {
    if (podIndex < 0 || podIndex >= numPods) {
      return false;
    }

    const judgeNumbers = getJudgeNumbersForPod(podIndex);
    if (judgeNumbers.length === 0) {
      return false;
    }

    return judgeNumbers.every(judgeNumber => {
      const assignedGroupNumbers = judgeGroups.get(judgeNumber);
      if (!assignedGroupNumbers) {
        return true;
      }
      for (const groupNumber of assignedGroupNumbers) {
        if (groupNumberToGroup.has(groupNumber)) {
          return false;
        }
      }
      return true;
    });
  };

  const swapPods = (podIndexA: number, podIndexB: number): boolean => {
    if (podIndexA === podIndexB) {
      return false;
    }

    if (!isPodUnlocked(podIndexA) || !isPodUnlocked(podIndexB)) {
      return false;
    }

    for (let offset = 0; offset < 3; offset++) {
      const judgeNumberA = podIndexA * 3 + offset + 1;
      const judgeNumberB = podIndexB * 3 + offset + 1;
      const judgeA = judgeNumberToJudge.get(judgeNumberA);
      const judgeB = judgeNumberToJudge.get(judgeNumberB);

      if (judgeA) {
        judgeNumberToJudge.set(judgeNumberB, judgeA);
      } else {
        judgeNumberToJudge.delete(judgeNumberB);
      }

      if (judgeB) {
        judgeNumberToJudge.set(judgeNumberA, judgeB);
      } else {
        judgeNumberToJudge.delete(judgeNumberA);
      }
    }

    console.log(`↔ Swapped pods ${podIndexA + 1} and ${podIndexB + 1} to honor first preference`);
    return true;
  };
  
  // Helper function to check if a group can be assigned to a judge (no conflicts)
  const canAssignGroupToJudge = (group: Entrant, judgeNumber: number): boolean => {
    if (!group.groupsToAvoid || !Array.isArray(group.groupsToAvoid)) return true;
    
    const groupsToAvoid = group.groupsToAvoid;
    const judgeGroupNumbers = judgeGroups.get(judgeNumber) || new Set();
    
    // Check if any groups this judge evaluates are in the avoid list
    for (const groupNumber of judgeGroupNumbers) {
      const otherGroup = groupNumberToGroup.get(groupNumber);
      if (otherGroup && groupsToAvoid.includes(otherGroup.id)) {
        return false; // Conflict found
      }
    }
    
    return true; // No conflicts
  };
  
  // Helper function to get evaluating judges for a groupNumber
  const getEvaluatingJudges = (groupNumber: number): Set<number> => {
    const evaluatingJudges = new Set<number>();
    for (const [judgeNum, judgeGroupNumbers] of judgeGroups) {
      if (judgeGroupNumbers.has(groupNumber)) {
        evaluatingJudges.add(judgeNum);
      }
    }
    return evaluatingJudges;
  };
  
  // Helper function to find the best available groupNumber for a group based on preferences
  const findBestGroupNumberForGroup = (group: Entrant): { groupNumber: number; judgeNumber: number; reason: string } | null => {
    const groupSessionType = entrantSessionTypes.get(group.id);
    if (!groupSessionType) return null;
    
    // Find all groupNumbers of this session type that haven't been assigned yet
    const availableGroupNumbers: number[] = [];
    for (const [groupNumber, sessionType] of groupTypes) {
      if (sessionType === groupSessionType && !groupNumberToGroup.has(groupNumber)) {
        availableGroupNumbers.push(groupNumber);
      }
    }
    
    if (availableGroupNumbers.length === 0) return null;
    
    // PRIORITY 1: Find all groupNumbers where first preferred judge is available
    if (group.judgePreference1) {
      for (const groupNumber of availableGroupNumbers) {
        let firstPreferenceJudgeNum = findJudgeNumberById(group.judgePreference1);
        if (firstPreferenceJudgeNum === null) {
          break;
        }

        const evaluatingJudges = getEvaluatingJudges(groupNumber);
        if (evaluatingJudges.has(firstPreferenceJudgeNum)) {
          const hasConflicts = group.groupsToAvoid && Array.isArray(group.groupsToAvoid) && 
            Array.from(judgeGroups.get(firstPreferenceJudgeNum) || [])
              .filter(gn => gn !== groupNumber)
              .some(gn => {
                const otherGroup = groupNumberToGroup.get(gn);
                return otherGroup && group.groupsToAvoid!.includes(otherGroup.id);
              });
          const reason = hasConflicts ? '1st preference (conflicts ignored)' : '1st preference';
          return { groupNumber, judgeNumber: firstPreferenceJudgeNum, reason };
        }

        if (evaluatingJudges.size === 0) {
          continue;
        }

        const targetJudgeNumber = Array.from(evaluatingJudges)[0];
        const preferredPodIndex = getPodIndexForJudgeNumber(firstPreferenceJudgeNum);
        const targetPodIndex = getPodIndexForJudgeNumber(targetJudgeNumber);

        if (
          preferredPodIndex < numPods &&
          targetPodIndex < numPods &&
          swapPods(preferredPodIndex, targetPodIndex)
        ) {
          firstPreferenceJudgeNum = findJudgeNumberById(group.judgePreference1);
          const updatedEvaluatingJudges = getEvaluatingJudges(groupNumber);
          if (firstPreferenceJudgeNum !== null && updatedEvaluatingJudges.has(firstPreferenceJudgeNum)) {
            const hasConflicts = group.groupsToAvoid && Array.isArray(group.groupsToAvoid) && 
              Array.from(judgeGroups.get(firstPreferenceJudgeNum) || [])
                .filter(gn => gn !== groupNumber)
                .some(gn => {
                  const otherGroup = groupNumberToGroup.get(gn);
                  return otherGroup && group.groupsToAvoid!.includes(otherGroup.id);
                });
            const reason = hasConflicts
              ? '1st preference (conflicts ignored after pod reassignment)'
              : '1st preference (pod reassigned)';
            return { groupNumber, judgeNumber: firstPreferenceJudgeNum, reason };
          }
        }
      }
    }
    
    // PRIORITY 2: Find groupNumbers where second preferred judge is available (with conflict checking)
    if (group.judgePreference2) {
      let secondPreferenceJudgeNum: number | null = null;
      for (const [judgeNum, judge] of judgeNumberToJudge) {
        if (judge.id === group.judgePreference2) {
          secondPreferenceJudgeNum = judgeNum;
          break;
        }
      }
      
      if (secondPreferenceJudgeNum !== null) {
        for (const groupNumber of availableGroupNumbers) {
          const evaluatingJudges = getEvaluatingJudges(groupNumber);
          if (evaluatingJudges.has(secondPreferenceJudgeNum)) {
            if (canAssignGroupToJudge(group, secondPreferenceJudgeNum)) {
              return { groupNumber, judgeNumber: secondPreferenceJudgeNum, reason: '2nd preference' };
            }
          }
        }
      }
    }
    
    // PRIORITY 3: Find groupNumbers where third preferred judge is available (with conflict checking)
    if (group.judgePreference3) {
      let thirdPreferenceJudgeNum: number | null = null;
      for (const [judgeNum, judge] of judgeNumberToJudge) {
        if (judge.id === group.judgePreference3) {
          thirdPreferenceJudgeNum = judgeNum;
          break;
        }
      }
      
      if (thirdPreferenceJudgeNum !== null) {
        for (const groupNumber of availableGroupNumbers) {
          const evaluatingJudges = getEvaluatingJudges(groupNumber);
          if (evaluatingJudges.has(thirdPreferenceJudgeNum)) {
            if (canAssignGroupToJudge(group, thirdPreferenceJudgeNum)) {
              return { groupNumber, judgeNumber: thirdPreferenceJudgeNum, reason: '3rd preference' };
            }
          }
        }
      }
    }
    
    // PRIORITY 4: Find any groupNumber with any judge without conflicts
    for (const groupNumber of availableGroupNumbers) {
      const evaluatingJudges = getEvaluatingJudges(groupNumber);
      for (const judgeNum of evaluatingJudges) {
        if (canAssignGroupToJudge(group, judgeNum)) {
          return { groupNumber, judgeNumber: judgeNum, reason: 'fallback (no conflicts)' };
        }
      }
    }
    
    // PRIORITY 5: Final fallback - use first available groupNumber even with conflicts
    if (availableGroupNumbers.length > 0) {
      const fallbackGroupNumber = availableGroupNumbers[0];
      const evaluatingJudges = getEvaluatingJudges(fallbackGroupNumber);
      const firstJudge = evaluatingJudges.size > 0 ? Array.from(evaluatingJudges)[0] : 0;
      return { groupNumber: fallbackGroupNumber, judgeNumber: firstJudge, reason: 'fallback (conflicts unavoidable)' };
    }
    
    return null;
  };
  
  // Assign groups one by one in order, checking their preferences first
  const preferenceCounts = { first: 0, second: 0, third: 0, fallback: 0 };
  for (const group of groups) {
    if (assignedGroups.has(group)) continue;
    
    const assignment = findBestGroupNumberForGroup(group);
    if (assignment) {
      groupNumberToGroup.set(assignment.groupNumber, group);
      assignedGroups.add(group);
      
      // Track preference fulfillment
      if (assignment.reason.includes('1st preference')) preferenceCounts.first++;
      else if (assignment.reason.includes('2nd preference')) preferenceCounts.second++;
      else if (assignment.reason.includes('3rd preference')) preferenceCounts.third++;
      else preferenceCounts.fallback++;
    } else {
      console.warn(`Could not assign group ${group.name} - no available group numbers for session type`);
    }
  }
  
  console.log(`✓ Assigned ${assignedGroups.size} groups: ${preferenceCounts.first} first, ${preferenceCounts.second} second, ${preferenceCounts.third} third, ${preferenceCounts.fallback} fallback`);
  
  return [judgeNumberToJudge, groupNumberToGroup];
}

const judgePopularity = (judges: Judge[], groups: Entrant[]): Map<string, { first: number; second: number; third: number; category: string }> => {
  console.log('=== JUDGE POPULARITY SUMMARY ===');
  
  // Create a map to track counts for each judge
  const judgeStats = new Map<string, { first: number; second: number; third: number; category: string }>();
  
  // Initialize stats for all judges
  for (const judge of judges) {
    judgeStats.set(judge.id, { first: 0, second: 0, third: 0, category: judge.category || 'Unknown' });
  }
  
  // Count preferences for each group
  for (const group of groups) {
    if (group.judgePreference1) {
      const stats = judgeStats.get(group.judgePreference1);
      if (stats) stats.first++;
    }
    if (group.judgePreference2) {
      const stats = judgeStats.get(group.judgePreference2);
      if (stats) stats.second++;
    }
    if (group.judgePreference3) {
      const stats = judgeStats.get(group.judgePreference3);
      if (stats) stats.third++;
    }
  }
  
  // Output summary for each judge
  for (const judge of judges) {
    const stats = judgeStats.get(judge.id);
    if (stats) {
      console.log(`  ${judge.name} (${stats.category}) - First: ${stats.first}, Second: ${stats.second}, Third: ${stats.third}`);
    }
  }
  
  return judgeStats;
}