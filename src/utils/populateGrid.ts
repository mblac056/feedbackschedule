import { getSessionDurationSlots } from "../config/timeConfig";
import type { SessionBlock, Judge, Entrant} from "../types";
import { getEntrants } from "./localStorage";

export const populateGrid = (allSessionBlocks: SessionBlock[], judges: Judge[], onSessionBlockUpdate: (sessionBlock: SessionBlock) => void) => {
  // First, clear all scheduled sessions to avoid conflicts
  console.log('=== CLEARING EXISTING SCHEDULE ===');
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
  console.log('Cleared all existing scheduled sessions');
  //Fetch Entrants, filtered to only include entrants that have Session Blocks from Blocks
  const entrants = getEntrants().filter(entrant => allSessionBlocks.some(block => block.entrantId === entrant.id));

  // Count the session blocks of each type
      const threeX10Count = allSessionBlocks.filter(block => block.type === '3x10').length;
      const threeX20Count = allSessionBlocks.filter(block => block.type === '3x20').length;
      const oneXLongCount = allSessionBlocks.filter(block => block.type === '1xLong').length;

  const [judgeNumberToJudge, groupNumberToGroup, judgeSchedules] = createMatrix(threeX10Count, threeX20Count, oneXLongCount, getSessionDurationSlots('3x10'), getSessionDurationSlots('3x20'), getSessionDurationSlots('1xLong'), judges, entrants, allSessionBlocks);
  console.log(`Judge number to judge: ${judgeNumberToJudge}`);  console.log(`Group number to group: ${groupNumberToGroup}`);
  console.log(`Judge schedules: ${judgeSchedules}`);
  assignSessionBlocksToGrid(judgeNumberToJudge, groupNumberToGroup, judgeSchedules, allSessionBlocks, onSessionBlockUpdate);
};

const assignSessionBlocksToGrid = (judgeNumberToJudge: Map<number, Judge>, groupNumberToGroup: Map<number, Entrant>, judgeSchedules: number[][], allSessionBlocks: SessionBlock[], onSessionBlockUpdate: (sessionBlock: SessionBlock) => void) => {
  console.log('=== ASSIGNING SESSION BLOCKS TO GRID ===');
  
  // Group session blocks by entrant for easier lookup
  const sessionBlocksByEntrant = new Map<string, SessionBlock[]>();
  allSessionBlocks.forEach(block => {
    if (!sessionBlocksByEntrant.has(block.entrantId)) {
      sessionBlocksByEntrant.set(block.entrantId, []);
    }
    sessionBlocksByEntrant.get(block.entrantId)!.push(block);
  });
  
  // Track which session blocks have been assigned
  const assignedBlocks = new Set<SessionBlock>();
  
  // For each judge, find the first occurrence of each group number
  for (let judgeIndex = 0; judgeIndex < judgeSchedules.length; judgeIndex++) {
    const judgeSchedule = judgeSchedules[judgeIndex];
    const judgeNumber = judgeIndex + 1;
    const judge = judgeNumberToJudge.get(judgeNumber);
    
    if (!judge) {
      console.warn(`No judge found for judge number ${judgeNumber}`);
      continue;
    }
    
    // Find first occurrence of each group number in this judge's schedule
    const groupFirstOccurrence = new Map<number, number>();
    for (let slotIndex = 0; slotIndex < judgeSchedule.length; slotIndex++) {
      const groupNumber = judgeSchedule[slotIndex];
      if (groupNumber !== 0 && !groupFirstOccurrence.has(groupNumber)) {
        groupFirstOccurrence.set(groupNumber, slotIndex);
      }
    }
    
    // Update session blocks for each group this judge evaluates
    for (const [groupNumber, startRowIndex] of groupFirstOccurrence) {
      const group = groupNumberToGroup.get(groupNumber);
      if (!group) {
        console.warn(`No group found for group number ${groupNumber}`);
        continue;
      }
      
      // Find an unassigned session block for this group
      const groupBlocks = sessionBlocksByEntrant.get(group.id) || [];
      const unassignedBlock = groupBlocks.find(block => !assignedBlocks.has(block));
      
      if (unassignedBlock) {
        // Create updated session block
        const updatedBlock: SessionBlock = {
          ...unassignedBlock,
          isScheduled: true,
          startRowIndex: startRowIndex,
          endRowIndex: startRowIndex, // Will be updated by the grid component based on duration
          judgeId: judge.id
        };
        
        // Update the session block
        onSessionBlockUpdate(updatedBlock);
        assignedBlocks.add(unassignedBlock);
        
        console.log(`Assigned ${unassignedBlock.entrantName} (${unassignedBlock.type}) to ${judge.name} at time slot ${startRowIndex}`);
      } else {
        console.warn(`No unassigned session block found for group ${group.name}`);
      }
    }
  }
  
  console.log(`Total session blocks assigned: ${assignedBlocks.size} out of ${allSessionBlocks.length}`);
}


