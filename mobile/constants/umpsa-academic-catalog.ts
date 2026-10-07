export const UMPSA_NAME = 'Universiti Malaysia Pahang Al-Sultan Abdullah';
export const COMPUTING_FACULTY_ID = 'faculty-computing';

/** Add future programmes to the appropriate faculty here; profiles retain labels. */
export const UMPSA_FACULTIES = [
  { id: 'faculty-chemical-process-engineering-technology', label: 'Faculty of Chemical and Process Engineering Technology', programmes: [] },
  { id: 'faculty-civil-engineering-technology', label: 'Faculty of Civil Engineering Technology', programmes: [] },
  { id: 'faculty-electrical-electronics-engineering-technology', label: 'Faculty of Electrical and Electronics Engineering Technology', programmes: [] },
  { id: 'faculty-manufacturing-mechatronic-engineering-technology', label: 'Faculty of Manufacturing and Mechatronic Engineering Technology', programmes: [] },
  { id: 'faculty-mechanical-automotive-engineering-technology', label: 'Faculty of Mechanical and Automotive Engineering Technology', programmes: [] },
  { id: 'centre-mathematical-sciences', label: 'Centre for Mathematical Sciences', programmes: [] },
  { id: COMPUTING_FACULTY_ID, label: 'Faculty of Computing', programmes: [
    { id: 'diploma-computer-science', label: 'Diploma in Computer Science' },
    { id: 'bcs-software-engineering', label: 'Bachelor of Computer Science (Software Engineering) with Honours' },
    { id: 'dual-bcs-software-engineering', label: 'Dual Degree Program - Bachelor of Computer Science (Software Engineering) with Honours' },
    { id: 'bcs-computer-systems-networking', label: 'Bachelor of Computer Science (Computer Systems & Networking) with Honours' },
    { id: 'bcs-multimedia-software', label: 'Bachelor of Computer Science (Multimedia Software) with Honours' },
    { id: 'bcs-cyber-security', label: 'Bachelor of Computer Science (Cyber Security) with Honours' },
  ] },
  { id: 'faculty-industrial-sciences-technology', label: 'Faculty of Industrial Sciences and Technology', programmes: [] },
  { id: 'centre-human-sciences', label: 'Centre for Human Sciences', programmes: [] },
  { id: 'centre-modern-languages', label: 'Centre for Modern Languages', programmes: [] },
  { id: 'faculty-industrial-management', label: 'Faculty of Industrial Management', programmes: [] },
] as const;

export const LEGACY_PROGRAMME_LABELS: Record<string, string> = {
  'BCS Software Engineering': 'Bachelor of Computer Science (Software Engineering) with Honours',
};

export function facultyForLabel(label: string | null | undefined) {
  return UMPSA_FACULTIES.find((faculty) => faculty.label === label);
}

export function programmeForLabel(facultyLabel: string | null | undefined, label: string | null | undefined) {
  const normalized = label ? (LEGACY_PROGRAMME_LABELS[label] ?? label) : null;
  return facultyForLabel(facultyLabel)?.programmes.find((programme) => programme.label === normalized);
}
