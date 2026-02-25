/**
 * Returns the exact age in full years for a given date of birth,
 * accounting for whether the birthday has occurred yet this year.
 */
export function calcAge(dateOfBirth: string | Date): number {
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}