const createMatrix = (threeX10Count: number, threeX20Count: number, oneXLongCount: number, threeX10Height: number, threeX20Height: number, oneXLongHeight: number, judges: Judge[], entrants: Entrant[], allSessionBlocks: SessionBlock[]): [Map<number, Judge>, Map<number, Entrant>, number[][]] => {
  console.log('=== EVALUATION MATRIX SCHEDULER ===');
  console.log(`Input Parameters:`);
  console.log(`  - 3x10 Sessions: ${threeX10Count} (${threeX10Count / 3} groups)`);
  console.log(`  - 3x20 Sessions: ${threeX20Count} (${threeX20Count / 3} groups)`);
  console.log(`  - 1xLong Sessions: ${oneXLongCount}`);
  console.log(`  - Judges: ${judges.length}`);
  console.log(`  - Time Slots: 3x10=${threeX10Height}, 3x20=${threeX20Height}, 1xLong=${oneXLongHeight}`);
  console.log('');

  // Step 1: Analyze and create pods
  const pods = createPods(threeX10Count, threeX20Count);
  
  // Step 2: Generate schedule matrix
  const judgeSchedules = generateScheduleMatrix(pods, judges, threeX10Height, threeX20Height, oneXLongCount, oneXLongHeight);
  
  // Step 3: Assign judges and groups
    // Extract data for assigning actual groups and judges
    const judgeGroupAssignments = getJudgeGroupAssignments(judgeSchedules);
    const groupTypes = getGroupTypes(pods, oneXLongCount);

  const [judgeNumberToJudge, groupNumberToGroup] = assignGroupsAndJudges(judgeGroupAssignments, groupTypes, judges, entrants, allSessionBlocks);
  console.log(`Judge number to judge: ${judgeNumberToJudge}`);
  console.log(`Group number to group: ${groupNumberToGroup}`);


  // Step 4: Display results
  //displaySchedule(judgeSchedules, judges);
  return [judgeNumberToJudge, groupNumberToGroup, judgeSchedules];
};


// Step 1: Pod Analysis and Creation
const createPods = (threeX10Count: number, threeX20Count: number): Array<string>[] => {
  console.log('=== CREATING PODS ===');
  
  // Convert session counts to group counts
  const threeX10Groups = threeX10Count / 3;
  const threeX20Groups = threeX20Count / 3;
  
  console.log(`Groups to schedule: ${threeX10Groups} 3x10, ${threeX20Groups} 3x20`);
  
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
  
  // Log any unassigned groups (shouldn't happen with this logic)
  if (remaining3x10 > 0 || remaining3x20 > 0) {
    console.warn(`Unassigned groups: ${remaining3x10} 3x10, ${remaining3x20} 3x20`);
  }
  console.log(podTypes);
  return podTypes;
};

