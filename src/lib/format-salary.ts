export function formatSalary(value: number | undefined | null): string {
  if (value === undefined || value === null) return "N/A";

  // If the value is already in the range typical for LPA (e.g., 5 to 100), just append L.
  // Otherwise, if it is a large number (e.g., 1200000), convert it to Lakhs.
  if (value >= 100000) {
    const lakhs = value / 100000;
    // Format to 1 decimal place if needed, otherwise integer
    const formatted = lakhs % 1 === 0 ? lakhs.toString() : lakhs.toFixed(1);
    return `₹${formatted}L`;
  }
  
  // Assume it's already in LPA
  return `₹${value}L`;
}
