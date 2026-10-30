// Fixed natural-language checks. Never substitute copied article text when a
// query fails: doing so would hide a retrieval regression behind a passing audit.
export const referenceProbes = [
  { sourceId: "R1", question: "Where does the right coronary artery arise?" },
  { sourceId: "R2", question: "What is the right marginal artery blood supply?" },
  { sourceId: "R3", question: "What does the left main coronary artery supply?" },
  { sourceId: "R4", question: "How is coronary artery disease diagnosed with CCTA?" },
  { sourceId: "R5", question: "What happens when diagonal branch flow is impaired?" },
  { sourceId: "R6", question: "Where is the LCx located?" },
  { sourceId: "R7", question: "What is rare about conus artery occlusion?" },
  { sourceId: "R8", question: "Where is the ascending aorta located?" },
  { sourceId: "R9", question: "What are the consequences of ascending aorta thrombus?" },
  { sourceId: "R10", question: "How is superior vena cava obstruction investigated?" },
  { sourceId: "R11", question: "Where does the coronary sinus drain?" },
];