// Step 2: Schedule Generation
const generateScheduleMatrix = (pods: Array<string>[], judges: Judge[], threeX10Height: number, threeX20Height: number, oneXLongCount: number, oneXLongHeight: number): number[][] => {
  console.log('=== GENERATING SCHEDULE MATRIX ===');
  
  // Count the number of judges in each category
  const judgesByCategory = {
    MUS: judges.filter(j => j.category === 'MUS').length,
    SNG: judges.filter(j => j.category === 'SNG').length,
    PER: judges.filter(j => j.category === 'PER').length
  }
  console.log(`Judges by category: MUS=${judgesByCategory.MUS}, SNG=${judgesByCategory.SNG}, PER=${judgesByCategory.PER}`);
  const maxJudgeSets = Math.max(judgesByCategory.MUS, judgesByCategory.SNG, judgesByCategory.PER);
  const extraJudges = judges.length - maxJudgeSets * 3;
  console.log(`Extra judges: ${extraJudges}`);
  console.log(`Max judge sets: ${maxJudgeSets}`);
//Create an array of arrays of the length of the judges
  const columns = [];
  for (let i = 0; i < judges.length; i++) {
    columns.push([]);
  }
  // Figure out how long each pod will be
  // If pod contains 3x20, use threeX20Height, otherwise use threeX10Height
  // Then multiply by max of number of groups in the pod or 3 (number of judges in the pod)
  const podLengths = pods.map(pod => {
    return (pod.includes('3x20') ? threeX20Height : threeX10Height) * Math.max(pod.length, 3);
  });
  console.log(threeX10Height, threeX20Height);
  console.log(`Pod lengths: ${podLengths}`);
  // Sort pod based on pod lengths, shortest to longest
  const sortedPods = podLengths.sort((a, b) => a - b);
  console.log(`Sorted pods: ${sortedPods}`);
  let lastGroupIndex=0
  
  // Initialize judge schedules - each judge gets an empty array
  const judgeSchedules: number[][] = [];
  for (let i = 0; i < judges.length; i++) {
    judgeSchedules.push([]);
  }
  
  // Assign each pod to a set of judges, rotating through the judge sets
  for (let i = 0; i < pods.length; i++) {
    const pod = pods[i];
    const judgeAssignments = assignPodsToJudges(pod, threeX10Height, threeX20Height);
    console.log(`Pod ${i + 1} (${pod.join(', ')}):`, judgeAssignments);
    
    // Renumber the groups in this pod's assignments
    lastGroupIndex = renumberGroups(judgeAssignments, lastGroupIndex);
    console.log(`After renumbering, last group index: ${lastGroupIndex}`);
    
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
      console.log(`Assigned pod judge ${j + 1} to judge ${targetJudgeIndex + 1}`);
    }
  }

  // Clear out trailing bye slots before assigning the 1xLong groups
  clearTrailingByeSlots(judgeSchedules);

  // Assign the 1xLong groups to the judges with the most available slots
  assign1xLongGroups(judgeSchedules, oneXLongCount, oneXLongHeight, lastGroupIndex + 1);
  
  console.log('Final judge schedules:');
  judgeSchedules.forEach((schedule, index) => {
    console.log(`Judge ${index + 1}: [${schedule.join(',')}]`);
  });
  
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
  
  console.log(`=== ASSIGNING ${oneXLongCount} 1xLong SESSIONS ===`);
  
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
    
    console.log(`Assigned 1xLong session ${i + 1} (Group ${groupNumber}) to Judge ${judgeWithFewestSlots + 1}`);
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
  console.log(`Pod ${pod.join(', ')} is ${isHomogeneous ? 'homogeneous' : 'hybrid'}`);

  // Determine the height for this pod (use the maximum height for hybrid pods)
  const podHeight = isHomogeneous 
    ? (pod[0] === '3x10' ? threeX10Height : threeX20Height)
    : Math.max(threeX10Height, threeX20Height);
  console.log(`Pod height: ${podHeight} slots`);

  if (numGroups === 2) {
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
    console.log(`3x10 group indices: ${threeX10GroupIndices}, bye slots: ${byeSlots}`);
    
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
    console.log(`Judge assignments: ${judgeAssignments}`);
  
  return judgeAssignments;
}

