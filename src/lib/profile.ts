import { Persona } from "@/types/persona";

export interface ProfileOverride {
  city?: string;
  state?: string;
  salary_min?: number;
  salary_ideal?: number;
  skills?: Record<string, string[]>;
  contact_email?: string;
  contact_phone?: string;
  experience_details?: Persona["experience_details"];
}

export function mergeProfile(base: Persona, override: ProfileOverride | null | undefined): Persona {
  if (!override) return base;
  return {
    ...base,
    location: {
      ...base.location,
      city: override.city ?? base.location.city,
      state: override.state ?? base.location.state,
    },
    preferences: {
      ...base.preferences,
      desired_pay_inr_lpa: {
        min: override.salary_min ?? base.preferences.desired_pay_inr_lpa.min,
        ideal: override.salary_ideal ?? base.preferences.desired_pay_inr_lpa.ideal,
      },
    },
    skills: (() => {
      const s = { ...((override.skills as Persona["skills"]) ?? base.skills) };
      if ("_scout_experience" in s) delete (s as any)._scout_experience;
      return s;
    })(),
    contact: {
      ...base.contact,
      email: override.contact_email ?? base.contact.email,
      phone: override.contact_phone ?? base.contact.phone,
    },
    experience_details: override.experience_details ?? base.experience_details,
  };
}