/*
// Step 3: Display Results
const displaySchedule = (judgeSchedules: number[][], judges: Judge[]) => {
  console.log('=== FINAL SCHEDULE MATRIX ===');
  
  // Find the maximum length of any judge schedule
  const maxLength = Math.max(...judgeSchedules.map(schedule => schedule.length));
  
  console.log(`Schedule Matrix (${judges.length} judges × ${maxLength} time slots):`);
  console.log('');
  
  // Header - just numbered judges
  let header = 'Time |';
  for (let i = 0; i < judges.length; i++) {
    header += ` J${i + 1} |`;
  }
  console.log(header);
  console.log(''.padEnd(header.length, '-'));
  
  // Rows
  for (let timeSlot = 0; timeSlot < maxLength; timeSlot++) {
    let row = `${timeSlot.toString().padStart(4, ' ')} |`;
    for (let judgeIndex = 0; judgeIndex < judges.length; judgeIndex++) {
      const judgeSchedule = judgeSchedules[judgeIndex];
      const value = judgeSchedule[timeSlot];
      
      if (value === undefined) {
        row += '    |';
      } else if (value === 0) {
        row += ' -- |';
      } else {
        row += ` G${value.toString()} |`;
      }
    }
    console.log(row);
  }
  
  console.log('');
  console.log('Legend:');
  console.log('  - GX = Group X (evaluating that group)');
  console.log('  - -- = No evaluation (break time)');
  console.log('  - Empty = No assignment');
};
*/

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
  console.log('=== ASSIGNING GROUPS AND JUDGES ===');
  
  // Group judges by category
  const judgesByCategory = {
    MUS: judges.filter(j => j.category === 'MUS'),
    SNG: judges.filter(j => j.category === 'SNG'),
    PER: judges.filter(j => j.category === 'PER')
  };
  
  console.log(`Available judges: MUS=${judgesByCategory.MUS.length}, SNG=${judgesByCategory.SNG.length}, PER=${judgesByCategory.PER.length}`);
  
  // Create mappings
  const judgeNumberToJudge = new Map<number, Judge>();
  const groupNumberToGroup = new Map<number, Entrant>();
  
  // Track which judges have been assigned
  const assignedJudges = new Set<Judge>();
  
  // Group judges into pods (sets of 3)
  const numPods = Math.floor(judges.length / 3);
  console.log(`Creating ${numPods} pods from ${judges.length} judges`);
  
  // For each pod, try to assign one judge from each category
  for (let podIndex = 0; podIndex < numPods; podIndex++) {
    const podJudges = [podIndex * 3 + 1, podIndex * 3 + 2, podIndex * 3 + 3]; // Judge numbers 1,2,3 or 4,5,6, etc.
    console.log(`\nProcessing Pod ${podIndex + 1} with judge numbers: ${podJudges.join(', ')}`);
    
    // Try to assign one judge from each category to this pod
    const podAssignments: (Judge | null)[] = [null, null, null]; // MUS, SNG, PER
    
    // Find available judges for each category
    for (const category of ['MUS', 'SNG', 'PER'] as const) {
      const availableJudges = judgesByCategory[category].filter(j => !assignedJudges.has(j));
      if (availableJudges.length > 0) {
        // For now, just pick the first available judge
        // TODO: Could optimize based on group preferences here
        const selectedJudge = availableJudges[0];
        const categoryIndex = category === 'MUS' ? 0 : category === 'SNG' ? 1 : 2;
        podAssignments[categoryIndex] = selectedJudge;
        assignedJudges.add(selectedJudge);
        console.log(`  Assigned ${selectedJudge.name} (${category}) to judge number ${podJudges[categoryIndex]}`);
      }
    }
    
    // Fill in any remaining slots with unassigned judges
    const unassignedJudges = judges.filter(j => !assignedJudges.has(j));
    for (let i = 0; i < 3; i++) {
      if (podAssignments[i] === null && unassignedJudges.length > 0) {
        const judge = unassignedJudges.shift()!;
        podAssignments[i] = judge;
        assignedJudges.add(judge);
        console.log(`  Assigned ${judge.name} to judge number ${podJudges[i]}`);
      }
    }
    
    // Map judge numbers to actual judges
    for (let i = 0; i < 3; i++) {
      if (podAssignments[i]) {
        judgeNumberToJudge.set(podJudges[i], podAssignments[i]!);
      }
    }
  }
  
  // Assign remaining judges to any leftover judge numbers
  const remainingJudges = judges.filter(j => !assignedJudges.has(j));
  let remainingJudgeNumber = numPods * 3 + 1;
  for (const judge of remainingJudges) {
    judgeNumberToJudge.set(remainingJudgeNumber, judge);
    console.log(`  Assigned remaining judge ${judge.name} to judge number ${remainingJudgeNumber}`);
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
  
  // Group the entrants by their session types
  const groupsByType = {
    '3x10': groups.filter(g => entrantSessionTypes.get(g.id) === '3x10'),
    '3x20': groups.filter(g => entrantSessionTypes.get(g.id) === '3x20'),
    '1xLong': groups.filter(g => entrantSessionTypes.get(g.id) === '1xLong')
  };
  
  console.log(`Groups by type: 3x10=${groupsByType['3x10'].length}, 3x20=${groupsByType['3x20'].length}, 1xLong=${groupsByType['1xLong'].length}`);
  
  // Track which groups have been assigned
  const assignedGroups = new Set<Entrant>();
  
  // Helper function to check if a group can be assigned to a judge (no conflicts)
  const canAssignGroupToJudge = (group: Entrant, judgeNumber: number): boolean => {
    if (!group.groupsToAvoid) return true;
    
    const groupsToAvoid = group.groupsToAvoid.split(' | ').map(g => g.trim()).filter(g => g);
    const judgeGroupNumbers = judgeGroups.get(judgeNumber) || new Set();
    
    // Check if any groups this judge evaluates are in the avoid list
    for (const groupNumber of judgeGroupNumbers) {
      const otherGroup = groupNumberToGroup.get(groupNumber);
      if (otherGroup && groupsToAvoid.includes(otherGroup.name)) {
        return false; // Conflict found
      }
    }
    
    return true; // No conflicts
  };
  
  // Helper function to find the best available judge for a group based on preferences
  const findBestJudgeForGroup = (group: Entrant, evaluatingJudges: Set<number>): number | null => {
    // Try preferences in order: 1st, 2nd, 3rd
    const preferences = [group.judgePreference1, group.judgePreference2, group.judgePreference3];
    
    for (const preferenceId of preferences) {
      if (!preferenceId) continue;
      
      // Find the judge number for this preference
      for (const [judgeNum, judge] of judgeNumberToJudge) {
        if (judge.id === preferenceId && evaluatingJudges.has(judgeNum)) {
          // Check if this assignment would cause conflicts
          if (canAssignGroupToJudge(group, judgeNum)) {
            return judgeNum;
          }
        }
      }
    }
    
    // If no preferences work, try any available judge without conflicts
    for (const judgeNum of evaluatingJudges) {
      if (canAssignGroupToJudge(group, judgeNum)) {
        return judgeNum;
      }
    }
    
    // If all judges have conflicts, return the first one (fallback)
    return evaluatingJudges.size > 0 ? Array.from(evaluatingJudges)[0] : null;
  };
  
  // Sort groups by their order in the original list (first-come-first-served)
  const allGroups = [...groups];
  
  // Assign groups based on the groupTypes mapping with first-come-first-served preference assignment
  for (const [groupNumber, sessionType] of groupTypes) {
    const availableGroups = groupsByType[sessionType as keyof typeof groupsByType].filter(g => !assignedGroups.has(g));
    if (availableGroups.length > 0) {
      // Get all judges that will evaluate this group number
      const evaluatingJudges = new Set<number>();
      for (const [judgeNum, judgeGroupNumbers] of judgeGroups) {
        if (judgeGroupNumbers.has(groupNumber)) {
          evaluatingJudges.add(judgeNum);
        }
      }
      
      // Find the first available group (in original order) that can be assigned
      let selectedGroup: Entrant | null = null;
      let assignmentReason = '';
      
      for (const group of allGroups) {
        if (!availableGroups.includes(group)) continue; // Skip if not available for this session type
        
        const bestJudge = findBestJudgeForGroup(group, evaluatingJudges);
        if (bestJudge !== null) {
          selectedGroup = group;
          
          // Determine assignment reason for logging
          const judge = judgeNumberToJudge.get(bestJudge);
          if (group.judgePreference1 === judge?.id) {
            assignmentReason = '1st preference';
          } else if (group.judgePreference2 === judge?.id) {
            assignmentReason = '2nd preference';
          } else if (group.judgePreference3 === judge?.id) {
            assignmentReason = '3rd preference';
          } else {
            assignmentReason = 'fallback (no conflicts)';
          }
          
          break; // Take the first group that can be assigned
        }
      }
      
      // Fallback: if no group can be assigned without conflicts, take the first available
      if (!selectedGroup) {
        selectedGroup = availableGroups[0];
        assignmentReason = 'fallback (conflicts unavoidable)';
      }
      
      groupNumberToGroup.set(groupNumber, selectedGroup);
      assignedGroups.add(selectedGroup);
      console.log(`  Assigned group ${selectedGroup.name} (${sessionType}) to group number ${groupNumber} - ${assignmentReason}`);
    } else {
      console.warn(`No available ${sessionType} groups for group number ${groupNumber}`);
    }
  }
  
  console.log('\n=== FINAL ASSIGNMENTS ===');
  console.log('Judge Assignments:');
  for (const [judgeNum, judge] of judgeNumberToJudge) {
    console.log(`  Judge ${judgeNum}: ${judge.name} (${judge.category})`);
  }
  
  console.log('\nGroup Assignments:');
  for (const [groupNum, group] of groupNumberToGroup) {
    const evalType = groupTypes.get(groupNum) || 'Unknown';
    console.log(`  Group ${groupNum}: ${group.name} (${evalType})`);
  }
  
  return [judgeNumberToJudge, groupNumberToGroup];
}